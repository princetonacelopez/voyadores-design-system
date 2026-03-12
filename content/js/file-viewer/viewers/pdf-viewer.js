import { eventBus } from '../event-bus.js';
import { BaseViewer } from '../base-viewer.js';
import { ToolbarManager } from '../toolbar-manager.js';
import { FileUtils } from '../file-utils.js';
import { NetworkError, FileError, ServerError, InvalidInputError } from '../errors.js';

var { pdfjsLib } = globalThis;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Rendering states inspired by pdf.js
const RenderingStates = {
    INITIAL: 0,
    RUNNING: 1,
    PAUSED: 2,
    FINISHED: 3,
    ERROR: 4
};

// Enhanced rendering queue with priority management
class RenderingQueue {
    constructor() {
        this.queue = [];
        this.rendering = false;
        this.paused = false;
    }

    add(pageNum, callback, priority) {
        // Remove existing item with same page number
        this.queue = this.queue.filter(item => item.pageNum !== pageNum);

        // Add new item with updated priority
        this.queue.push({ pageNum, callback, priority });

        // Sort by priority (higher numbers first), then by page number
        this.queue.sort((a, b) => b.priority - a.priority || a.pageNum - b.pageNum);

        if (!this.paused) {
            this.renderNext();
        }
    }

    pause() {
        this.paused = true;
    }

    resume() {
        if (this.paused) {
            this.paused = false;
            this.renderNext();
        }
    }

    clear() {
        this.queue = [];
    }

    updatePriorities(visiblePages, currentPage) {
        // Update priorities based on current view
        this.queue.forEach(item => {
            if (item.pageNum === currentPage) {
                item.priority = 10; // Highest priority for current page
            } else if (visiblePages.includes(item.pageNum)) {
                item.priority = 5; // High priority for visible pages
            } else if (Math.abs(item.pageNum - currentPage) <= 2) {
                item.priority = 2; // Medium priority for adjacent pages
            } else {
                item.priority = 0; // Low priority for other pages
            }
        });

        // Re-sort the queue
        this.queue.sort((a, b) => b.priority - a.priority || a.pageNum - b.pageNum);
    }

    renderNext() {
        if (this.rendering || this.queue.length === 0 || this.paused) return;

        this.rendering = true;
        const { pageNum, callback } = this.queue.shift();

        callback().then(() => {
            this.rendering = false;
            this.renderNext();
        }).catch(error => {
            this.rendering = false;
            this.renderNext();
        });
    }
}

export class PDFViewer extends BaseViewer {
    constructor() {
        super();
        this.pageCanvases = [];
        this.pageStates = [];
        this.thumbnailStates = [];
        this.currentScale = 1.0;
        this.initialScale = 1.0;
        this.currentPage = 1;
        this.totalPages = 0;
        this.minScale = 0.1;
        this.maxScale = 5.0;
        this.scaleStep = 0.25;
        this.isFullWidth = this.isMobile;
        this.fileName = 'document.pdf';
        this.pdfData = null;
        this.pdf = null;
        this.pdfUrl = null;
        this.debounceTimeout = null;
        this.scrollTimeout = null;
        this.scrollStopTimeout = null;
        this.isProgrammaticScroll = false;
        this.baseDimensions = [];
        this.renderingQueue = new RenderingQueue();
        this.visiblePages = new Set();
        this.lastScrollTop = 0;
        this.scrollDirection = 0;
        this.pageViewport = [];
        this.isStatusBarUpdatePending = false;

        // Touch gesture properties for pinch-to-zoom
        this.touchStartDistance = 0;
        this.touchStartScale = 1.0;
        this.isPinching = false;

        this.toolbarManager = new ToolbarManager(this, {
            controls: [
                { id: 'zoom-in', title: 'Zoom In', icon: 'plus', action: this.zoomIn.bind(this) },
                { id: 'zoom-out', title: 'Zoom Out', icon: 'minus', action: this.zoomOut.bind(this) },
                { id: 'full-width-page', title: 'Full Width', icon: 'arrows-left-right', action: this.setFullWidth.bind(this) }
            ],
            share: [
                { id: 'download-pdf', title: 'Download', icon: 'download', action: this.download.bind(this) },
                { id: 'print-pdf', title: 'Print', icon: 'print', action: this.print.bind(this) },
                { id: 'share-pdf', title: 'Share', icon: 'share', action: this.share.bind(this) }
            ]
        });
    }

