/**
 * Dynamically loads the FileViewerFactory module from a CDN and renders the appropriate viewer.
 */
$(async function () {
    /** @type {string} Domain URL from input (e.g., dev or prod CDN) */
    const domainURL = $('#voyadores-cdn-url').val();

    /** @type {string} Full URL to the file viewer factory module */
    const moduleURL = `${domainURL}/content/js/file-viewer/file-viewer-factory.min.js`;


    try {
        // Dynamically import the FileViewerFactory module
        const { FileViewerFactory } = await import(moduleURL);

        // Hide the offcanvas panel
        const actionButtonOffcanvas = $('#dv-actions-offcanvas');
        actionButtonOffcanvas.offcanvas('hide');

        /**
         * Proxy for simplified URL parameter access.
         * @type {URLSearchParams}
         */
        const urlParams = new Proxy(new URLSearchParams(window.location.search), {
            get: (searchParams, prop) => searchParams.get(prop),
        });

        /** @type {string} Origin domain of the current page */
        const domain = window.location.origin;

        // Extract URL parameters
        let id              = urlParams.id;
        let filename        = urlParams.filename;
        let originalFilename = urlParams.originalFilename;
        let type            = urlParams.type; // e.g., 'pdf' when generated via Rotativa
        let unsaved         = urlParams.unsaved; // true if file is uploaded but not saved
        let key             = urlParams.key; // used for dynamic file generation URLs
        let filterParams    = decodeURIComponent(urlParams.filters);

        /** @type {string} File extension (e.g., .pdf, .csv) */
        let fileExtension = getFileExtension(filename);

        // Default to PDF if type is set but filename is missing
        if (!filename && type) {
            filename = `${filename}.pdf`;
            fileExtension = ".pdf";
        }

        /** @type {string} Endpoint to fetch the file or data */
        let endpoint = "";

        if (type === 'csv') {
            fileExtension = ".csv";
            endpoint = `${domain}/${key}?${filterParams}`;
        } else if (type === "pdf") {
            endpoint = `${domain}/${key}?id=${id}&type=${type}`;
        } else {
            endpoint = `${domain}/files/get-file?filename=${filename}&originalFilename=${originalFilename}`;
        }

        // Create and render the appropriate viewer
        const viewer = FileViewerFactory.createViewer(fileExtension);
        viewer.render(endpoint);

        /**
         * Extracts the file extension from a given filename.
         * @param {string} fileName
         * @returns {string} Lowercase file extension (e.g., '.pdf') or empty string
         */
        function getFileExtension(fileName) {
            const extensionRegex = /(\.[^.]+)$/;
            const match = extensionRegex.exec(fileName);
            return match && match[1] ? match[1].toLowerCase() : "";
        }

    } catch (error) {
        console.error('Failed to load file viewer factory:', error);
    }
});