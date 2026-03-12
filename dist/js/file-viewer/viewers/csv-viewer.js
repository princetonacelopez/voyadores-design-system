import { eventBus } from '../event-bus.js';
import { BaseViewer } from '../base-viewer.js';
import { ToolbarManager } from '../toolbar-manager.js';
import { FileUtils } from '../file-utils.js';
import { NetworkError, FileError, ServerError, InvalidInputError } from '../errors.js';

export class CSVViewer extends BaseViewer {
    constructor() {
        super();
        this.table = document.createElement('table');
        this.table.setAttribute('role', 'grid');
        this.table.setAttribute('aria-label', 'CSV Data Table');
        this.tableHead = document.createElement('thead');
        this.tableBody = document.createElement('tbody');
        this.tableResponsive = document.createElement('div');
        this.tableResponsive.className = 'table-container';
        this.tableResponsive.appendChild(this.table);
        this.table.appendChild(this.tableHead);
        this.table.appendChild(this.tableBody);

        this.currentFile = null;
        this.headers = [];
        this.data = [];
        this.rowsPerPage = 100;
        this.currentPage = 1;
        this.totalPages = 0;
        this.fileName = 'document.csv';
        this.renderedRows = 0;
        this.isLoading = false;
        this.isHeaderRendered = false;
        this.selectedRow = null;
        this.selectedColumn = null;
        this.maxColumns = 0;

        // Touch gesture properties for pinch-to-zoom
        this.touchStartDistance = 0;
        this.touchStartScale = 1.0;
        this.isPinching = false;
        this.scale = 1.0;
        this.minScale = 0.5;
        this.maxScale = 5.0;

        this.toolbarManager = new ToolbarManager(this, {
            controls: [
                { id: 'prev-page', title: 'Previous Page', icon: 'angle-left', action: this.changePage.bind(this, -1) },
                { id: 'next-page', title: 'Next Page', icon: 'angle-right', action: this.changePage.bind(this, 1) }
            ],
            share: [
                { id: 'download-csv', title: 'Download', icon: 'download', action: this.download.bind(this) },
                { id: 'print-csv', title: 'Print', icon: 'print', action: this.print.bind(this) },
                { id: 'share-csv', title: 'Share', icon: 'share', action: this.share.bind(this) }
            ]
        });
    }