    async render(input) {
        super.render(this.toolbarManager);
        const contentDiv = document.getElementById('file-viewer-content');

        try {
            if (typeof input === 'string') {
                this.pdfData = await FileUtils.processUrl(input);
            } else if (input instanceof File) {
                this.pdfData = await FileUtils.processFile(input);
            } else if (input instanceof Blob) {
                this.pdfData = await FileUtils.processBlob(input, 'document.pdf');
            } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
                this.pdfData = await FileUtils.processBytes(input, 'application/pdf', 'document.pdf');
            } else {
                throw new InvalidInputError('Unsupported input type');
            }

            this.fileName = this.pdfData.name || 'document.pdf';
            this.toolbarManager.updateFileName(this.fileName);
            this.renderContent(contentDiv, document.getElementById('file-viewer-toolbar'));

            const pageContainer = contentDiv.querySelector('.page-container');
            const sidebarContent = document.getElementById('file-viewer-sidebar-content');

            this.pdfUrl = URL.createObjectURL(this.pdfData);
            this.pdf = await pdfjsLib.getDocument(this.pdfUrl).promise;
            this.totalPages = this.pdf.numPages;

            // Initialize page and thumbnail states
            this.pageCanvases = new Array(this.totalPages).fill(null);
            this.pageStates = new Array(this.totalPages).fill(RenderingStates.INITIAL);
            this.thumbnailStates = new Array(this.totalPages).fill(RenderingStates.INITIAL);
            this.baseDimensions = new Array(this.totalPages).fill(null);
            this.pageViewport = new Array(this.totalPages).fill(null);

            await this.renderPagePane(sidebarContent, pageContainer);
            await this.renderInitialPages(pageContainer);

            // Optimize scroll handling with debouncing and throttling
            let isScrollThrottled = false;
            pageContainer.addEventListener('scroll', () => {
                const currentScrollTop = pageContainer.scrollTop;
                this.scrollDirection = currentScrollTop - this.lastScrollTop;

                // Skip programmatic scrolls
                if (this.isProgrammaticScroll) {
                    this.isProgrammaticScroll = false;
                    this.lastScrollTop = currentScrollTop;
                    return;
                }

                // Update current page (lightweight operation)
                if (!isScrollThrottled) {
                    isScrollThrottled = true;
                    this.updateCurrentPageOnScroll(pageContainer);

                    // Reset throttle after a short delay
                    setTimeout(() => {
                        isScrollThrottled = false;
                    }, 100);
                }

                // Clear existing scroll stop timer
                clearTimeout(this.scrollStopTimeout);

                // Set new timer to detect when scrolling stops
                this.scrollStopTimeout = setTimeout(() => {
                    this.updateVisiblePages(pageContainer);
                }, 150);

                this.lastScrollTop = currentScrollTop;
            });

            // Handle window resize efficiently
            window.addEventListener('resize', this.debounceRender(() => this.handleResize(pageContainer), 250));

            // Add touch gesture support for pinch-to-zoom
            this.setupTouchGestures(pageContainer);

            // Initial status bar update
            this.updateStatusBar();
        } catch (error) {
            let errorMessage = 'An unexpected error occurred';
            let errorSubtype = null;
            if (error instanceof NetworkError) {
                errorSubtype = error.status ? 'HttpStatus' : 'ConnectionFailure';
                errorMessage = error.status ? `Network error: ${error.message} (Status: ${error.status})` : 'Network connection failed. Please check your internet.';
            } else if (error instanceof FileError) {
                if (error.message.includes('File not found')) errorSubtype = 'NotFound';
                else if (error.message.includes('Access denied: You are not authorized to view this file')) errorSubtype = 'Forbidden';
                else if (error.message.includes('Invalid file type')) errorSubtype = 'InvalidType';
                else if (error.message.includes('Invalid file provided')) errorSubtype = 'InvalidInput';
                else if (error.message.includes('corrupted or invalid')) errorSubtype = 'Corrupted';
                errorMessage = error.message;
            } else if (error instanceof ServerError) {
                errorMessage = `Server error: ${error.message} (Status: ${error.status})`;
            } else if (error instanceof InvalidInputError) {
                errorSubtype = error.message.includes('URL') ? 'InvalidUrl' : 'UnsupportedType';
                errorMessage = error.message;
            } else if (error.message.includes('Invalid PDF structure')) {
                errorSubtype = 'Corrupted';
                errorMessage = 'The PDF file is corrupted or invalid';
            }
            this.displayError(contentDiv, errorMessage, error, errorSubtype);
        }
    }

    renderContent(contentDiv, toolbarDiv) {
        if (this.pdfData) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.setAttribute('aria-label', 'PDF Pages');
            pageContainer.style.overflowX = 'auto';
            pageContainer.style.overflowY = 'auto';
            pageContainer.style.width = '100%';
            pageContainer.style.boxSizing = 'border-box';
            pageContainer.style.minWidth = '100%';
            pageContainer.style.textAlign = 'center';
            contentDiv.appendChild(pageContainer);

            const sidebarDiv = document.createElement('div');
            sidebarDiv.id = 'file-viewer-sidebar';
            sidebarDiv.setAttribute('popover', '');
            sidebarDiv.setAttribute('role', 'navigation');
            sidebarDiv.setAttribute('aria-label', 'PDF Table of Contents');

            const sidebarHeader = document.createElement('div');
            sidebarHeader.id = 'file-viewer-sidebar-header';
            const sidebarTitle = document.createElement('h2');
            sidebarTitle.id = 'sidebar-title';
            sidebarTitle.className = 'file-viewer-sidebar-title';
            sidebarTitle.textContent = 'Table of Contents';
            const sidebarCloseBtn = document.createElement('button');
            sidebarCloseBtn.className = 'file-viewer-sidebar-close';
            sidebarCloseBtn.type = 'button';
            sidebarCloseBtn.setAttribute('aria-label', 'Close table of contents');
            sidebarCloseBtn.setAttribute('aria-controls', 'file-viewer-sidebar');
            sidebarCloseBtn.setAttribute('aria-expanded', 'true');
            sidebarCloseBtn.innerHTML = '<span class="vi-solid vi-times"></span>';
            sidebarCloseBtn.onclick = () => this.closePopover();
            sidebarCloseBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.closePopover();
                }
            });
            sidebarHeader.appendChild(sidebarTitle);
            sidebarHeader.appendChild(sidebarCloseBtn);

            const sidebarContent = document.createElement('div');
            sidebarContent.id = 'file-viewer-sidebar-content';
            sidebarContent.style.overflowY = 'auto';
            sidebarDiv.appendChild(sidebarHeader);
            sidebarDiv.appendChild(sidebarContent);

            const openSidebarBtn = document.createElement('button');
            openSidebarBtn.id = 'open-sidebar';
            openSidebarBtn.type = 'button';
            openSidebarBtn.setAttribute('aria-label', 'Open table of contents');
            openSidebarBtn.setAttribute('aria-controls', 'file-viewer-sidebar');
            openSidebarBtn.setAttribute('aria-expanded', 'false');
            openSidebarBtn.setAttribute('popovertarget', 'file-viewer-sidebar');
            openSidebarBtn.innerHTML = '<span class="vi-solid vi-menu"></span>';
            openSidebarBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.openSidebarBtn.click();
                }
            });
            toolbarDiv.querySelector('.toolbar-file-title').insertBefore(openSidebarBtn, toolbarDiv.querySelector('#file-title'));

            contentDiv.parentNode.appendChild(sidebarDiv);
        }
    }

    updateStatusBar() {
        // Prevent multiple status bar updates in the same animation frame
        if (this.isStatusBarUpdatePending) return;

        this.isStatusBarUpdatePending = true;
        requestAnimationFrame(() => {
            if (!this.statusBar) {
                console.error('Status bar element not found');
                this.isStatusBarUpdatePending = false;
                return;
            }

            const statusText = this.isFullWidth
                ? `Page ${this.currentPage} of ${this.totalPages} | Zoom Level: Full Width`
                : `Page ${this.currentPage} of ${this.totalPages} | Zoom Level: ${Math.round(this.currentScale * 100)}%`;

            this.statusBar.textContent = statusText;
            this.isStatusBarUpdatePending = false;
        });
    }

    async renderPagePane(sidebarContent, pageContainer) {
        sidebarContent.innerHTML = '';

        const thumbnailFragment = document.createDocumentFragment();

        // Start rendering all thumbnails immediately
        const renderPromises = [];

        for (let i = 1; i <= this.totalPages; i++) {
            const pagePreview = document.createElement('figure');
            pagePreview.className = `page-preview ${i === this.currentPage ? 'active' : ''}`;
            pagePreview.dataset.page = i;
            pagePreview.setAttribute('tabindex', '0');
            pagePreview.setAttribute('role', 'link');
            pagePreview.setAttribute('aria-label', `Go to page ${i}`);
            pagePreview.setAttribute('aria-current', i === this.currentPage ? 'true' : 'false');

            const previewCanvas = document.createElement('canvas');
            previewCanvas.className = 'page-thumbnail';
            previewCanvas.setAttribute('aria-hidden', 'true');
            previewCanvas.dataset.page = i;

            // Add loading indicator until the thumbnail renders
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'thumbnail-loading';
            loadingIndicator.style.position = 'absolute';
            loadingIndicator.style.top = '50%';
            loadingIndicator.style.left = '50%';
            loadingIndicator.style.transform = 'translate(-50%, -50%)';
            loadingIndicator.style.width = '16px';
            loadingIndicator.style.height = '16px';
            loadingIndicator.style.border = '2px solid rgba(255,255,255,0.3)';
            loadingIndicator.style.borderRadius = '50%';
            loadingIndicator.style.borderTop = '2px solid #fff';
            loadingIndicator.style.animation = 'spin 1s linear infinite';
            pagePreview.appendChild(loadingIndicator);

            pagePreview.appendChild(previewCanvas);
            const pageNum = document.createElement('figcaption');
            pageNum.className = 'page-number';
            pageNum.textContent = i.toString();
            pagePreview.appendChild(pageNum);

            pagePreview.onclick = () => this.goToPage(i);
            pagePreview.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.goToPage(i);
                }
            });
            thumbnailFragment.appendChild(pagePreview);

            // Queue immediate thumbnail rendering for all pages
            // Instead of using the rendering queue, we'll render all thumbnails in parallel
            // This ensures all thumbnails appear quickly
            renderPromises.push(this.renderThumbnailDirectly(i, previewCanvas, loadingIndicator));
        }

        sidebarContent.appendChild(thumbnailFragment);

        // Add some CSS for the loading animation
        if (!document.getElementById('thumbnail-loading-style')) {
            const style = document.createElement('style');
            style.id = 'thumbnail-loading-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // Start rendering all thumbnails immediately
        // We don't wait for this to complete as it would block the UI
        this.renderAllThumbnails(renderPromises);
    }

    async renderAllThumbnails(renderPromises) {
        // Process thumbnails in batches to avoid overwhelming the browser
        const batchSize = 5;
        for (let i = 0; i < renderPromises.length; i += batchSize) {
            const batch = renderPromises.slice(i, i + batchSize);
            await Promise.allSettled(batch);
            // Small delay between batches to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }

    async renderThumbnailDirectly(pageNum, previewCanvas, loadingIndicator) {
        if (this.thumbnailStates[pageNum - 1] !== RenderingStates.INITIAL) {
            return;
        }

        this.thumbnailStates[pageNum - 1] = RenderingStates.RUNNING;

        try {
            const page = await this.pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.15 });
            previewCanvas.height = viewport.height;
            previewCanvas.width = viewport.width;
            
            // Set CSS dimensions to maintain aspect ratio
            previewCanvas.style.width = '100%';
            previewCanvas.style.height = 'auto';
            previewCanvas.style.maxWidth = `${viewport.width}px`;
            previewCanvas.style.display = 'block';
            
            const context = previewCanvas.getContext('2d', { alpha: false });
            context.fillStyle = 'rgb(255, 255, 255)';
            context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            // Remove loading indicator when rendering is complete
            if (loadingIndicator && loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }

            this.thumbnailStates[pageNum - 1] = RenderingStates.FINISHED;
        } catch (error) {
            console.error(`Failed to render thumbnail for page ${pageNum}:`, error);
            this.thumbnailStates[pageNum - 1] = RenderingStates.ERROR;

            // Replace loading indicator with error indicator
            if (loadingIndicator && loadingIndicator.parentNode) {
                const errorIndicator = document.createElement('div');
                errorIndicator.textContent = '!';
                errorIndicator.style.position = 'absolute';
                errorIndicator.style.top = '50%';
                errorIndicator.style.left = '50%';
                errorIndicator.style.transform = 'translate(-50%, -50%)';
                errorIndicator.style.color = 'red';
                errorIndicator.style.fontWeight = 'bold';
                loadingIndicator.parentNode.replaceChild(errorIndicator, loadingIndicator);

                // Set timeout to retry
                setTimeout(() => {
                    this.thumbnailStates[pageNum - 1] = RenderingStates.INITIAL;
                    if (errorIndicator.parentNode) {
                        this.renderThumbnailDirectly(pageNum, previewCanvas, errorIndicator);
                    }
                }, 2000);
            }
        }
    }

    async renderThumbnail(pageNum, previewCanvas, pageContainer) {
        if (this.thumbnailStates[pageNum - 1] !== RenderingStates.INITIAL) {
            return;
        }

        this.thumbnailStates[pageNum - 1] = RenderingStates.RUNNING;

        try {
            const page = await this.pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.15 });
            previewCanvas.height = viewport.height;
            previewCanvas.width = viewport.width;
            
            // Set CSS dimensions to maintain aspect ratio
            previewCanvas.style.width = '100%';
            previewCanvas.style.height = 'auto';
            previewCanvas.style.maxWidth = `${viewport.width}px`;
            previewCanvas.style.display = 'block';
            
            const context = previewCanvas.getContext('2d', { alpha: false });
            context.fillStyle = 'rgb(255, 255, 255)';
            context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            // Remove the 'intent' parameter to avoid the warning
            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            this.thumbnailStates[pageNum - 1] = RenderingStates.FINISHED;

            // If this page is visible and not yet rendered, add it to the rendering queue
            if (this.pageStates[pageNum - 1] === RenderingStates.INITIAL && this.visiblePages.has(pageNum)) {
                const priority = pageNum === this.currentPage ? 3 : 1;
                this.renderingQueue.add(pageNum, () => this.renderPage(pageNum, pageContainer), priority);
            }
        } catch (error) {
            this.thumbnailStates[pageNum - 1] = RenderingStates.ERROR;
            console.error(`Failed to render thumbnail for page ${pageNum}:`, error);

            // Mark as initial state again to allow re-trying
            setTimeout(() => {
                this.thumbnailStates[pageNum - 1] = RenderingStates.INITIAL;
            }, 1000);

            throw error;
        }
    }

    async renderInitialPages(pageContainer) {
        // First render just the current page to improve perceived performance
        this.visiblePages.add(this.currentPage);
        this.renderingQueue.add(this.currentPage, () => this.renderPage(this.currentPage, pageContainer), 3);

        // Also render page 1 immediately if we're not on page 1
        if (this.currentPage > 1) {
            this.visiblePages.add(1);
            this.renderingQueue.add(1, () => this.renderPage(1, pageContainer), 2);
        }

        // Then render adjacent pages
        const initialPagesToRender = [
            this.currentPage + 1,
            this.currentPage - 1,
            this.currentPage + 2,
            this.currentPage - 2,
            // Add more pages before current if we're not near the beginning
            this.currentPage - 3,
            this.currentPage - 4,
            this.currentPage - 5,
        ].filter(pageNum => pageNum >= 1 && pageNum <= this.totalPages);

        for (const pageNum of initialPagesToRender) {
            this.visiblePages.add(pageNum);
            // Higher priority for pages before current page to ensure backward navigation
            const priority = pageNum < this.currentPage ? 2 : 1;
            this.renderingQueue.add(pageNum, () => this.renderPage(pageNum, pageContainer), priority);
        }

        // Initial status bar update
        this.updateStatusBar();
    }

    async renderPage(pageNum, pageContainer) {
        if (this.pageStates[pageNum - 1] !== RenderingStates.INITIAL) {
            return;
        }

        this.pageStates[pageNum - 1] = RenderingStates.RUNNING;

        try {
            const page = await this.pdf.getPage(pageNum);
            const devicePixelRatio = window.devicePixelRatio || 1;

            // Get natural dimensions first
            const naturalViewport = page.getViewport({ scale: 1.0 });

            // Calculate scale based on view mode
            const containerWidth = pageContainer.clientWidth - 20; // 20px padding
            const baseScale = this.isFullWidth
                ? containerWidth / naturalViewport.width
                : this.currentScale;

            // Create viewport with device pixel ratio for crisp rendering
            const viewport = page.getViewport({ scale: baseScale * devicePixelRatio });
            this.pageViewport[pageNum - 1] = viewport;

            // Create and setup canvas
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.setAttribute('aria-label', `Page ${pageNum} of ${this.totalPages}`);
            canvas.dataset.page = pageNum;
            canvas.style.width = `${viewport.width / devicePixelRatio}px`;
            canvas.style.height = `${viewport.height / devicePixelRatio}px`;
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto 20px auto';

            // Get 2D context and render with background
            const context = canvas.getContext('2d', { alpha: false });
            context.fillStyle = 'rgb(255, 255, 255)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Render the page
            await page.render({
                canvasContext: context,
                viewport,
                intent: 'display'
            }).promise;

            // Handle canvas placement in the document
            if (!this.pageCanvases[pageNum - 1]) {
                const fragment = document.createDocumentFragment();
                fragment.appendChild(canvas);

                if (pageNum === 1) {
                    pageContainer.prepend(fragment);
                } else {
                    // Insert after previous page if available
                    let inserted = false;
                    for (let i = pageNum - 2; i >= 0; i--) {
                        if (this.pageCanvases[i]) {
                            this.pageCanvases[i].after(fragment);
                            inserted = true;
                            break;
                        }
                    }

                    // If no previous page found, append at the end
                    if (!inserted) {
                        pageContainer.appendChild(fragment);
                    }
                }

                this.pageCanvases[pageNum - 1] = canvas;
                this.baseDimensions[pageNum - 1] = {
                    width: viewport.width / devicePixelRatio,
                    height: viewport.height / devicePixelRatio
                };
            } else {
                pageContainer.replaceChild(canvas, this.pageCanvases[pageNum - 1]);
                this.pageCanvases[pageNum - 1] = canvas;
            }

            this.pageStates[pageNum - 1] = RenderingStates.FINISHED;

            // Update UI if this was the current page
            if (pageNum === this.currentPage) {
                this.updateStatusBar();
                this.updatePagePreviewHighlight();
            }
        } catch (error) {
            this.pageStates[pageNum - 1] = RenderingStates.ERROR;
            console.error(`Failed to render page ${pageNum}:`, error);

            // Mark as initial state again after a delay to allow retry
            setTimeout(() => {
                this.pageStates[pageNum - 1] = RenderingStates.INITIAL;
            }, 1000);

            throw error;
        }
    }

    updateVisiblePages(pageContainer) {
        const visiblePages = this.getVisiblePages(pageContainer);

        // Update the rendering queue priorities based on the new visible pages
        this.renderingQueue.updatePriorities(visiblePages, this.currentPage);

        // Keep track of all pages that should be in view now
        const pagesNeeded = new Set(visiblePages);

        // Always ensure pages from 1 to current page are rendered
        // This is crucial for backwards navigation
        for (let i = 1; i <= this.currentPage; i++) {
            pagesNeeded.add(i);
        }

        // Add any new visible pages that haven't been rendered yet
        pagesNeeded.forEach(pageNum => {
            if (!this.visiblePages.has(pageNum)) {
                this.visiblePages.add(pageNum);

                // Queue the page for rendering if needed
                if (this.pageStates[pageNum - 1] === RenderingStates.INITIAL) {
                    const priority = pageNum === this.currentPage ? 3 :
                        Math.abs(pageNum - this.currentPage) <= 1 ? 2 : 1;
                    this.renderingQueue.add(pageNum, () => this.renderPage(pageNum, pageContainer), priority);
                }

                // Queue the thumbnail for rendering if needed
                if (this.thumbnailStates[pageNum - 1] === RenderingStates.INITIAL) {
                    const previewCanvas = document.querySelector(`.page-thumbnail[data-page="${pageNum}"]`);
                    if (previewCanvas) {
                        const priority = pageNum === this.currentPage ? 3 : 0;
                        this.renderingQueue.add(pageNum, () => this.renderThumbnail(pageNum, previewCanvas, pageContainer), priority);
                    }
                }
            }
        });

        // Clean up pages that are far outside the view
        // But NEVER remove pages between 1 and current page
        this.visiblePages.forEach(pageNum => {
            if (!pagesNeeded.has(pageNum) && pageNum > this.currentPage && Math.abs(pageNum - this.currentPage) > 10) {
                this.visiblePages.delete(pageNum);
                if (this.pageCanvases[pageNum - 1]) {
                    this.pageCanvases[pageNum - 1].remove();
                    this.pageCanvases[pageNum - 1] = null;
                    this.pageStates[pageNum - 1] = RenderingStates.INITIAL;
                    this.baseDimensions[pageNum - 1] = null;
                }
            }
        });
    }

    getVisiblePages(scrollEl) {
        const viewTop = scrollEl.scrollTop;
        const viewHeight = scrollEl.clientHeight;
        const viewBottom = viewTop + viewHeight;
        const visiblePages = [];

        // Add current page to visible pages
        visiblePages.push(this.currentPage);

        // Find all pages with some part visible in the viewport
        for (let i = 0; i < this.pageCanvases.length; i++) {
            const canvas = this.pageCanvases[i];
            if (!canvas) continue;

            const pageTop = canvas.offsetTop;
            const pageHeight = canvas.offsetHeight;
            const pageBottom = pageTop + pageHeight;

            // Check if page is partially visible in viewport
            if (pageBottom > viewTop && pageTop < viewBottom) {
                visiblePages.push(i + 1);
            }
        }

        // Calculate visible area for each possibly visible page
        const visibilityInfo = visiblePages.map(pageNum => {
            const canvas = this.pageCanvases[pageNum - 1];
            if (!canvas) return { pageNum, visibleArea: 0 };

            const pageTop = canvas.offsetTop;
            const pageHeight = canvas.offsetHeight;
            const pageBottom = pageTop + pageHeight;

            const visibleTop = Math.max(pageTop, viewTop);
            const visibleBottom = Math.min(pageBottom, viewBottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            const visibleArea = visibleHeight / pageHeight;

            return { pageNum, visibleArea };
        });

        // Get sorted list of visible pages by visibility
        const mostVisiblePages = visibilityInfo
            .filter(info => info.visibleArea > 0)
            .sort((a, b) => b.visibleArea - a.visibleArea)
            .map(info => info.pageNum);

        // Add surrounding pages for better scroll experience
        // Make sure we include pages BEFORE current page (for scrolling up)
        const result = new Set(mostVisiblePages);

        // Add 5 pages before current page
        for (let i = 1; i <= 5; i++) {
            const prevPage = this.currentPage - i;
            if (prevPage >= 1) {
                result.add(prevPage);
            }
        }

        // Add 5 pages after current page
        for (let i = 1; i <= 5; i++) {
            const nextPage = this.currentPage + i;
            if (nextPage <= this.totalPages) {
                result.add(nextPage);
            }
        }

        // Always include page 1 in the result
        result.add(1);

        // Convert Set back to array and return
        return Array.from(result).sort((a, b) => a - b);
    }

    updateCurrentPageOnScroll(pageContainer) {
        // Early exit if we're not scrolling enough to matter
        const scrollTop = pageContainer.scrollTop;
        if (Math.abs(scrollTop - this.lastScrollTop) < 5) return;

        const viewportHeight = pageContainer.clientHeight;
        const viewportMidpoint = scrollTop + (viewportHeight / 2);

        let mostVisiblePage = this.currentPage;
        let maxVisibility = 0;
        let needsUpdate = false;

        // Find the page with the largest visible area
        for (let i = 0; i < this.pageCanvases.length; i++) {
            const canvas = this.pageCanvases[i];
            if (!canvas) continue;

            const pageTop = canvas.offsetTop;
            const pageHeight = canvas.offsetHeight;
            const pageBottom = pageTop + pageHeight;

            // Calculate visibility based on:
            // 1. How much of the page is in view
            // 2. How close the page is to the center of the viewport
            const visibleTop = Math.max(pageTop, scrollTop);
            const visibleBottom = Math.min(pageBottom, scrollTop + viewportHeight);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            const visibleAreaRatio = visibleHeight / pageHeight;

            // Calculate center distance factor (1.0 = perfect center, 0.0 = far from center)
            const pageMidpoint = pageTop + (pageHeight / 2);
            const distanceFromCenter = Math.abs(pageMidpoint - viewportMidpoint);
            const maxDistance = viewportHeight / 2;
            const centerFactor = 1 - Math.min(1, distanceFromCenter / maxDistance);

            // Combine factors (weight visibility higher than center position)
            const visibility = (visibleAreaRatio * 0.7) + (centerFactor * 0.3);

            if (visibility > maxVisibility) {
                maxVisibility = visibility;
                mostVisiblePage = i + 1;
                needsUpdate = mostVisiblePage !== this.currentPage;
            }
        }

        // Only update if we found a different page with significant visibility
        if (needsUpdate && maxVisibility > 0.1) {
            this.currentPage = mostVisiblePage;
            this.updatePagePreviewHighlight();
            this.scrollThumbnailIntoView(this.currentPage);
            this.updateStatusBar();
        }
    }

    debounceRender(func, delay) {
        return (...args) => {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    setupTouchGestures(pageContainer) {
        let touches = [];
        let pinchTimeout = null;

        const handleTouchStart = (e) => {
            touches = Array.from(e.touches);
            
            if (touches.length === 2) {
                // Two fingers detected - start pinch gesture
                e.preventDefault();
                this.isPinching = true;
                
                // Calculate initial distance between two touch points
                const touch1 = touches[0];
                const touch2 = touches[1];
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                this.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
                
                // Remember the scale at the start of the pinch
                this.touchStartScale = this.currentScale;
                
                // If in full width mode, switch to manual zoom mode
                if (this.isFullWidth) {
                    this.isFullWidth = false;
                }
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length === 2 && this.isPinching) {
                e.preventDefault();
                
                touches = Array.from(e.touches);
                const touch1 = touches[0];
                const touch2 = touches[1];
                
                // Calculate current distance between touch points
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                
                // Calculate scale change
                const scaleChange = currentDistance / this.touchStartDistance;
                let newScale = this.touchStartScale * scaleChange;
                
                // Clamp to min/max scale
                newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
                
                // Only update if scale changed significantly (reduces jitter)
                if (Math.abs(newScale - this.currentScale) > 0.01) {
                    this.currentScale = newScale;
                    this.updateStatusBar();
                    
                    // Apply CSS transform immediately for smooth visual feedback
                    // This provides instant visual zoom without waiting for re-render
                    this.pageCanvases.forEach(canvas => {
                        if (canvas) {
                            const scaleRatio = newScale / this.touchStartScale;
                            canvas.style.transform = `scale(${scaleRatio})`;
                            canvas.style.transformOrigin = 'top center';
                        }
                    });
                }
            }
        };

        const handleTouchEnd = (e) => {
            if (this.isPinching) {
                e.preventDefault();
                this.isPinching = false;
                
                // Clear any pending pinch timeout
                if (pinchTimeout) {
                    clearTimeout(pinchTimeout);
                }
                
                // Reset transforms before re-rendering
                this.pageCanvases.forEach(canvas => {
                    if (canvas) {
                        canvas.style.transform = '';
                        canvas.style.transformOrigin = '';
                    }
                });
                
                // Only re-render if the scale changed significantly from the start
                const scaleChange = Math.abs(this.currentScale - this.touchStartScale);
                if (scaleChange > 0.05) {
                    // Delay the zoom update slightly to ensure smooth transition
                    pinchTimeout = setTimeout(() => {
                        this.updateZoom(pageContainer);
                    }, 100);
                }
            }
            
            touches = Array.from(e.touches);
            
            // Reset if no more touches
            if (touches.length === 0) {
                this.touchStartDistance = 0;
                this.touchStartScale = 1.0;
            }
        };

        // Add touch event listeners
        pageContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        pageContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        pageContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
        pageContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        // Store references for cleanup
        this.touchHandlers = {
            touchstart: handleTouchStart,
            touchmove: handleTouchMove,
            touchend: handleTouchEnd,
            touchcancel: handleTouchEnd
        };
        this.touchContainer = pageContainer;
    }

    async zoomIn() {
        if (this.isFullWidth) {
            // When transitioning from full width to manual zoom, calculate current effective scale
            this.isFullWidth = false;
            const pageContainer = document.getElementById('file-viewer-content').querySelector('.page-container');
            
            // Calculate the current full-width scale by getting the natural page dimensions
            if (this.pdf && pageContainer) {
                try {
                    const page = await this.pdf.getPage(1);
                    const naturalViewport = page.getViewport({ scale: 1.0 });
                    const containerWidth = pageContainer.clientWidth - 20; // 20px padding
                    const fullWidthScale = containerWidth / naturalViewport.width;
                    this.currentScale = fullWidthScale;
                } catch (error) {
                    console.warn('Could not calculate full width scale, using current scale');
                }
            }
        }

        const newScale = Math.min(this.maxScale, this.currentScale + this.scaleStep);
        if (newScale !== this.currentScale) {
            this.currentScale = newScale;
            const pageContainer = document.getElementById('file-viewer-content').querySelector('.page-container');
            this.updateZoom(pageContainer);
            this.updateStatusBar();
        }
    }

    async zoomOut() {
        if (this.isFullWidth) {
            // When transitioning from full width to manual zoom, calculate current effective scale
            this.isFullWidth = false;
            const pageContainer = document.getElementById('file-viewer-content').querySelector('.page-container');
            
            // Calculate the current full-width scale by getting the natural page dimensions
            if (this.pdf && pageContainer) {
                try {
                    const page = await this.pdf.getPage(1);
                    const naturalViewport = page.getViewport({ scale: 1.0 });
                    const containerWidth = pageContainer.clientWidth - 20; // 20px padding
                    const fullWidthScale = containerWidth / naturalViewport.width;
                    this.currentScale = fullWidthScale;
                } catch (error) {
                    console.warn('Could not calculate full width scale, using current scale');
                }
            }
        }

        const newScale = Math.max(this.minScale, this.currentScale - this.scaleStep);
        if (newScale !== this.currentScale) {
            this.currentScale = newScale;
            const pageContainer = document.getElementById('file-viewer-content').querySelector('.page-container');
            this.updateZoom(pageContainer);
            this.updateStatusBar();
        }
    }

    async updateZoom(pageContainer) {
        // Remember current page and scroll position ratio
        let scrollRatio = 0;
        let viewportMidpoint = 0;

        if (this.currentPage && this.pageCanvases[this.currentPage - 1]) {
            const currentCanvas = this.pageCanvases[this.currentPage - 1];
            const pageTop = currentCanvas.offsetTop;
            const currentViewport = pageContainer.getBoundingClientRect();
            const containerScrollTop = pageContainer.scrollTop;

            // Calculate position relative to the current page
            scrollRatio = (containerScrollTop - pageTop) / currentCanvas.offsetHeight;

            // Remember the viewport midpoint for later centering
            viewportMidpoint = containerScrollTop + (currentViewport.height / 2);
        }

        // Pause the rendering queue while updating
        this.renderingQueue.pause();

        // Clear all canvases and reset states
        this.visiblePages.clear();
        this.pageCanvases.forEach((canvas, index) => {
            if (canvas) {
                canvas.remove();
                this.pageCanvases[index] = null;
            }
        });

        this.pageStates = new Array(this.totalPages).fill(RenderingStates.INITIAL);
        this.baseDimensions = new Array(this.totalPages).fill(null);

        // Resume rendering and prioritize current page
        this.renderingQueue.resume();
        await this.renderInitialPages(pageContainer);

        // Restore scroll position once the current page is rendered
        if (this.currentPage && this.pageCanvases[this.currentPage - 1]) {
            await this.waitForPageRender(this.currentPage);
            const newCanvas = this.pageCanvases[this.currentPage - 1];
            const pageTop = newCanvas.offsetTop;

            // Calculate new position based on saved ratio
            const newScrollTop = pageTop + (scrollRatio * newCanvas.offsetHeight);

            // Set flag before programmatic scroll
            this.isProgrammaticScroll = true;
            pageContainer.scrollTop = newScrollTop;

            // Update UI
            this.updatePagePreviewHighlight();
            this.scrollThumbnailIntoView(this.currentPage);
        }
    }

    async waitForPageRender(pageNum) {
        if (this.pageStates[pageNum - 1] === RenderingStates.FINISHED) {
            return;
        }

        return new Promise(resolve => {
            const checkRendered = () => {
                if (this.pageStates[pageNum - 1] === RenderingStates.FINISHED) {
                    resolve();
                } else {
                    setTimeout(checkRendered, 50);
                }
            };
            checkRendered();
        });
    }

    async goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages || pageNum === this.currentPage) {
            return;
        }

        // Update state immediately
        this.currentPage = pageNum;
        this.updateStatusBar();

        // First ensure the thumbnail for this page is fully rendered
        await this.ensureThumbnailRendered(pageNum);

        // Now update the highlight and scroll the sidebar
        this.updatePagePreviewHighlight();
        this.scrollThumbnailIntoView(pageNum);

        const pageContainer = document.getElementById('file-viewer-content').querySelector('.page-container');

        // Ensure we're not in the middle of a zoom operation
        this.renderingQueue.updatePriorities(this.getVisiblePages(pageContainer), pageNum);

        // Pre-render all pages from 1 to target page when going to early pages
        // This ensures we can always navigate back to page 1
        if (pageNum <= 5) {
            // Render all pages from 1 to the target page
            for (let i = 1; i <= pageNum; i++) {
                if (this.pageStates[i - 1] !== RenderingStates.FINISHED) {
                    this.visiblePages.add(i);
                    // Higher priority for pages closer to target
                    const priority = 10 - (pageNum - i);
                    this.renderingQueue.add(i, () => this.renderPage(i, pageContainer), priority);
                }
            }
        } else {
            // For later pages, ensure at least first page is rendered
            if (this.pageStates[0] !== RenderingStates.FINISHED) {
                this.visiblePages.add(1);
                this.renderingQueue.add(1, () => this.renderPage(1, pageContainer), 5);
            }

            // And render target page with high priority
            if (this.pageStates[pageNum - 1] !== RenderingStates.FINISHED) {
                this.visiblePages.add(pageNum);
                this.renderingQueue.add(pageNum, () => this.renderPage(pageNum, pageContainer), 10);
            }
        }

        // Wait for target page to render
        if (this.pageStates[pageNum - 1] !== RenderingStates.FINISHED) {
            await this.waitForPageRender(pageNum);
        }

        // Scroll to the target page
        const targetCanvas = this.pageCanvases[pageNum - 1];
        if (targetCanvas) {
            this.isProgrammaticScroll = true;

            const targetTop = targetCanvas.offsetTop;

            // Use smooth scrolling for better UX, but with a small timeout
            // to give the browser time to process any current rendering
            setTimeout(() => {
                this.isProgrammaticScroll = true;
                targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Make sure scroll stop detection doesn't fire during this programmatic scroll
                clearTimeout(this.scrollStopTimeout);
            }, 50);
        } else {
            console.warn(`Canvas for page ${pageNum} not found`);
            // Calculate approximate position based on average page height
            const avgPageHeight = this.pageCanvases
                .filter(canvas => canvas !== null)
                .reduce((sum, canvas) => sum + canvas.offsetHeight, 0) /
                this.pageCanvases.filter(canvas => canvas !== null).length;

            const approximateTop = Math.max(0, (pageNum - 1) * (avgPageHeight || 800));
            this.isProgrammaticScroll = true;
            pageContainer.scrollTop = approximateTop;

            // Update the UI after scrolling
            setTimeout(() => {
                this.updateVisiblePages(pageContainer);
            }, 300);
        }

        // Prefetch adjacent pages
        this.prefetchAdjacentPages(pageNum, pageContainer);
    }

    async ensureThumbnailRendered(pageNum) {
        // If the thumbnail is already rendered, return immediately
        if (this.thumbnailStates[pageNum - 1] === RenderingStates.FINISHED) {
            return;
        }

        // Find the thumbnail canvas
        const previewCanvas = document.querySelector(`.page-thumbnail[data-page="${pageNum}"]`);
        if (!previewCanvas) {
            console.warn(`Thumbnail canvas for page ${pageNum} not found`);
            return;
        }

        // If it's not rendering yet, start rendering it
        if (this.thumbnailStates[pageNum - 1] === RenderingStates.INITIAL) {
            // Find the loading indicator if it exists
            let loadingIndicator = previewCanvas.parentElement.querySelector('.thumbnail-loading');
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'thumbnail-loading';
                previewCanvas.parentElement.appendChild(loadingIndicator);
            }

            // Start rendering directly
            this.renderThumbnailDirectly(pageNum, previewCanvas, loadingIndicator);
        }

        // Wait for rendering to complete
        const startTime = Date.now();
        const timeout = 2000; // Timeout after 2 seconds

        while (this.thumbnailStates[pageNum - 1] !== RenderingStates.FINISHED) {
            // Check for timeout
            if (Date.now() - startTime > timeout) {
                console.warn(`Timeout waiting for thumbnail ${pageNum} to render`);
                break;
            }

            // Wait a short time before checking again
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    prefetchAdjacentPages(pageNum, pageContainer) {
        // Queue adjacent pages for rendering with decreasing priority
        const pagesToPrefetch = [
            pageNum + 1,
            pageNum - 1,
            pageNum + 2,
            pageNum - 2,
            pageNum + 3
        ].filter(num => num >= 1 && num <= this.totalPages);

        pagesToPrefetch.forEach((num, index) => {
            if (this.pageStates[num - 1] === RenderingStates.INITIAL) {
                this.visiblePages.add(num);
                // Priority decreases as distance from current page increases
                const priority = 5 - Math.min(index, 4);
                this.renderingQueue.add(num, () => this.renderPage(num, pageContainer), priority);
            }
        });
    }

    updatePagePreviewHighlight() {
        const sidebarContent = document.getElementById('file-viewer-sidebar-content');
        if (!sidebarContent) return;

        const previews = sidebarContent.querySelectorAll('.page-preview');

        previews.forEach(preview => {
            const isCurrent = parseInt(preview.dataset.page) === this.currentPage;
            preview.classList.toggle('active', isCurrent);
            preview.setAttribute('aria-current', isCurrent ? 'true' : 'false');
        });
    }

    scrollThumbnailIntoView(pageNum) {
        const sidebarContent = document.getElementById('file-viewer-sidebar-content');
        if (!sidebarContent) return;

        const preview = sidebarContent.querySelector(`.page-preview[data-page="${pageNum}"]`);
        if (!preview) {
            console.warn(`Thumbnail for page ${pageNum} not found`);
            return;
        }

        // Get dimensions and positions
        const previewRect = preview.getBoundingClientRect();
        const sidebarRect = sidebarContent.getBoundingClientRect();

        // Check if the thumbnail is already visible in the sidebar
        const isVisible = (
            previewRect.top >= sidebarRect.top &&
            previewRect.bottom <= sidebarRect.bottom
        );

        // Only scroll if not visible
        if (!isVisible) {
            // Calculate the optimal scroll position to center the thumbnail
            const targetTop = preview.offsetTop - (sidebarRect.height / 2) + (previewRect.height / 2);

            // Smooth scroll to the target position
            sidebarContent.scrollTo({
                top: Math.max(0, targetTop),
                behavior: 'smooth'
            });
        }
    }

    setFullWidth() {
        this.isFullWidth = !this.isFullWidth;
        if (!this.isFullWidth && !this.isMobile) {
            this.currentScale = this.initialScale;
        }

        const pageContainer = document.getElementById('file-viewer-content').querySelector('.page-container');
        this.updateZoom(pageContainer);
        this.updateStatusBar();
    }

    handleResize(pageContainer) {
        // Only update zoom if we're in full width mode or on mobile
        if (this.isFullWidth || this.isMobile) {
            this.updateZoom(pageContainer);
        } else {
            // For non-full-width mode on desktop, just update visible pages
            this.updateVisiblePages(pageContainer);
        }
    }

    closePopover() {
        const popover = document.getElementById('file-viewer-sidebar');
        if (popover) {
            popover.hidePopover();
            const openBtn = document.getElementById('open-sidebar');
            if (openBtn) {
                openBtn.setAttribute('aria-expanded', 'false');
                openBtn.focus();
            }
        }
    }

    download() {
        if (!this.pdfData) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No PDF available to download', new FileError('No PDF available'));
            return;
        }

        const link = document.createElement('a');
        const downloadUrl = URL.createObjectURL(this.pdfData);
        link.href = downloadUrl;
        link.download = this.fileName;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        this.showToast('Download successful!', 'success');
    }

    async print() {
        if (!this.pdfData) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No PDF available to print', new FileError('No PDF available'));
            return;
        }

        const printContainer = document.getElementById('file-viewer-print');
        if (!printContainer) {
            this.displayError(contentDiv, 'Print container not found', new InvalidInputError('Print container missing'));
            return;
        }

        // Show loading indicator
        printContainer.innerHTML = '<div class="print-loading">Preparing document for printing...</div>';
        printContainer.style.display = 'block';

        try {
            // Render all pages at high quality for printing
            printContainer.innerHTML = '';
            const printScale = 2; // Higher scale for better print quality

            for (let i = 1; i <= this.totalPages; i++) {
                // Create progress indicator
                if (i === 1) {
                    const progress = document.createElement('div');
                    progress.className = 'print-progress';
                    progress.textContent = `Preparing page ${i} of ${this.totalPages}`;
                    printContainer.appendChild(progress);
                }

                const page = await this.pdf.getPage(i);
                const viewport = page.getViewport({ scale: printScale });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.className = 'print-page';
                canvas.setAttribute('aria-label', `Page ${i} of ${this.totalPages}`);

                const context = canvas.getContext('2d', { alpha: false });
                context.fillStyle = 'rgb(255, 255, 255)';
                context.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({
                    canvasContext: context,
                    viewport,
                    intent: 'print'
                }).promise;

                // Replace progress indicator with the first page, append others
                if (i === 1) {
                    printContainer.innerHTML = '';
                }
                printContainer.appendChild(canvas);

                // Update progress for remaining pages
                if (i < this.totalPages) {
                    const progress = document.createElement('div');
                    progress.className = 'print-progress';
                    progress.textContent = `Preparing page ${i + 1} of ${this.totalPages}`;
                    printContainer.appendChild(progress);
                }
            }

            // Trigger print after a short delay to ensure all canvases are rendered
            setTimeout(() => {
                window.print();
                printContainer.style.display = 'none';
            }, 500);
        } catch (error) {
            console.error('Error preparing document for printing:', error);
            printContainer.innerHTML = '<div class="print-error">Failed to prepare document for printing</div>';

            // Hide error after a delay
            setTimeout(() => {
                printContainer.style.display = 'none';
            }, 3000);
        }
    }

    async share() {
        if (!this.canShareFiles || !this.pdfData) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, this.canShareFiles ? 'No PDF available to share' : 'Sharing not supported', new FileError('No PDF or sharing unsupported'));
            return;
        }

        try {
            const pdfBytes = await this.pdf.getData();
            const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            const pdfFile = new File([pdfBlob], this.fileName, { type: 'application/pdf' });

            const shareData = {
                files: [pdfFile],
                title: this.fileName,
                text: 'Check out this PDF document!'
            };

            if (navigator.canShare(shareData)) {
                await navigator.share(shareData);
                this.showToast('PDF shared successfully!', 'success');
            } else {
                this.displayError(contentDiv, 'Cannot share PDF in this context', new InvalidInputError('Share context invalid'));
            }
        } catch (error) {
            this.displayError(contentDiv, `Failed to share PDF: ${error.message}`, error);
        }
    }

    cleanup() {
        // Cancel any pending operations
        clearTimeout(this.debounceTimeout);
        clearTimeout(this.scrollTimeout);
        clearTimeout(this.scrollStopTimeout);

        // Remove touch event listeners
        if (this.touchContainer && this.touchHandlers) {
            this.touchContainer.removeEventListener('touchstart', this.touchHandlers.touchstart);
            this.touchContainer.removeEventListener('touchmove', this.touchHandlers.touchmove);
            this.touchContainer.removeEventListener('touchend', this.touchHandlers.touchend);
            this.touchContainer.removeEventListener('touchcancel', this.touchHandlers.touchcancel);
            this.touchHandlers = null;
            this.touchContainer = null;
        }

        // Clear the rendering queue
        this.renderingQueue.clear();

        // Release resources
        if (this.pdfUrl) {
            URL.revokeObjectURL(this.pdfUrl);
            this.pdfUrl = null;
        }

        this.pdfData = null;
        this.pdf = null;

        // Remove canvases from DOM
        this.pageCanvases.forEach(canvas => {
            if (canvas) {
                canvas.remove();
            }
        });

        // Clear all arrays
        this.pageCanvases = [];
        this.pageStates = [];
        this.thumbnailStates = [];
        this.baseDimensions = [];
        this.pageViewport = [];
        this.visiblePages.clear();

        // Remove sidebar if present
        const sidebar = document.getElementById('file-viewer-sidebar');
        if (sidebar) {
            sidebar.remove();
        }
    }
}