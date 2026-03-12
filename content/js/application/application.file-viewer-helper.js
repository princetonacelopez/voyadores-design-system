/**
 * File Viewer Helper Module
 * Centralized utility for handling file viewing dialogs and URL generation
 * Uses jQuery and Bootstrap modal for dialog management
 * 
 * NESV © 2025
 */

/**
 * File viewer URL builder and dialog manager
 */
class FileViewerHelper {
    constructor(options = {}) {
        this.domainURL = options.domainURL || window.location.origin;
        this.modalSelector = options.modalSelector || '#dv-file-viewer-modal';
        this.iframeSelector = options.iframeSelector || '#ifm-file-viewer-content';

        // Expose a global closer so an iframe can directly call window.parent.closeFileViewer()
        window.closeFileViewer = this.closeFileViewer.bind(this);

        // Cross-origin fallback via postMessage
        this.boundMessageHandler = (evt) => {
            // If you know the exact origin, check: if (evt.origin !== 'https://go.voyadores.com') return;
            const msg = evt?.data;
            if (msg === 'close-modal' || msg?.type === 'esc-from-iframe') {
                this.closeFileViewer();
            }
        };
        window.addEventListener('message', this.boundMessageHandler);

        // Initialize cleanup handlers
        this.initializeCleanup();
    }

    /**
     * Build URL based on file type and context
     * @param {Object} options - URL building options
     * @param {string} options.type - File type ('pdf', 'csv', 'attachment')
     * @param {string} [options.id] - File GUID
     * @param {string} [options.key] - File key (e.g., 'accounting/invoices/view-pdf')
     * @param {string} [options.filename] -  Filename ID
     * @param {string} [options.originalFilename] - Original filename
     * @param {Object|string} [options.filters] - Additional filters for query string
     * @returns {string} Generated URL
     */
    buildFileUrl(options) {
        const {
            type,
            id,
            key,
            filename,
            originalFilename,
            filters
        } = options;

        const url = new URL(`${this.domainURL}/files/view-partial`);

        // Add parameters based on context
        if (id) url.searchParams.set('id', id);
        if (key) url.searchParams.set('key', key);
        if (type) url.searchParams.set('type', type);
        if (filename) url.searchParams.set('filename', filename);
        if (originalFilename) url.searchParams.set('originalFilename', originalFilename);

        // Handle filters - can be object or encoded string
        if (filters) {
            const filterString = typeof filters === 'string'
                ? filters
                : encodeURIComponent($.param(filters));
            url.searchParams.set('filters', filterString);
        }

        return url.toString();
    }

    /**
     * Build URL for PDF generation
     * @param {string} id - File GUID
     * @param {string} key - PDF generation key
     * @returns {string} PDF URL
     */
    buildPdfUrl(id, key) {
        return this.buildFileUrl({
            type: 'pdf',
            id,
            key
        });
    }

    /**
     * Build URL for CSV generation
     * @param {string} key - CSV generation key
     * @param {Object|string} filters - Export filters
     * @returns {string} CSV URL
     */
    buildCsvUrl(key, filters = null) {
        return this.buildFileUrl({
            type: 'csv',
            key,
            filters
        });
    }

    /**
     * Build URL for attachment viewing
     * @param {string} id - File GUID
     * @param {string} filename - Original filename
     * @param {string} originalFilename - Original Filename
     * @returns {string} Attachment URL
     */
    buildAttachmentUrl(id, filename, originalFilename) {
        return this.buildFileUrl({
            id,
            filename,
            originalFilename,
        });
    }

