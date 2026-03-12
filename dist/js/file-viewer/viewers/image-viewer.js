import { eventBus } from '../event-bus.js';
import { BaseViewer } from '../base-viewer.js';
import { ToolbarManager } from '../toolbar-manager.js';
import { FileUtils } from '../file-utils.js';
import { NetworkError, FileError, ServerError, InvalidInputError } from '../errors.js';

export class ImageViewer extends BaseViewer {
    constructor() {
        super();
        this.image = document.createElement('img');
        this.imageContainer = document.createElement('div');
        this.imageContainer.className = 'image-container';
        this.imageContainer.appendChild(this.image);

        this.currentFile = null;
        this.fileName = 'document.jpg';
        this.scale = 1.0;
        this.minScale = 0.5;
        this.maxScale = 5.0;
        this.scaleStep = 0.25;
        this.imageUrl = null;

        // Touch gesture properties for pinch-to-zoom
        this.touchStartDistance = 0;
        this.touchStartScale = 1.0;
        this.isPinching = false;

        this.toolbarManager = new ToolbarManager(this, {
            controls: [
                { id: 'zoom-in', title: 'Zoom In', icon: 'plus', action: this.zoomIn.bind(this) },
                { id: 'zoom-out', title: 'Zoom Out', icon: 'minus', action: this.zoomOut.bind(this) },
                { id: 'reset-zoom', title: 'Reset Zoom', icon: 'arrows-left-right', action: this.resetZoom.bind(this) }
            ],
            share: [
                { id: 'download-image', title: 'Download', icon: 'download', action: this.download.bind(this) },
                { id: 'print-image', title: 'Print', icon: 'print', action: this.print.bind(this) },
                { id: 'share-image', title: 'Share', icon: 'share', action: this.share.bind(this) }
            ]
        });
    }

