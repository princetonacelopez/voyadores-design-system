import { NetworkError, FileError, ServerError, InvalidInputError } from './errors.js';

const SUPPORTED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/svg+xml': '.svg',
    'text/csv': '.csv'
};

const TYPE_TO_EXTENSION = {
    'pdf': '.pdf',
    'csv': '.csv',
    'png': '.png',
    'jpg': '.jpg',
    'jpeg': '.jpeg',
    'svg': '.svg'
};

export const FileUtils = {
    isUrl(input) {
        // Stricter URL pattern to prevent SSRF
        const urlPattern = /^https?:\/\/([a-zA-Z0-9.-]+)(:[0-9]+)?([/]?.*)$/i;
        return urlPattern.test(input);
    },

    async processFile(file) {
        if (!(file instanceof File)) {
            throw new FileError('Invalid file provided');
        }
        if (!Object.keys(SUPPORTED_MIME_TYPES).includes(file.type)) {
            throw new FileError(`Unsupported file type: ${file.type || 'unknown'}`);
        }
        return file;
    },

    async processUrl(url, maxRetries = 3, baseDelay = 1000) {
        if (!this.isUrl(url)) {
            throw new InvalidInputError('Invalid URL provided');
        }
    
        const attemptFetch = async (attempt = 0) => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    if (response.status >= 500 && attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt);
                        console.warn(`Retry ${attempt + 1}/${maxRetries} for ${url} after ${delay}ms due to status ${response.status}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return attemptFetch(attempt + 1);
                    }
                    if (response.status >= 500) {
                        throw new ServerError(`Server error: ${response.statusText}`, response.status);
                    } else if (response.status === 404) {
                        throw new FileError('File not found');
                    } else if (response.status === 403) {
                        throw new FileError('Access denied: You are not authorized to view this file');
                    } else {
                        throw new NetworkError(`Fetch failed: ${response.statusText}`, response.status);
                    }
                }
                const blob = await response.blob();
                if (!blob.type || !Object.keys(SUPPORTED_MIME_TYPES).includes(blob.type)) {
                    throw new FileError(`Unsupported file type received: ${blob.type || 'unknown'}`);
                }
                // Extract file name and extension
                const urlParams = new URLSearchParams(url.split('?')[1] || '');
                let fileNameFromUrl;
                let actualExtension;
    
                // 1. Try Content-Disposition header first (server-sent filename)
                let fileName = 'document';
                const disposition = response.headers.get('content-disposition');
                if (disposition) {
                    const match = disposition.match(/filename\*?=['"]?(?:UTF-8''|iso-8859-1'')?([^;\r\n"']+)["']?/i);
                    if (match && match[1]) {
                        try {
                            fileName = decodeURIComponent(match[1].replace(/%/g, '%25'));
                        } catch {
                            fileName = match[1];
                        }
                    }
                }
    
                // 2. Fallback to filename query parameter if no header
                if (fileName === 'document') {
                    fileNameFromUrl = urlParams.get('filename') || urlParams.get('fileName');
                    if (fileNameFromUrl) {
                        fileName = fileNameFromUrl;
                        actualExtension = fileName.includes('.') 
                            ? `.${fileName.split('.').pop().toLowerCase()}`
                            : null;
                    }
                }
    
                // 3. If no filename, try type query parameter
                if (fileName === 'document') {
                    const typeParam = urlParams.get('type')?.toLowerCase();
                    if (typeParam && TYPE_TO_EXTENSION[typeParam]) {
                        actualExtension = TYPE_TO_EXTENSION[typeParam];
                        fileName = `document${actualExtension}`;
                    }
                }
    
                // 4. Fallback to URL path
                if (fileName === 'document') {
                    fileNameFromUrl = url.split('/').pop().split('?')[0] || 'document';
                    fileName = fileNameFromUrl;
                    actualExtension = fileName.includes('.')
                        ? `.${fileName.split('.').pop().toLowerCase()}`
                        : null;
                }
    
                // 5. If no extension, use MIME type's default
                if (!actualExtension) {
                    actualExtension = typeof SUPPORTED_MIME_TYPES[blob.type] === 'string'
                        ? SUPPORTED_MIME_TYPES[blob.type]
                        : SUPPORTED_MIME_TYPES[blob.type][0];
                    fileName = fileName.includes('.')
                        ? fileName
                        : `${fileName}${actualExtension}`;
                } else {
                    fileName = fileName.endsWith(actualExtension) ? fileName : `${fileName}${actualExtension}`;
                }
    
                // Validate extension matches MIME type
                const expectedExtensions = SUPPORTED_MIME_TYPES[blob.type];
                actualExtension = actualExtension || (fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : null);
                if (
                    (typeof expectedExtensions === 'string' && actualExtension !== expectedExtensions) ||
                    (Array.isArray(expectedExtensions) && !expectedExtensions.includes(actualExtension))
                ) {
                    console.warn(`Extension mismatch: ${actualExtension} does not match MIME type ${blob.type}`);
                    throw new FileError(`File extension ${actualExtension} does not match MIME type ${blob.type}`);
                }
    
                // Sanitize file name to prevent XSS
                const sanitizedFileName = fileName.replace(/[<>"'/\\|?*]/g, '');
                return new File([blob], sanitizedFileName, { type: blob.type });
            } catch (error) {
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch') && attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.warn(`Retry ${attempt + 1}/${maxRetries} for ${url} after ${delay}ms due to network failure`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return attemptFetch(attempt + 1);
                }
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    throw new NetworkError('Network connection failed', null);
                }
                throw error;
            }
        };
    
        return attemptFetch();
    },

    async processBlob(blob, defaultName = 'document') {
        if (!(blob instanceof Blob)) {
            throw new FileError('Invalid blob provided');
        }
        if (!blob.type || !Object.keys(SUPPORTED_MIME_TYPES).includes(blob.type)) {
            throw new FileError(`Unsupported blob type: ${blob.type || 'unknown'}`);
        }
        const sanitizedDefaultName = defaultName.replace(/[<>"'/\\|?*]/g, '');
        return new File([blob], sanitizedDefaultName, { type: blob.type });
    },

    async processBytes(bytes, type = 'application/octet-stream', defaultName = 'document') {
        if (!(bytes instanceof ArrayBuffer) && !(bytes instanceof Uint8Array)) {
            throw new FileError('Invalid bytes provided');
        }
        if (!Object.keys(SUPPORTED_MIME_TYPES).includes(type)) {
            throw new FileError(`Unsupported bytes type: ${type || 'unknown'}`);
        }
        const blob = new Blob([bytes], { type });
        const sanitizedDefaultName = defaultName.replace(/[<>"'/\\|?*]/g, '');
        return new File([blob], sanitizedDefaultName, { type });
    }
};