    /**
     * Open file viewer dialog with specified URL
     * @param {string} url - URL to load in iframe
     * @returns {Promise} Promise that resolves when dialog is opened
     */
    async openFileViewer(url) {
        return new Promise((resolve, reject) => {
            try {
                const $modal = $(this.modalSelector);
                const $iframe = $(this.iframeSelector);

                if ($modal.length === 0 || $iframe.length === 0) {
                    throw new Error('Modal or iframe element not found');
                }

                // Set iframe source
                $iframe.attr('src', url);

                // After iframe loads, attach a key listener (same-origin path)
                $iframe.one('load.fileviewer', () => {
                    try {
                        const win = $iframe[0].contentWindow;
                        // If same-origin, this succeeds; if not, it throws and we fall back to postMessage
                        win.addEventListener('keydown', (e) => {
                            if (e.key === 'Escape') this.closeFileViewer();
                        }, true); // capture to increase reliability

                        // Also expose a direct function inside the iframe
                        // so its own scripts can call window.closeParentModal()
                        win.closeParentModal = this.closeFileViewer.bind(this);
                    } catch (err) {
                        // cross-origin: ignore; child should send postMessage on ESC
                    }
                });

                // Show modal
                $modal.modal('show');

                // Resolve when modal is fully shown
                $modal.one('shown.bs.modal', () => {
                    $('iframe[src*="export-audits"]').on('load', function () {
                        try {
                            const iframeDoc = this.contentDocument || this.contentWindow.document;

                            // Add custom CSS
                            $('<style>')
                                .text(`
                    #file-viewer-content .table-container table :is(th, td):last-child
                    {
                        display: initial;
                    }

                    :where(.table-container, .print-wrapper) > table {
                        : is(th, td):last-child

                    {
                        display: initial;
                    }

                    }
                  `).appendTo($(iframeDoc).find('head'));
                            console.log('✅ Styles applied inside export-audits iframe');
                        } catch (err) {
                            console.warn('⚠️ Cannot access iframe contents (likely cross-origin):', err);
                        }
                    });
                    resolve();
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Close file viewer dialog with cleanup
     * @returns {Promise} Promise that resolves when dialog is closed
     */
    async closeFileViewer() {
        return new Promise((resolve) => {
            const $modal = $(this.modalSelector);
            if ($modal.length === 0) { resolve(); return; }

            // Hide modal
            $modal.modal('hide');

            // Resolve when modal is fully hidden
            $modal.one('hidden.bs.modal', () => {
                this.cleanup();
                resolve();
            });
        });
    }

    /**
     * Cleanup iframe and reset modal state
     */
    cleanup() {
        const $iframe = $(this.iframeSelector);
        if ($iframe.length > 0) {
            try {
                const win = $iframe[0].contentWindow;
                // We didn't keep the exact function ref above (inline), so rely on iframe unload by clearing src.
            } catch (_) { /* ignore */ }

            $iframe.attr('src', 'about:blank');
            $iframe.removeAttr('style');
        }
        $(this.modalSelector).removeData('temp');
    }

    /**
     * Handle ESC key press to close the dialog
     */
    handleEscapeKey(event) {
        // Check for ESC key (keyCode 27) or 'Escape' key
        if (event.keyCode === 27 || event.key === 'Escape') {

            // Only close if the modal is currently visible
            const $modal = $(this.modalSelector);
            if ($modal.hasClass('show') || $modal.is(':visible')) {
                event.preventDefault();
                event.stopPropagation();
                this.closeFileViewer();
            }
        }
    }

    /**
     * Initialize cleanup handlers for modal events
     */
    initializeCleanup() {
        const $modal = $(this.modalSelector);
        if ($modal.length > 0) {
            $modal.on('hidden.bs.modal.fileviewer', () => this.cleanup());
            this.boundEscapeHandler = this.handleEscapeKey.bind(this);
            $(document).on('keydown.fileviewer', this.boundEscapeHandler);
        }
    }

    /**
     * Destroy event handlers (call when removing the helper)
     */
    destroy() {
        $(this.modalSelector).off('.fileviewer');
        $(document).off('keydown.fileviewer', this.boundEscapeHandler);
        this.boundEscapeHandler = null;

        // Remove postMessage handler
        window.removeEventListener('message', this.boundMessageHandler);
        this.boundMessageHandler = null;
    }
}

/**
 * Default instance for immediate use
 */
const defaultFileViewerHelper = new FileViewerHelper();

/**
 * Convenience functions using default instance
 */
export const fileViewer = {
    // URL builders
    buildUrl: (options) => defaultFileViewerHelper.buildFileUrl(options),
    buildPdfUrl: (id, key) => defaultFileViewerHelper.buildPdfUrl(id, key),
    buildCsvUrl: (key, filters = null) => defaultFileViewerHelper.buildCsvUrl(key, filters),
    buildAttachmentUrl: (id, filename, originalFilename) => defaultFileViewerHelper.buildAttachmentUrl(id, filename, originalFilename),

    // Dialog management
    open: (url) => defaultFileViewerHelper.openFileViewer(url),
    close: () => defaultFileViewerHelper.closeFileViewer()
};

// Named exports
export { FileViewerHelper };

// Default export
export default fileViewer;