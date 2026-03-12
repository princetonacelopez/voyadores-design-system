import { PDFViewer } from './viewers/pdf-viewer.js';
import { ImageViewer } from './viewers/image-viewer.js';
import { CSVViewer } from './viewers/csv-viewer.js';
import { InvalidInputError } from './errors.js';

export class FileViewerFactory {
    static createViewer(fileType) {
        switch (fileType.toLowerCase()) {
            case '.pdf':
                return new PDFViewer();
            case '.png':
            case '.svg':
            case '.jpeg':
            case '.jpg':
                return new ImageViewer();
            case '.csv':
                return new CSVViewer();
            default:
                throw new InvalidInputError(`Unsupported file type: ${fileType}`);
        }
    }
}