    async render(input) {
        super.render(this.toolbarManager);
        const contentDiv = document.getElementById('file-viewer-content');

        try {
            if (typeof input === 'string') {
                this.currentFile = await FileUtils.processUrl(input);
            } else if (input instanceof File) {
                this.currentFile = await FileUtils.processFile(input);
            } else if (input instanceof Blob) {
                this.currentFile = await FileUtils.processBlob(input, 'document.jpg');
            } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
                this.currentFile = await FileUtils.processBytes(input, 'image/jpeg', 'document.jpg');
            } else {
                throw new InvalidInputError('Unsupported input type');
            }

            this.fileName = this.currentFile.name || 'document.jpg';
            this.toolbarManager.updateFileName(this.fileName);

            this.renderContent(contentDiv, document.getElementById('file-viewer-toolbar'));

            this.imageUrl = URL.createObjectURL(this.currentFile);
            this.image.src = this.imageUrl;
            this.image.onload = () => {
                this.updateStatusBar();
                // Setup touch gestures after image loads
                this.setupTouchGestures(contentDiv);
            };
            this.image.onerror = () => {
                this.displayError(contentDiv, 'Failed to load image: Invalid or corrupted image file', new FileError('Invalid image'), 'Corrupted');
            };
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
                errorMessage = error.message;
            } else if (error instanceof ServerError) {
                errorMessage = `Server error: ${error.message} (Status: ${error.status})`;
            } else if (error instanceof InvalidInputError) {
                errorSubtype = error.message.includes('URL') ? 'InvalidUrl' : 'UnsupportedType';
                errorMessage = error.message;
            }
            this.displayError(contentDiv, errorMessage, error, errorSubtype);
        }
    }

    renderContent(contentDiv, toolbarDiv) {
        if (this.currentFile) {
            contentDiv.appendChild(this.imageContainer);
        }
    }

    updateStatusBar() {
        this.statusBar.textContent = `Scale: ${(this.scale * 100).toFixed(0)}%`;
    }

    zoomIn() {
        this.scale = Math.min(this.maxScale, this.scale + this.scaleStep);
        this.applyZoom();
        this.updateStatusBar();
    }

    zoomOut() {
        this.scale = Math.max(this.minScale, this.scale - this.scaleStep);
        this.applyZoom();
        this.updateStatusBar();
    }

    resetZoom() {
        this.scale = 1.0;
        this.applyZoom();
        this.updateStatusBar();
    }

    applyZoom() {
        this.image.style.transform = `scale(${this.scale})`;
        this.image.style.transformOrigin = 'center center';
    }

    setupTouchGestures(contentDiv) {
        let touches = [];
        let initialPinchCenter = null;

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
                
                // Calculate the center point of the pinch gesture
                initialPinchCenter = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
                
                // Remember the scale at the start of the pinch
                this.touchStartScale = this.scale;
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
                if (Math.abs(newScale - this.scale) > 0.01) {
                    this.scale = newScale;
                    this.applyZoom();
                    this.updateStatusBar();
                }
            }
        };

        const handleTouchEnd = (e) => {
            if (this.isPinching) {
                e.preventDefault();
                this.isPinching = false;
            }
            
            touches = Array.from(e.touches);
            
            // Reset if no more touches
            if (touches.length === 0) {
                this.touchStartDistance = 0;
                this.touchStartScale = 1.0;
            }
        };

        // Add touch event listeners to the content div
        contentDiv.addEventListener('touchstart', handleTouchStart, { passive: false });
        contentDiv.addEventListener('touchmove', handleTouchMove, { passive: false });
        contentDiv.addEventListener('touchend', handleTouchEnd, { passive: false });
        contentDiv.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        // Store references for cleanup
        this.touchHandlers = {
            touchstart: handleTouchStart,
            touchmove: handleTouchMove,
            touchend: handleTouchEnd,
            touchcancel: handleTouchEnd
        };
        this.touchContainer = contentDiv;
    }

    download() {
        if (!this.currentFile) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No image available to download', new FileError('No image available'));
            return;
        }
        const link = document.createElement('a');
        const downloadUrl = URL.createObjectURL(this.currentFile);
        link.href = downloadUrl;
        link.download = this.fileName;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        this.showToast('Image downloaded successfully!', 'success');
    }

    print() {
        if (!this.currentFile) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No image available to print', new FileError('No image available'));
            return;
        }

        const printContainer = document.getElementById('file-viewer-print');
        if (!printContainer) {
            this.displayError(contentDiv, 'Print container not found', new InvalidInputError('Print container missing'));
            return;
        }

        printContainer.innerHTML = '';

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);

        const printImage = document.createElement('img');
        printImage.src = this.imageUrl || URL.createObjectURL(this.currentFile);
        printImage.style.maxWidth = '100%';

        tempContainer.appendChild(printImage);

        printImage.onload = () => {
            printContainer.appendChild(printImage);
            document.body.removeChild(tempContainer);

            printContainer.style.display = 'block';
            printContainer.offsetHeight;

            setTimeout(() => {
                window.print();
                printContainer.style.display = 'none';
            }, 500);
        };

        printImage.onerror = () => {
            this.displayError(contentDiv, 'Image failed to load for printing', new FileError('Image load failed'));
            document.body.removeChild(tempContainer);
        };
    }

    async share() {
        if (!this.canShareFiles || !this.currentFile) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, this.canShareFiles ? 'No image available to share' : 'Sharing not supported', new FileError('No image or sharing unsupported'));
            return;
        }

        try {
            const shareData = {
                files: [this.currentFile],
                title: this.fileName,
                text: 'Check out this image!'
            };
            if (navigator.canShare(shareData)) {
                await navigator.share(shareData);
                this.showToast('Image shared successfully!', 'success');
            } else {
                this.displayError(contentDiv, 'Cannot share image in this context', new InvalidInputError('Share context invalid'));
            }
        } catch (error) {
            this.displayError(contentDiv, `Failed to share image: ${error.message}`, error);
        }
    }

    cleanup() {
        // Remove touch event listeners
        if (this.touchContainer && this.touchHandlers) {
            this.touchContainer.removeEventListener('touchstart', this.touchHandlers.touchstart);
            this.touchContainer.removeEventListener('touchmove', this.touchHandlers.touchmove);
            this.touchContainer.removeEventListener('touchend', this.touchHandlers.touchend);
            this.touchContainer.removeEventListener('touchcancel', this.touchHandlers.touchcancel);
            this.touchHandlers = null;
            this.touchContainer = null;
        }

        if (this.imageUrl) {
            URL.revokeObjectURL(this.imageUrl);
            this.imageUrl = null;
        }
        this.currentFile = null;
        if (this.image) {
            this.image.src = '';
            this.image.remove();
            this.image = null;
        }
        if (this.imageContainer) {
            this.imageContainer.innerHTML = '';
            this.imageContainer.remove();
            this.imageContainer = null;
        }
    }
}