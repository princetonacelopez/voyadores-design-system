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
        this.maxScale = 4.0;
        this.scaleStep = 0.25;
        this.imageUrl = null;

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
        this.image.style.transformOrigin = 'top center';
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