    async render(input) {
        super.render(this.toolbarManager);
        const contentDiv = document.getElementById('file-viewer-content');
        if (!contentDiv) {
            throw new InvalidInputError('Viewer content container not found');
        }

        try {
            if (typeof input === 'string') {
                this.currentFile = await FileUtils.processUrl(input);
            } else if (input instanceof File) {
                this.currentFile = await FileUtils.processFile(input);
            } else if (input instanceof Blob) {
                this.currentFile = await FileUtils.processBlob(input, 'document.csv');
            } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
                this.currentFile = await FileUtils.processBytes(input, 'text/csv', 'document.csv');
            } else {
                throw new InvalidInputError('Unsupported input type');
            }

            this.fileName = this.currentFile.name || 'document.csv';
            this.toolbarManager.updateFileName(this.fileName);


            await new Promise((resolve, reject) => {
                const allRows = [];
                Papa.parse(this.currentFile, {
                    header: false,
                    dynamicTyping: true,
                    skipEmptyLines: 'greedy',
                    chunkSize: 10000,
                    fastMode: false,
                    beforeFirstChunk: () => {
                        this.maxColumns = 0;
                        this.headers = [];
                        this.data = [];
                    },
                    chunk: (results, parser) => {
                        allRows.push(...results.data);
                        // Track maximum column count, ignoring trailing empty cells
                        results.data.forEach(row => {
                            let validLength = 0;
                            for (let i = 0; i < row.length; i++) {
                                if (row[i] != null && row[i].toString().trim() !== '') {
                                    validLength = i + 1; // Update to the index of the last non-empty cell + 1
                                }
                            }
                            if (validLength > this.maxColumns) {
                                this.maxColumns = validLength;
                            }
                        });
                    },
                    complete: () => {
                        if (allRows.length === 0) {
                            reject(new FileError('CSV file is empty', 'Corrupted'));
                            return;
                        }

                        // Check if first row is a standard header
                        const firstRow = allRows[0] || [];
                        const firstRowValues = firstRow.map(val => val != null ? val.toString().trim() : '');
                        const nonEmptyCount = firstRowValues.filter(val => val !== '').length;
                        const firstValue = firstRowValues[0] || '';
                        const isStandardHeader = firstValue && !['Prepared By:', 'Date:', 'Cut-Off Date:'].some(prefix => firstValue.startsWith(prefix)) && nonEmptyCount > 2;

                        if (isStandardHeader) {
                            // Use first row as headers, stopping at the last non-empty column
                            this.headers = firstRowValues
                                .slice(0, this.maxColumns) // Limit to maxColumns
                                .map((header, index) => header !== '' ? header : `Column ${index + 1}`);
                            allRows.shift(); // Remove first row from data
                        } else {
                            // Generate headers based on maxColumns
                            this.headers = Array.from({ length: this.maxColumns }, (_, i) => `Column ${i + 1}`);
                        }

                        // Normalize all rows as data
                        this.data = allRows.map((row, rowIndex) => {
                            const normalizedRow = {};
                            this.headers.forEach((header, index) => {
                                normalizedRow[header] = index < row.length && row[index] != null ? row[index] : '';
                            });
                            return normalizedRow;
                        });

                        if (this.headers.length === 0 || this.data.length === 0) {
                            reject(new FileError('No valid data or headers found in CSV', 'Corrupted'));
                            return;
                        }

                        resolve();
                    },
                    error: (error) => {
                        reject(new FileError(`Failed to parse CSV: ${error.message || 'Unknown parsing error'}`, 'Corrupted'));
                    }
                });
            });

            if (this.headers.length === 0 || this.data.length === 0) {
                throw new FileError('No valid data or headers found in CSV');
            }

            this.totalPages = Math.ceil(this.data.length / this.rowsPerPage);

            this.renderContent(contentDiv, document.getElementById('file-viewer-toolbar'));

            if (this.isMobile) {
                this.renderInitialRows();
                this.setupInfiniteScroll();
            } else {
                this.renderPage(this.currentPage);
            }

            // Setup touch gestures for pinch-to-zoom
            this.setupTouchGestures(this.tableResponsive);
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
                else if (error.message.includes('Failed to parse CSV') || error.message.includes('No valid data or headers') || error.message.includes('CSV file is empty')) errorSubtype = 'Corrupted';
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
        if (!contentDiv || !toolbarDiv) {
            this.displayError(contentDiv || document.body, 'Viewer initialization failed', new InvalidInputError('Missing DOM elements'));
            return;
        }
        if (this.currentFile && this.headers.length > 0) {
            contentDiv.appendChild(this.tableResponsive);
            const pageInfoSpan = document.createElement('span');
            pageInfoSpan.id = 'page-info';
            pageInfoSpan.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            const toolbarControls = toolbarDiv.querySelector('.toolbar-file-controls');
            if (toolbarControls) {
                toolbarControls.insertBefore(pageInfoSpan, document.getElementById('next-page'));
            }
        }
    }

    updateStatusBar() {
        let status;
        if (this.isMobile) {
            status = `Loaded ${this.renderedRows} of ${this.data.length} items`;
        } else {
            const start = (this.currentPage - 1) * this.rowsPerPage + 1;
            const end = Math.min(this.currentPage * this.rowsPerPage, this.data.length);
            status = `Showing rows ${start} - ${end} | Total items: ${this.data.length}`;
        }
        if (this.selectedRow) status += ` | Selected Row: ${this.selectedRow}`;
        if (this.selectedColumn !== null) status += ` | Selected Column: ${this.headers[this.selectedColumn]}`;
        if (this.scale !== 1.0) status += ` | Zoom: ${(this.scale * 100).toFixed(0)}%`;
        this.statusBar.textContent = status;
    }

