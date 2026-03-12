import { eventBus } from './event-bus.js';

export class BaseViewer {
    constructor() {
        this.fileName = 'document';
        this.isMobile = window.innerWidth <= 992;
        this.isHttps = this.checkHttpsContext();
        this.canShareFiles = this.isHttps && this.checkShareSupport();
        this.statusBar = document.createElement('div');
        this.statusBar.id = 'file-viewer-status-bar';
        this.statusBar.className = 'file-viewer-status-bar';
        this.domainURL = document.getElementById('voyadores-cdn-url').value;

        // Error image mappings with subtypes
        this.errorImages = {
            'NetworkError:ConnectionFailure': '/content/images/states/error/network/file-viewer.network-error.connection-failure.svg',
            'NetworkError:HttpStatus': '/content/images/states/error/network/file-viewer.network-error.http-status.svg',
            'FileError:NotFound': '/content/images/states/error/file/file-viewer.file-error.not-found.svg',
            'FileError:Forbidden': '/content/images/states/error/file/file-viewer.file-error.forbidden.svg',
            'FileError:InvalidType': '/content/images/states/error/file/file-viewer.file-error.invalid-type.svg',
            'FileError:InvalidInput': '/content/images/states/error/file/file-viewer.file-error.invalid-input.svg',
            'FileError:Corrupted': '/content/images/states/error/file/file-viewer.file-error.corrupted.svg',
            'FileError:NoFile': '/content/images/states/error/file/file-viewer.file-error.no-file.svg',
            'ServerError': '/content/images/states/error/server/file-viewer.server-error.svg',
            'InvalidInputError:UnsupportedType': '/content/images/states/error/file-viewer.invalid-input-type.unsupported-type.svg',
            'InvalidInputError:InvalidUrl': '/content/images/states/error/file-viewer.invalid-input-error.invalid-url.svg',
            'InvalidInputError:InvalidContext': '/content/images/states/error/file-viewer.invalid-input-error.invalid-context.svg',
            'InvalidInputError:MissingElement': '/content/images/states/error/file-viewer.invalid-input-error.missing-element.svg',
            default: '/content/images/states/error/file/file-viewer.file-error.default.svg'
        };
    }

    checkHttpsContext() {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocalhost || window.location.protocol === 'https:';
    }

    checkShareSupport() {
        if (!navigator.share || !navigator.canShare) return false;
        const dummyFile = new File([''], 'test.txt', { type: 'text/plain' });
        return navigator.canShare({ files: [dummyFile] });
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        const container = document.getElementById('file-viewer-container');
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    render(toolbarManager) {
        let container = document.getElementById('file-viewer-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'file-viewer-container';
            document.body.appendChild(container);
        }
        container.innerHTML = '';
        container.className = 'file-viewer-container';

        const toolbarDiv = toolbarManager.render();
        const contentDiv = document.createElement('div');
        contentDiv.id = 'file-viewer-content';

        const printContainer = document.createElement('div');
        printContainer.id = 'file-viewer-print';

        container.appendChild(toolbarDiv);
        container.appendChild(contentDiv);
        container.appendChild(this.statusBar);
        container.appendChild(printContainer);

        this.renderContent(contentDiv, toolbarDiv);
        this.updateStatusBar();
    }

    renderContent(contentDiv, toolbarDiv) {
        throw new Error('renderContent must be implemented by subclass');
    }

    updateStatusBar() {
        // Abstract method to be implemented by subclasses
    }

    displayError(contentDiv, message, error = null, errorSubtype = null) {
        let targetDiv = contentDiv;
        if (!targetDiv) {
            const container = document.getElementById('file-viewer-container');
            if (!container) {
                console.error('No container found for error display');
                return;
            }
            targetDiv = document.createElement('div');
            targetDiv.id = 'file-viewer-content';
            container.appendChild(targetDiv);
        }

        targetDiv.innerHTML = '';
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        errorContainer.style.textAlign = 'center';
        errorContainer.style.padding = '20px';

        const errorImage = document.createElement('img');
        const errorKey = error && errorSubtype ? `${error.name}:${errorSubtype}` : error ? error.name : 'default';
        errorImage.src = `${this.domainURL}${this.errorImages[errorKey] || this.errorImages.default}`;
        errorImage.alt = errorKey || 'Error';
        errorImage.style.maxWidth = '200px';
        errorImage.style.marginBottom = '20px';
        errorImage.onerror = () => {
            errorImage.src = this.errorImages.default;
            errorImage.alt = 'Error';
        };

        const errorMessage = document.createElement('p');
        errorMessage.textContent = message;
        errorMessage.style.color = '#d32f2f';
        errorMessage.style.fontSize = '16px';

        errorContainer.appendChild(errorImage);
        errorContainer.appendChild(errorMessage);
        targetDiv.appendChild(errorContainer);

        this.statusBar.textContent = 'Error occurred';
    }

    cleanup() {
        // To be overridden by subclasses
    }

    destroy() {
        this.cleanup();
        const container = document.getElementById('file-viewer-container');
        if (container) {
            container.innerHTML = '';
        }
        console.log('Viewer destroyed', this.constructor.name);
    }
}