    setupTouchGestures(container) {
        if (!container) return;

        let touches = [];

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

        // Add touch event listeners
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: false });
        container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        // Store references for cleanup
        this.touchHandlers = {
            touchstart: handleTouchStart,
            touchmove: handleTouchMove,
            touchend: handleTouchEnd,
            touchcancel: handleTouchEnd
        };
        this.touchContainer = container;
    }

    applyZoom() {
        if (this.table) {
            // Instead of scaling the entire table (which breaks sticky positioning),
            // we'll scale the font size and cell padding for a zoom effect
            // This maintains the sticky header and row numbers functionality
            const baseFontSize = 14; // Base font size in pixels
            const basePadding = 8; // Base padding in pixels
            
            const scaledFontSize = baseFontSize * this.scale;
            const scaledPadding = basePadding * this.scale;
            
            // Apply scaled styles to table cells
            this.table.style.fontSize = `${scaledFontSize}px`;
            
            // Update padding for all cells
            const cells = this.table.querySelectorAll('th, td');
            cells.forEach(cell => {
                cell.style.padding = `${scaledPadding}px`;
            });
        }
    }

    renderInitialRows() {
        if (this.headers.length === 0 || this.data.length === 0) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No data to render', new FileError('Empty CSV data'));
            return;
        }
        this.tableHead.innerHTML = '';
        this.tableBody.innerHTML = '';
        this.renderedRows = 0;
        this.currentPage = 1;

        const headerRow = document.createElement('tr');
        const rowNumTh = document.createElement('th');
        rowNumTh.textContent = '#';
        rowNumTh.className = 'row-header clickable';
        rowNumTh.setAttribute('role', 'columnheader');
        rowNumTh.setAttribute('tabindex', '0');
        rowNumTh.setAttribute('aria-label', 'Clear row selection');
        rowNumTh.addEventListener('click', () => this.clearSelection('row'));
        rowNumTh.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.clearSelection('row');
            }
        });
        headerRow.appendChild(rowNumTh);

        this.headers.forEach((header, index) => {
            const th = document.createElement('th');
            th.textContent = header;
            th.className = 'clickable';
            th.dataset.colIndex = index;
            th.setAttribute('role', 'columnheader');
            th.setAttribute('tabindex', '0');
            th.setAttribute('aria-label', `Select column ${header}`);
            th.setAttribute('aria-selected', this.selectedColumn === index ? 'true' : 'false');
            th.addEventListener('click', () => this.selectColumn(index));
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectColumn(index);
                }
            });
            headerRow.appendChild(th);
        });
        this.tableHead.appendChild(headerRow);
        this.isHeaderRendered = true;

        const start = 0;
        const end = Math.min(this.rowsPerPage, this.data.length);
        const fragment = document.createDocumentFragment();

        for (let i = start; i < end; i++) {
            const row = this.data[i];
            const tr = document.createElement('tr');
            tr.setAttribute('aria-selected', this.selectedRow === i + 1 ? 'true' : 'false');
            const rowNumTd = document.createElement('td');
            const rowNumber = i + 1;
            rowNumTd.textContent = rowNumber;
            rowNumTd.className = 'row-number clickable';
            rowNumTd.dataset.rowIndex = rowNumber;
            rowNumTd.setAttribute('role', 'rowheader');
            rowNumTd.setAttribute('tabindex', '0');
            rowNumTd.setAttribute('aria-label', `Select row ${rowNumber}`);
            rowNumTd.addEventListener('click', () => this.selectRow(rowNumber));
            rowNumTd.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectRow(rowNumber);
                }
            });
            tr.appendChild(rowNumTd);

            this.headers.forEach((header, colIndex) => {
                const td = document.createElement('td');
                td.textContent = row[header] != null ? row[header] : '';
                td.dataset.colIndex = colIndex;
                td.setAttribute('role', 'gridcell');
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        }

        this.tableBody.appendChild(fragment);
        this.renderedRows = end;
        this.currentPage = Math.ceil(this.renderedRows / this.rowsPerPage);
        this.updateStatusBar();
        this.updateHighlights();
    }

    renderNextBatch() {
        if (this.isLoading || this.renderedRows >= this.data.length) return;

        this.isLoading = true;
        const start = this.renderedRows;
        const end = Math.min(start + this.rowsPerPage, this.data.length);
        const fragment = document.createDocumentFragment();

        for (let i = start; i < end; i++) {
            const row = this.data[i];
            const tr = document.createElement('tr');
            tr.setAttribute('aria-selected', this.selectedRow === i + 1 ? 'true' : 'false');
            const rowNumTd = document.createElement('td');
            const rowNumber = i + 1;
            rowNumTd.textContent = rowNumber;
            rowNumTd.className = 'row-number clickable';
            rowNumTd.dataset.rowIndex = rowNumber;
            rowNumTd.setAttribute('role', 'rowheader');
            rowNumTd.setAttribute('tabindex', '0');
            rowNumTd.setAttribute('aria-label', `Select row ${rowNumber}`);
            rowNumTd.addEventListener('click', () => this.selectRow(rowNumber));
            rowNumTd.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectRow(rowNumber);
                }
            });
            tr.appendChild(rowNumTd);

            this.headers.forEach((header, colIndex) => {
                const td = document.createElement('td');
                td.textContent = row[header] != null ? row[header] : '';
                td.dataset.colIndex = colIndex;
                td.setAttribute('role', 'gridcell');
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        }

        this.tableBody.appendChild(fragment);
        this.renderedRows = end;
        this.currentPage = Math.ceil(this.renderedRows / this.rowsPerPage);
        this.updateStatusBar();
        this.updateHighlights();
        this.isLoading = false;
    }

    setupInfiniteScroll() {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !this.isLoading) {
                    this.renderNextBatch();
                }
            },
            {
                root: this.tableResponsive,
                threshold: 0.1
            }
        );

        const sentinel = document.createElement('div');
        sentinel.id = 'sentinel';
        sentinel.style.height = '1px';
        this.tableResponsive.appendChild(sentinel);
        observer.observe(sentinel);

        this.tableResponsive.addEventListener('scroll', () => {
            if (this.isLoading) return;
            const { scrollTop, scrollHeight, clientHeight } = this.tableResponsive;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                this.renderNextBatch();
            }
        });
    }

    renderPage(page) {
        if (this.isMobile) return;
        if (this.headers.length === 0 || this.data.length === 0) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No data to render', new FileError('Empty CSV data'));
            return;
        }
        this.currentPage = page;

        if (!this.isHeaderRendered) {
            this.tableHead.innerHTML = '';
            const headerRow = document.createElement('tr');
            const rowNumTh = document.createElement('th');
            rowNumTh.textContent = '#';
            rowNumTh.className = 'row-header clickable';
            rowNumTh.setAttribute('role', 'columnheader');
            rowNumTh.setAttribute('tabindex', '0');
            rowNumTh.setAttribute('aria-label', 'Clear row selection');
            rowNumTh.addEventListener('click', () => this.clearSelection('row'));
            rowNumTh.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.clearSelection('row');
                }
            });
            headerRow.appendChild(rowNumTh);

            this.headers.forEach((header, index) => {
                const th = document.createElement('th');
                th.textContent = header;
                th.className = 'clickable';
                th.dataset.colIndex = index;
                th.setAttribute('role', 'columnheader');
                th.setAttribute('tabindex', '0');
                th.setAttribute('aria-label', `Select column ${header}`);
                th.setAttribute('aria-selected', this.selectedColumn === index ? 'true' : 'false');
                th.addEventListener('click', () => this.selectColumn(index));
                th.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.selectColumn(index);
                    }
                });
                headerRow.appendChild(th);
            });
            this.tableHead.appendChild(headerRow);
            this.isHeaderRendered = true;
        }

        this.tableBody.innerHTML = '';
        const start = (page - 1) * this.rowsPerPage;
        const end = Math.min(start + this.rowsPerPage, this.data.length);
        const fragment = document.createDocumentFragment();

        for (let i = start; i < end; i++) {
            const row = this.data[i];
            const tr = document.createElement('tr');
            tr.setAttribute('aria-selected', this.selectedRow === i + 1 ? 'true' : 'false');
            const rowNumTd = document.createElement('td');
            const rowNumber = i + 1;
            rowNumTd.textContent = rowNumber;
            rowNumTd.className = 'row-number clickable';
            rowNumTd.dataset.rowIndex = rowNumber;
            rowNumTd.setAttribute('role', 'rowheader');
            rowNumTd.setAttribute('tabindex', '0');
            rowNumTd.setAttribute('aria-label', `Select row ${rowNumber}`);
            rowNumTd.addEventListener('click', () => this.selectRow(rowNumber));
            rowNumTd.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectRow(rowNumber);
                }
            });
            tr.appendChild(rowNumTd);

            this.headers.forEach((header, colIndex) => {
                const td = document.createElement('td');
                td.textContent = row[header] != null ? row[header] : '';
                td.dataset.colIndex = colIndex;
                td.setAttribute('role', 'gridcell');
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        }

        this.tableBody.appendChild(fragment);
        this.updatePaginationControls();
        this.updateStatusBar();
        this.updateHighlights();
    }

    selectRow(rowNumber) {
        this.selectedRow = this.selectedRow === rowNumber ? null : rowNumber;
        this.selectedColumn = null;
        this.updateHighlights();
        this.updateStatusBar();
        this.updateAriaSelected();
    }

    selectColumn(colIndex) {
        this.selectedColumn = this.selectedColumn === colIndex ? null : colIndex;
        this.selectedRow = null;
        this.updateHighlights();
        this.updateStatusBar();
        this.updateAriaSelected();
    }

    clearSelection(type) {
        if (type === 'row') this.selectedRow = null;
        if (type === 'column') this.selectedColumn = null;
        this.updateHighlights();
        this.updateStatusBar();
        this.updateAriaSelected();
    }

    updateHighlights() {
        const rows = this.tableBody.querySelectorAll('tr');
        const headers = this.tableHead.querySelectorAll('th:not(.row-header)');

        rows.forEach(row => {
            row.querySelectorAll('td').forEach(cell => {
                cell.classList.remove('highlight-row', 'highlight-column');
            });
            row.setAttribute('aria-selected', this.selectedRow === parseInt(row.querySelector('.row-number').dataset.rowIndex) ? 'true' : 'false');
        });
        headers.forEach(th => {
            th.classList.remove('highlight-column');
            th.setAttribute('aria-selected', this.selectedColumn === parseInt(th.dataset.colIndex) ? 'true' : 'false');
        });

        if (this.selectedRow) {
            const rowIndex = this.isMobile
                ? this.selectedRow - 1
                : this.selectedRow - ((this.currentPage - 1) * this.rowsPerPage) - 1;
            if (rowIndex >= 0 && rowIndex < rows.length) {
                rows[rowIndex].querySelectorAll('td').forEach(cell => cell.classList.add('highlight-row'));
            }
        }

        if (this.selectedColumn !== null) {
            headers[this.selectedColumn].className += ' highlight-column';
            rows.forEach(row => {
                const cell = row.querySelector(`td[data-col-index="${this.selectedColumn}"]`);
                if (cell) cell.className += ' highlight-column';
            });
        }
    }

    updateAriaSelected() {
        const headers = this.tableHead.querySelectorAll('th:not(.row-header)');
        headers.forEach(th => {
            th.setAttribute('aria-selected', this.selectedColumn === parseInt(th.dataset.colIndex) ? 'true' : 'false');
        });
        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            row.setAttribute('aria-selected', this.selectedRow === parseInt(row.querySelector('.row-number').dataset.rowIndex) ? 'true' : 'false');
        });
    }

    updatePaginationControls() {
        if (this.isMobile) return;
        const pageInfo = document.getElementById('page-info');
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');

        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        } else {
            console.warn('Page info element (#page-info) not found; ensure renderContent is called before renderPage');
        }

        if (prevButton) {
            prevButton.disabled = this.currentPage === 1;
            prevButton.setAttribute('aria-disabled', this.currentPage === 1 ? 'true' : 'false');
        }

        if (nextButton) {
            nextButton.disabled = this.currentPage === this.totalPages;
            nextButton.setAttribute('aria-disabled', this.currentPage === this.totalPages ? 'true' : 'false');
        }
    }

    changePage(offset) {
        if (this.isMobile) return;
        const newPage = this.currentPage + offset;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.renderPage(newPage);
        }
    }

    download() {
        if (!this.currentFile) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No CSV file available to download', new FileError('No CSV file available'));
            return;
        }
        const link = document.createElement('a');
        const downloadUrl = URL.createObjectURL(this.currentFile);
        link.href = downloadUrl;
        link.download = this.fileName;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        this.showToast('Download successful!', 'success');
    }

    print() {
        if (!this.currentFile || this.data.length === 0) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, 'No data available to print', new FileError('No data available'));
            return;
        }

        const printContainer = document.getElementById('file-viewer-print');
        if (!printContainer) {
            this.displayError(contentDiv, 'Print container not found', new InvalidInputError('Print container missing'));
            return;
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);

        const printTable = document.createElement('table');
        printTable.className = 'print-table';

        const printHead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const rowNumTh = document.createElement('th');
        rowNumTh.textContent = '#';
        headerRow.appendChild(rowNumTh);

        this.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header || '';
            headerRow.appendChild(th);
        });
        printHead.appendChild(headerRow);
        printTable.appendChild(printHead);

        const printBody = document.createElement('tbody');
        this.data.forEach((row, index) => {
            const tr = document.createElement('tr');
            const rowNumTd = document.createElement('td');
            rowNumTd.textContent = index + 1;
            tr.appendChild(rowNumTd);

            this.headers.forEach(header => {
                const td = document.createElement('td');
                const value = row[header];
                td.textContent = value != null ? value : '';
                tr.appendChild(td);
            });
            printBody.appendChild(tr);
        });
        printTable.appendChild(printBody);

        tempContainer.appendChild(printTable);

        printContainer.innerHTML = '';
        printContainer.appendChild(printTable);
        document.body.removeChild(tempContainer);

        printContainer.style.display = 'block';
        printContainer.offsetHeight;

        setTimeout(() => {
            window.print();
            printContainer.style.display = 'none';
        }, 500);
    }

    async share() {
        if (!this.canShareFiles || !this.currentFile) {
            const contentDiv = document.getElementById('file-viewer-content');
            this.displayError(contentDiv, this.canShareFiles ? 'No CSV file available to share' : 'Sharing not supported', new FileError('No CSV or sharing unsupported'));
            return;
        }

        try {
            const limitedData = this.data.slice(0, 100);
            const csvContent = Papa.unparse(limitedData, { header: true, columns: this.headers });
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const smallerFile = new File([blob], this.fileName, { type: 'text/csv' });

            const shareData = {
                files: [smallerFile],
                title: this.fileName,
                text: 'Check out this CSV file!'
            };
            if (navigator.canShare(shareData)) {
                await navigator.share(shareData);
                this.showToast('CSV shared successfully!', 'success');
            } else {
                this.displayError(contentDiv, 'Cannot share CSV in this context', new InvalidInputError('Share context invalid'));
            }
        } catch (error) {
            this.displayError(contentDiv, `Failed to share CSV: ${error.message}`, error);
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

        this.currentFile = null;
        this.headers = [];
        this.data = [];
        this.maxColumns = 0;
        if (this.table) {
            this.table.innerHTML = '';
            this.table.remove();
            this.table = null;
        }
        if (this.tableResponsive) {
            this.tableResponsive.innerHTML = '';
            this.tableResponsive.remove();
            this.tableResponsive = null;
        }
        this.tableHead = null;
        this.tableBody = null;
    }
}