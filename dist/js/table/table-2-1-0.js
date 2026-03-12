/*!
 * jQuery Custom Table Plugin v2.1.0
 * Advanced data table with sortable columns, resizable columns, and drag-to-reorder
 * 
 * (c) 2025 Network Economic Services Ventures Philippines, Inc.
 * Date: 09/26/2025
 * All rights reserved.
 * 
 * Features:
 * - Column sorting with visual indicators
 * - Column resizing
 * - Column reordering via drag-and-drop
 * - Responsive design (desktop-only interactive features)
 * - AJAX data loading with pagination
 * - Customizable empty states and error messages
 * - Accessibility compliant (ARIA attributes)
 */

(function ($) {
    'use strict';

    // ==========================================================================
    // DEFAULT CONFIGURATION
    // ==========================================================================

    /**
     * Default plugin configuration options
     * @type {Object}
     */
    const defaultConfig = {
        // AJAX Configuration
        endpoint: "",                   // API endpoint URL for data fetching
        params: () => ({}),           // Function returning query parameters
        async: true,                 // Enable asynchronous AJAX requests
        transformData: null,                 // Function to transform API response data

        // Data Mapping
        mappingFunction: () => "",             // Function to map data to table rows HTML
        data: [],                   // Local data array (used when no endpoint)

        // Callback Functions
        success: () => "",             // Success callback after data load
        fail: () => "",             // Failure callback on error

        // UI Messages
        messageNoResultHeader: 'No data found',
        messageNoResult: `There's nothing to display here at the moment.`,
        messageNoPermission: `You don't have permission to view this content.`,
        messageErrorOccured: `There's a problem loading this content. Please try again later.`,
        messageNotFound: `The content you're looking for isn't available. It might have been moved or deleted.`,
        messageLoading: 'Loading data...',

        // UI Styling
        cssClassNoResult: '',                   // Additional CSS class for empty state
        imageEmpty: '/content/images/states/empty/voyadores.default.empty.svg',

        // Table Features
        rowCounter: true,                 // Show row numbers in first column
        minViewportWidth: 1280,                 // Minimum width for interactive features (px)

        // Header Configuration
        headers: {
            hideOnEmpty: false,                // Hide header row when table is empty
            columns: [],                   // Column definitions array
            columnReorder: true                  // Enable drag-to-reorder columns
        },

        // Load More Configuration
        loadMore: {
            id: "",                   // Element ID for load more button
            hideOnEmpty: true,                 // Hide button when no more data
            showOnPageSize: 20,                   // Show button only if page size >= this value
            onEmpty: () => "",             // Callback when no more data available
        },
    };

    /**
     * Global page counter for pagination
     * Increments throughout lifecycle until new table instance is created
     * @type {number}
     */
    let pageCount = 1;

    // ==========================================================================
    // PLUGIN ENTRY POINT
    // ==========================================================================

    /**
     * jQuery plugin initialization
     * @param {Object|string} options - Configuration object or command string
     * @param {*} params - Additional parameters for commands
     * @returns {jQuery} jQuery object for chaining
     */
    $.fn.table = function (options, params) {
        // Reset page count for new instance
        pageCount = 1;

        if (typeof (options) === 'object') {
            initialize(options, this);
        } else if (typeof options === "string") {
            handleStringCommand(options, params, this);
        }

        return this;
    };

    /**
     * Check if a table is being initialized for the first time
     * @param {jQuery|string} tableElement - Table element or ID
     * @returns {boolean} True if this is the first time initialization
     */
    $.fn.table.isFirstTimeInit = function (tableElement) {
        const $table = typeof tableElement === 'string' ? $(`#${tableElement}`) : $(tableElement);
        return $table.data('firstTimeInit') === true;
    };

    /**
     * Check if a table has been initialized
     * @param {jQuery|string} tableElement - Table element or ID
     * @returns {boolean} True if table has been initialized
     */
    $.fn.table.isInitialized = function (tableElement) {
        const $table = typeof tableElement === 'string' ? $(`#${tableElement}`) : $(tableElement);
        return $table.data('isInitialized') === true;
    };

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================

    /**
     * Initialize the table plugin with user configuration
     * @param {Object} options - User configuration options
     * @param {jQuery} self - Table element
     */
    function initialize(options, self) {
        const $table = $(self);
        const id = $table.attr("id");

        if (!id) {
            console.warn('Table element must have an ID attribute');
            return;
        }

        // Check if this is the first time initialization
        const isFirstTimeInit = !$table.hasClass('table-custom') && !$table.data('config');

        // Store table reference and ID in options
        options._id = id;
        options._self = $table;
        options._isFirstTimeInit = isFirstTimeInit;

        // Merge user options with defaults
        const userOptions = $.extend(true, {}, defaultConfig, options);

        // Store configuration in table data
        $table.data("config", userOptions);

        // Mark table as initialized
        $table.data("isInitialized", true);
        $table.data("firstTimeInit", isFirstTimeInit);

        // Add scoping class for CSS targeting
        $table.addClass("table-custom");

        // Dynamically load Sortable.js library if needed
        if (typeof Sortable === 'undefined' && !window.sortableLoading) {
            window.sortableLoading = true;
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
            script.onload = () => {
                window.sortableLoading = false;
                window.sortableLoaded = true;
            };
            document.head.appendChild(script);
        }

        // Initial data load
        refresh(userOptions);

        // Mark first-time initialization as complete
        if (isFirstTimeInit) {
            $table.data("firstTimeInit", false);
            userOptions._isFirstTimeInit = false;
        }

        // Setup responsive behavior for interactive features
        handleResponsiveColumnFeatures(userOptions);
    }

    // ==========================================================================
    // RESPONSIVE HANDLING
    // ==========================================================================

    /**
     * Enable/disable interactive column features based on viewport width
     * Features are only active on desktop (above minViewportWidth)
     * @param {Object} options - Plugin configuration
     */
    function handleResponsiveColumnFeatures(options) {
        // Debounce resize handler to avoid excessive calls
        let resizeTimer;
        let layoutTimer;
        $(window).off(`resize.table-${options._id}`).on(`resize.table-${options._id}`, function () {
            const $table = options._self;
            const isDesktop = window.innerWidth >= options.minViewportWidth;

            // Switch to auto layout immediately during resize on desktop only
            if (isDesktop && $table.css('table-layout') === 'fixed') {
                $table.css('table-layout', 'auto');
                clearTimeout(layoutTimer);
            }

            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (isDesktop) {
                    // Enable features on desktop (above minimum viewport width)
                    if (options.headers.columnReorder) {
                        enableColumnReordering(options);
                    }
                    enableColumnResizing(options);

                    // Switch back to fixed layout after resize is complete with width recalculation
                    layoutTimer = setTimeout(function () {
                        applyTableLayoutConstraints(options, true); // Pass true for resize recalculation
                    }, 100); // Short delay to ensure resize is complete
                } else {
                    // Disable features on mobile/tablet (below minimum viewport width)
                    disableColumnFeatures(options);
                }
            }, 250); // 250ms debounce
        });
    }

    function disableColumnFeatures(options) {
        const $table = options._self;

        // Destroy Sortable.js instance if exists
        const existingSortable = $table.data('sortableInstance');
        if (existingSortable && existingSortable.destroy) {
            existingSortable.destroy();
            $table.removeData('sortableInstance');
        }

        // Remove all column resizing event handlers
        $table.off('mousedown.columnResize mousemove.columnResize mouseup.columnResize');
        $table.off('mouseenter.columnResizeHover mouseleave.columnResizeHover');
        $(document).off('mousemove.columnResize mouseup.columnResize');

        // Remove visual indicators and UI elements
        $table.find('.col-resize-indicator').remove();
        $table.find('.col-resize-cursor-area').remove();
        $table.find('.col-body-indicator').remove();

        // Clean up CSS classes
        $table.find('th').removeClass('col-draggable col-resizable');
        $table.removeClass('col-table-resizing col-dragging');

        // Remove column highlight overlays
        $table.find('td.col-drag-highlight').removeClass('col-drag-highlight');
        $table.find('.col-highlight-overlay').remove();
    }

    // ==========================================================================
    // COMMAND HANDLING
    // ==========================================================================

    /**
     * Handle string commands for table operations (refresh, clear, etc.)
     * @param {string} command - Command name ('refresh', 'clear')
     * @param {*} params - Command parameters
     * @param {jQuery} self - Table element
     */
    function handleStringCommand(command, params, self) {
        const $table = $(self);
        const storedOptions = $table.data("config") || null;

        if (!storedOptions) {
            throw new Error(`Unable to trigger '${command}'. No existing instance found with the id of '${$table.attr("id")}'.`);
        }

        // Handle 'refresh' command
        if (command === "refresh") {
            if ($.isArray(params)) {
                const isValid = validateDataStructure(params);
                storedOptions.data = isValid ? params : [];
            }
            else if (typeof params === "object") {
                storedOptions.params = () => params;
            }
            else if (typeof params === "function") {
                storedOptions.params = params;
            }
        }

        // Handle 'clear' command
        if (command === "clear") {
            clearTableBody(storedOptions);
            return;
        }

        refresh(storedOptions);
    }

    // ==========================================================================
    // DATA LOADING & REFRESH
    // ==========================================================================

    /**
     * Refresh table data from endpoint or local data source
     * @param {Object} options - Plugin configuration
     */
    function refresh(options) {
        // Show loading state
        generateTableBody(options);
        loadMore(options, []);

        // Handle local data (no AJAX endpoint)
        if (!options.endpoint) {
            // Transform data if transformer function provided
            if (options.transformData && typeof options.transformData === "function") {
                options.data = options.transformData(options.data);
            }

            setupHeaders(options);
            generateTableBody(options, 200);
            loadMore(options, options.data, 200);
            options.success(options.data);
            return;
        }

        // Handle remote data via AJAX
        handleAjaxCall(options, (data, status) => {
            if (status === 200) {
                options.data = data;
                setupHeaders(options);
                generateTableBody(options, 200);
                options.success(data);
            } else if (status === 404) {
                generateTableBody(options, 404);
            } else if (status === 500) {
                generateTableBody(options, 500);
            }
            loadMore(options, data, status);
        });
    }

    /**
     * Setup load more button functionality for pagination
     * @param {Object} options - Plugin configuration
     * @param {Array} data - Current data array
     * @param {number} status - HTTP status code
     */
    function loadMore(options, data, status) {
        const loadMoreConfig = options.loadMore;

        // Skip if configuration is invalid
        if ($.isArray(loadMoreConfig) || !loadMoreConfig.id) return;

        const element = $(`#${loadMoreConfig.id}`).show();

        // Hide button if no more data available
        if (status !== 200 || !data.length || data.length < loadMoreConfig.showOnPageSize) {
            return element.hide();
        }

        // Attach click handler for loading next page
        element.off().click(function () {
            $(this).prop("disabled", true);
            const page = pageCount += 1;

            handleAjaxCall(options, (data, status) => {
                $(this).prop("disabled", false);

                if (status !== 200) return;

                if (data.length > 0) {
                    processNewPagedData(options, data);
                } else {
                    loadMoreConfig.onEmpty(this);
                    if (!loadMoreConfig.hideOnEmpty) return;
                    element.hide();
                }
            }, page);
        });
    }

    /**
     * Process and append new paged data to existing dataset
     * Maintains active sort if present
     * @param {Object} options - Plugin configuration
     * @param {Array} data - New page data
     */
    function processNewPagedData(options, data) {
        const $table = options._self;
        const activeSort = getActiveHeaderSort(options);

        // Append new data to existing dataset
        options.data.push(...data);

        if (activeSort) {
            // Re-sort combined dataset if column is actively sorted
            sortData(options.data, activeSort.sortBy, activeSort.sort);
            onSuccess(options);
            addColumnSortIndicator($table, activeSort.colIndex);
        } else {
            onSuccess(options);
        }
    }

    /**
     * Get information about currently active column sort
     * @param {Object} options - Plugin configuration
     * @returns {Object|null} Active sort info or null
     */
    function getActiveHeaderSort(options) {
        const activeSortHeader = options._self.find("thead th[aria-sort] .col-sort-btn");
        if (activeSortHeader.length === 0) return null;

        const sortBy = activeSortHeader.attr("data-sort-by");
        const colIndex = activeSortHeader.attr("data-column-index");
        const currentSort = activeSortHeader.closest('th').attr('aria-sort');
        const sort = currentSort === "ascending" ? "asc" : "desc";

        return { sort, sortBy, colIndex };
    }

    /**
     * Execute AJAX call to fetch data from endpoint
     * @param {Object} options - Plugin configuration
     * @param {Function} callback - Callback function(data, statusCode)
     * @param {number} page - Page number for pagination
     */
    function handleAjaxCall(options, callback, page = 1) {
        let queryString = `page=${page}`;

        if (typeof options.params === "function") {
            const queryParams = options.params();
            if (typeof queryParams === "object" && !$.isArray(queryParams)) {
                queryString = `${$.param(queryParams)}&page=${page}`;
            }
        } else {
            throw new TypeError(`The option 'params' for #${options._id} must be a function.`);
        }

        const apiUrl = `${options.endpoint}?${queryString}`;

        const parameters = {
            url: apiUrl,
            context: document.body,
            dataType: 'json',
            async: options.async,
            complete: function (response) {
                const statusCode = response.status;
                let data = response.responseJSON;

                if (options.transformData && typeof options.transformData === "function") {
                    data = options.transformData(data);
                }

                const isValid = validateDataStructure(data);

                if (callback && typeof callback === "function") {
                    callback(isValid ? data : [], statusCode);
                }
            }
        };

        $.ajax(parameters);
    }

    // ==========================================================================
    // HEADER MANAGEMENT
    // ==========================================================================

    /**
     * Setup table headers with sorting, resizing, and reordering capabilities
     * Handles both initial setup and refresh scenarios
     * @param {Object} options - Plugin configuration
     */
    function setupHeaders(options) {
        const columns = options.headers.columns;
        const hasData = options.data && $.isArray(options.data) && options.data.length > 0;

        if (!$.isArray(columns) || !hasData) return;

        const thead = options._self.find('thead');
        const theadChildren = [...thead.find("tr").children()];

        if (!thead || theadChildren.length === 0) return;

        // Use the first-time initialization flag to determine setup approach
        const isFirstTimeInit = options._isFirstTimeInit;

        // Log initialization status for debugging
        if (isFirstTimeInit) {
            console.debug(`Table #${options._id}: First-time initialization detected`);
        } else {
            console.debug(`Table #${options._id}: Refresh/update operation`);
        }

        // Check if headers already exist (refresh scenario - preserve current order)
        const existingHeaders = !isFirstTimeInit && theadChildren.length > 0 &&
            ($(theadChildren[0]).hasClass('col-sortable') || thead.find('.col-sort-btn[data-sort-by]').length > 0);

        if (existingHeaders) {
            // Update existing headers without rebuilding HTML
            updateColumnIndices(options._self);
            sortEventHandler(thead.find("tr .col-sort-btn"), options);

            // Reset column widths to allow fresh calculation
            resetColumnWidths(options._self);

            // Update existing headers with resizable information from config
            updateExistingHeadersWithResizable(options, columns, theadChildren);

            // Re-enable column reordering to maintain functionality
            if (options.headers.columnReorder) {
                enableColumnReordering(options);
            }

            // Enable column resizing for existing headers
            enableColumnResizing(options);
            return;
        }

        // Initial setup: validate sortable columns
        const sortableColumns = columns.filter(column => column.sortable === true);

        sortableColumns.forEach(column => {
            const contextValues = options.data.map(obj => obj[column.context] ?? "");
            if (!contextValues.every(c => typeof c === "string" || typeof c === "number")) {
                console.warn(`Unable to set column '${column.column}' as sortable. The context '${column.context}' is not of type string or number.`);
                // Remove invalid sortable columns
                const index = sortableColumns.findIndex(a => a.context === column.context);
                if (index >= 0) {
                    sortableColumns.splice(index, 1);
                }
            }
        });

        // Build new headers
        const theadHtml = buildHeaders(columns, theadChildren, options.rowCounter, options._id);
        thead.html(theadHtml);
        sortEventHandler(thead.find("tr .col-sort-btn"), options);

        // Apply table layout and width constraints for new headers
        applyTableLayoutConstraints(options);

        // Enable column resizing for new headers
        enableColumnResizing(options);
    }

    /**
     * Reset all column widths to allow fresh calculation on table refresh
     * Removes inline styles while preserving data attributes
     * @param {jQuery} $table - Table element
     */
    function resetColumnWidths($table) {
        // Reset table layout to auto for fresh calculation
        $table.css({
            'table-layout': 'auto',
            'width': '100%',
            'min-width': ''
        });

        // Remove inline width styles from all header cells (preserve data attributes)
        $table.find('thead th').each(function () {
            const $th = $(this);
            $th.css('width', '');
        });

        // Remove inline width styles from all body cells
        $table.find('tbody td').each(function () {
            $(this).css('width', '');
        });
    }

    /**
     * Update existing headers with resizable configuration on refresh
     * Applies width constraints without rebuilding header HTML
     * @param {Object} options - Plugin configuration
     * @param {Array} columns - Column configuration array
     * @param {Array} theadChildren - Existing header elements
     */
    function updateExistingHeadersWithResizable(options, columns, theadChildren) {
        const isCounted = $(theadChildren[0]).hasClass("row-counter");

        theadChildren.forEach((childHeader, idx) => {
            const $th = $(childHeader);
            const colIndex = options.rowCounter && isCounted ? idx : (options.rowCounter && !isCounted ? idx + 1 : idx);
            const resizableColumn = columns.find(a => a.column === colIndex || a.column === $th.text().trim());

            // Check if this is a non-interactive column (row-counter, checkbox, radio, or "#")
            if (isNonInteractiveColumn($th)) {
                // Only set fixed width for specific column types (not Action columns)
                if (shouldHaveFixedWidth($th)) {
                    $th.attr('data-fixed-width', '56');
                }
                $th.removeClass('col-resizable');
                return; // Skip further processing for non-interactive columns
            }

            // Check for col-icon class and set data attribute for fixed width (but not for col-freeze columns)
            if ($th.hasClass('col-icon') && !$th.hasClass('col-freeze')) {
                $th.attr('data-fixed-width', '56');
            }

            // Find column config for width constraints (independent of resizable setting)
            const columnConfig = columns.find(a => a.column === colIndex || a.column === $th.text().trim());

            // Apply width constraints if defined (regardless of resizable setting)
            if (columnConfig) {
                // Set min-width data attribute for resize constraints
                if (columnConfig.minWidth) {
                    let minWidth = columnConfig.minWidth;
                    // Account for sortable icon space to prevent overflow
                    if ($th.hasClass('sortable') && $th.find('a.sort').length > 0) {
                        minWidth = Math.max(minWidth, 60); // 40px padding + 20px buffer
                    }
                    $th.attr('data-min-width', minWidth);
                } else if ($th.hasClass('sortable') && $th.find('a.sort').length > 0) {
                    // Set minimum width for sortable columns without explicit minWidth
                    $th.attr('data-min-width', 60);
                }

                // Store width constraints as data attributes for two-phase layout
                if (columnConfig.maxWidth) {
                    $th.attr('data-max-width', columnConfig.maxWidth);
                }

                // Don't set initial widths here - let two-phase layout system handle it
                // This allows natural content-based sizing in phase 1

            }

            // Use helper function to check for non-interactive columns
            const isNonInteractive = isNonInteractiveColumn($th);

            if (resizableColumn && resizableColumn.resizable === true && !isNonInteractive) {
                // Add resizable class if not present
                if (!$th.hasClass('col-resizable')) {
                    $th.addClass('col-resizable');
                }

                // Add data attributes
                $th.attr('data-resizable', 'true');

                // Add resize cursor area if not present
                if ($th.find('.col-resize-cursor-area').length === 0) {
                    $th.append(`<div class="col-resize-cursor-area" data-column-index="${colIndex}" title="Drag to resize column"></div>`);
                }
            } else {
                $th.removeClass('col-resizable');
                $th.removeAttr('data-resizable');
                $th.find('.col-resize-cursor-area').remove();
            }
        });

        // Apply table layout constraints after processing all columns
        applyTableLayoutConstraints(options);
    }

    function applyTableLayoutConstraints(options, isResizeRecalculation = false) {
        const $table = options._self;

        // Phase 1: Start with auto layout to let browser calculate natural widths
        $table.css({
            'table-layout': 'auto',
            'width': '100%'
        });

        // Use requestAnimationFrame to ensure DOM has rendered before measuring
        requestAnimationFrame(() => {
            // Allow one more frame for complete rendering
            requestAnimationFrame(() => {
                const $theadRow = $table.find('thead tr');
                const columnWidths = [];
                let totalNaturalWidth = 0;
                let hasConstraints = false;
                const availableWidth = $table.parent().width() || $table.width();

                // Phase 1: Measure natural widths and apply constraints
                $theadRow.children('th').each(function () {
                    const $th = $(this);
                    const naturalWidth = $th.outerWidth(); // Get browser-calculated width
                    const minWidth = parseInt($th.attr('data-min-width') || '0');
                    const maxWidth = parseInt($th.attr('data-max-width') || '999999');
                    const fixedWidth = parseInt($th.attr('data-fixed-width') || '0');

                    let finalWidth = naturalWidth;

                    // Check for fixed width first (takes priority)
                    if (fixedWidth > 0) {
                        finalWidth = fixedWidth;
                        hasConstraints = true;
                    }
                    // Apply width constraints while preserving natural sizing
                    else if (minWidth > 0 && naturalWidth < minWidth) {
                        finalWidth = minWidth;
                        hasConstraints = true;
                    } else if (maxWidth < 999999 && naturalWidth > maxWidth) {
                        finalWidth = maxWidth;
                        hasConstraints = true;
                    }

                    columnWidths.push(finalWidth);
                    totalNaturalWidth += finalWidth;
                });

                // Phase 1.5: Redistribute widths to fill available space if needed
                if (isResizeRecalculation && totalNaturalWidth < availableWidth) {
                    const gap = availableWidth - totalNaturalWidth;
                    const flexibleColumns = [];

                    // Find columns that can be expanded (not fixed-width like icons/counters)
                    $theadRow.children('th').each(function (index) {
                        const $th = $(this);
                        const fixedWidth = parseInt($th.attr('data-fixed-width') || '0');
                        // Skip columns with fixed width
                        if (fixedWidth === 0) {
                            const maxWidth = parseInt($th.attr('data-max-width') || '999999');
                            if (columnWidths[index] < maxWidth) {
                                flexibleColumns.push(index);
                            }
                        }
                    });

                    // Distribute the gap proportionally among flexible columns
                    if (flexibleColumns.length > 0) {
                        const totalFlexWidth = flexibleColumns.reduce((sum, index) => sum + columnWidths[index], 0);
                        const distributionRatio = gap / totalFlexWidth;

                        flexibleColumns.forEach(index => {
                            const $th = $theadRow.children('th').eq(index);
                            const maxWidth = parseInt($th.attr('data-max-width') || '999999');
                            const additionalWidth = columnWidths[index] * distributionRatio;
                            const newWidth = Math.min(columnWidths[index] + additionalWidth, maxWidth);
                            columnWidths[index] = newWidth;
                        });

                        totalNaturalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
                        hasConstraints = true;
                    }
                }

                // Apply calculated widths to header cells
                $theadRow.children('th').each(function (index) {
                    const $th = $(this);
                    if (hasConstraints || isResizeRecalculation) {
                        $th.css('width', columnWidths[index] + 'px');
                    }
                });

                // Apply widths to body cells if constraints were applied
                if (hasConstraints || isResizeRecalculation) {
                    $table.find('tbody tr').each(function () {
                        const $row = $(this);
                        $row.children().each(function (index) {
                            if (columnWidths[index]) {
                                $(this).css('width', columnWidths[index] + 'px');
                            }
                        });
                    });
                }

                // Ensure table accommodates all columns
                const containerWidth = $table.parent().width() || $(window).width();
                if (totalNaturalWidth > containerWidth * 0.95) {
                    $table.css({
                        'min-width': totalNaturalWidth + 'px',
                        'width': totalNaturalWidth + 'px'
                    });
                } else if (isResizeRecalculation) {
                    // Ensure table fills available width after resize
                    $table.css('width', '100%');
                }

                // Phase 2: Switch to fixed layout for consistent performance
                // Add a small delay to ensure all width calculations are complete
                setTimeout(() => {
                    $table.css('table-layout', 'fixed');
                }, 10);
            });
        });
    }

    // ==========================================================================
    // COLUMN SORTING
    // ==========================================================================

    /**
     * Attach click event handlers to sortable column headers
     * Prevents sorting during drag or resize operations
     * @param {jQuery} sortableHeaders - Collection of sortable header buttons
     * @param {Object} options - Plugin configuration
     */
    function sortEventHandler(sortableHeaders, options) {
        const $table = options._self;

        sortableHeaders.off().click(function (e) {
            // Prevent sorting during drag operation
            if ($(this).closest('th').data('isDragging')) {
                return false;
            }

            // Prevent sorting during resize operation
            if ($table.hasClass('col-table-resizing')) {
                return false;
            }

            // Prevent sorting if click originated from resize cursor area
            if ($(e.target).hasClass('col-resize-cursor-area') ||
                $(e.target).closest('.col-resize-cursor-area').length) {
                return false;
            }

            // Only prevent default for click events, not drag events
            if (e.type === 'click') {
                e.preventDefault();
            }

            if (!options.data.length) return;

            const sort = $(this).attr("data-sort");
            const sortBy = $(this).attr("data-sort-by");
            const colIndex = $(this).attr("data-column-index");

            // Sort data and update UI
            sortData(options.data, sortBy, sort);
            onSuccess(options);
            modifyHeaderSortDirection(this, sort, options);
            addColumnSortIndicator($table, colIndex);
        });
    }

    /**
     * Execute success callback and regenerate table body
     * @param {Object} options - Plugin configuration
     */
    function onSuccess(options) {
        clearTableBody(options);
        generateTableBody(options, 200);
        options.success(options.data);
    }

    /**
     * Add visual indicator to sorted column in table body
     * @param {jQuery} $table - Table element
     * @param {number} index - Column index
     */
    function addColumnSortIndicator($table, index) {
        $table.find(`tbody td:nth-child(${parseInt(index) + 1})`)
            .each((_, td) => $(td).toggleClass("sort-active"));
    }

    /**
     * Toggle sort direction and update ARIA attributes for accessibility
     * @param {Element} sortedButton - The sort button element
     * @param {string} sort - Current sort direction ('asc' or 'desc')
     * @param {Object} options - Plugin configuration
     */
    function modifyHeaderSortDirection(sortedButton, sort, options) {
        const $button = $(sortedButton);
        const $th = $button.closest('th');

        // Toggle sort direction
        if (sort === "asc") {
            $button.attr("data-sort", "desc");
            $th.attr("aria-sort", "ascending");
        } else {
            $button.attr("data-sort", "asc");
            $th.attr("aria-sort", "descending");
        }

        const currentIndex = $button.attr("data-column-index");

        // Reset all other sortable columns to default state
        const $allSortButtons = options._self.find('thead .col-sort-btn[data-sort-by]');
        $allSortButtons.each(function () {
            const $otherButton = $(this);
            const $otherTh = $otherButton.closest('th');
            if ($otherButton.attr("data-column-index") !== currentIndex) {
                $otherButton.attr("data-sort", "asc");
                $otherTh.removeAttr("aria-sort");
            }
        });
    }

    /**
     * Clear all rows from table body
     * @param {Object} options - Plugin configuration
     */
    function clearTableBody(options) {
        options._self.find('tbody').empty();
    }

    /**
     * Sort data array by specified key and direction
     * @param {Array} data - Data array to sort
     * @param {string} key - Object property to sort by
     * @param {string} direction - Sort direction ('asc' or 'desc')
     * @returns {Array} Sorted data array
     */
    function sortData(data, key, direction) {
        if (!$.isArray(data)) return;

        return data.sort((a, b) => {
            const aValue = a[key] ?? "";
            const bValue = b[key] ?? "";

            return handleSorting(aValue, bValue, direction);
        });
    }

    /**
     * Compare two values for sorting (handles strings and numbers)
     * @param {string|number} firstElement - First value to compare
     * @param {string|number} secondElement - Second value to compare
     * @param {string} sortOrder - Sort direction ('asc' or 'desc')
     * @returns {number} Comparison result
     */
    function handleSorting(firstElement, secondElement, sortOrder) {
        if (typeof firstElement === 'number' && typeof secondElement === 'number') {
            return sortOrder === 'asc' ? firstElement - secondElement : secondElement - firstElement;
        }
        else if (typeof firstElement === 'string' && typeof secondElement === 'string') {
            return sortOrder === 'asc' ?
                firstElement.localeCompare(secondElement) :
                secondElement.localeCompare(firstElement);
        }
        return sortOrder === 'asc' ? firstElement - secondElement : secondElement - firstElement;
    }

    // ==========================================================================
    // COLUMN CLASSIFICATION & UTILITIES
    // ==========================================================================

    /**
     * Determine if a column should be excluded from interactive features
     * Non-interactive columns: row counters, checkboxes, radios, visually-hidden content
     * @param {jQuery} $th - Header element to check
     * @returns {boolean} True if column is non-interactive
     */
    function isNonInteractiveColumn($th) {
        // 1. Row counter column
        if ($th.hasClass('row-counter')) return true;

        // 2. Visually hidden content (including Action columns)
        const $visuallyHidden = $th.find('.visually-hidden');
        if ($visuallyHidden.length > 0) {
            return true;
        }
        if ($th.hasClass('visually-hidden')) {
            return true;
        }

        // 3. Contains only "#" symbol (excluding whitespace)
        const headerText = $th.text().trim();
        if (headerText === '#') return true;

        // 4. Contains checkbox or radio input
        const hasCheckboxOrRadio = $th.find('input[type="checkbox"], input[type="radio"]').length > 0;
        if (hasCheckboxOrRadio) return true;

        return false;
    }

    /**
     * Determine if a column is an Action column (visually hidden with Action text)
     * Action columns should not be resizable or reorderable but don't need fixed width
     * @param {jQuery} $th - Header element to check
     * @returns {boolean} True if this is an Action column
     */
    function isActionColumn($th) {
        // Check for visually hidden content with Action text
        const $visuallyHidden = $th.find('.visually-hidden');
        if ($visuallyHidden.length > 0) {
            const hiddenText = $visuallyHidden.text().trim().toLowerCase();
            return hiddenText === 'action' || hiddenText === 'actions';
        }

        // Check if the th itself has visually-hidden class with Action text
        if ($th.hasClass('visually-hidden')) {
            const headerText = $th.text().trim().toLowerCase();
            return headerText === 'action' || headerText === 'actions';
        }

        return false;
    }

    /**
     * Determine if a column should have a fixed width (56px)
     * Only for row counters, checkboxes, radios, and non-Action columns with "#" symbol
     * @param {jQuery} $th - Header element to check
     * @returns {boolean} True if column should have fixed width
     */
    function shouldHaveFixedWidth($th) {
        // 1. Row counter column
        if ($th.hasClass('row-counter')) return true;

        // 2. Contains only "#" symbol (excluding whitespace)
        const headerText = $th.text().trim();
        if (headerText === '#') return true;

        // 3. Contains checkbox or radio input
        const hasCheckboxOrRadio = $th.find('input[type="checkbox"], input[type="radio"]').length > 0;
        if (hasCheckboxOrRadio) return true;

        // 4. Action columns should NOT have fixed width
        if (isActionColumn($th)) return false;

        return false;
    }

    /**
     * Execute success callback and regenerate table body
     * @param {Object} options - Plugin configuration
     */
    function onSuccess(options) {
        clearTableBody(options);
        generateTableBody(options, 200);
        options.success(options.data);
    }

    /**
     * Add visual indicator to sorted column in table body
     * @param {jQuery} $table - Table element
     * @param {number} index - Column index
     */
    function addColumnSortIndicator($table, index) {
        $table.find(`tbody td:nth-child(${parseInt(index) + 1})`)
            .each((_, td) => $(td).toggleClass("sort-active"));
    }

    /**
     * Toggle sort direction and update ARIA attributes for accessibility
     * @param {Element} sortedButton - The sort button element
     * @param {string} sort - Current sort direction ('asc' or 'desc')
     * @param {Object} options - Plugin configuration
     */
    function modifyHeaderSortDirection(sortedButton, sort, options) {
        const $button = $(sortedButton);
        const $th = $button.closest('th');

        if (sort === "asc") {
            $button.attr("data-sort", "desc");
            $th.attr("aria-sort", "ascending");
        } else {
            $button.attr("data-sort", "asc");
            $th.attr("aria-sort", "descending");
        }

        const currentIndex = $button.attr("data-column-index");

        // Reset all other sortable columns
        const $allSortButtons = options._self.find('thead .col-sort-btn[data-sort-by]');
        $allSortButtons.each(function () {
            const $otherButton = $(this);
            const $otherTh = $otherButton.closest('th');
            if ($otherButton.attr("data-column-index") !== currentIndex) {
                $otherButton.attr("data-sort", "asc");
                $otherTh.removeAttr("aria-sort");
            }
        });
    }

    /**
     * Clear all rows from table body
     * @param {Object} options - Plugin configuration
     */
    function clearTableBody(options) {
        options._self.find('tbody').empty();
    }

    /**
     * Sort data array by specified key and direction
     * @param {Array} data - Data array to sort
     * @param {string} key - Object property to sort by
     * @param {string} direction - Sort direction ('asc' or 'desc')
     * @returns {Array} Sorted data array
     */
    function sortData(data, key, direction) {
        if (!$.isArray(data)) return;

        return data.sort((a, b) => {
            const aValue = a[key] ?? "";
            const bValue = b[key] ?? "";

            return handleSorting(aValue, bValue, direction);
        });
    }

    /**
     * Compare two values for sorting (handles strings and numbers)
     * @param {string|number} firstElement - First value to compare
     * @param {string|number} secondElement - Second value to compare
     * @param {string} sortOrder - Sort direction ('asc' or 'desc')
     * @returns {number} Comparison result
     */
    function handleSorting(firstElement, secondElement, sortOrder) {
        if (typeof firstElement === 'number' && typeof secondElement === 'number') {
            return sortOrder === 'asc' ? firstElement - secondElement : secondElement - firstElement;
        }
        else if (typeof firstElement === 'string' && typeof secondElement === 'string') {
            return sortOrder === 'asc' ?
                firstElement.localeCompare(secondElement) :
                secondElement.localeCompare(firstElement);
        }
        return sortOrder === 'asc' ? firstElement - secondElement : secondElement - firstElement;
    }

    // ==========================================================================
    // COLUMN CLASSIFICATION & UTILITIES
    // ==========================================================================

    /**
     * Determine if a column should be excluded from interactive features
     * Non-interactive columns: row counters, checkboxes, radios, visually-hidden content
     * @param {jQuery} $th - Header element to check
     * @returns {boolean} True if column is non-interactive
     */
    function isNonInteractiveColumn($th) {
        // 1. Row counter column
        if ($th.hasClass('row-counter')) return true;

        // 2. Visually hidden content (including Action columns)
        const $visuallyHidden = $th.find('.visually-hidden');
        if ($visuallyHidden.length > 0) {
            return true;
        }
        if ($th.hasClass('visually-hidden')) {
            return true;
        }

        // 3. Contains only "#" symbol (excluding whitespace)
        const headerText = $th.text().trim();
        if (headerText === '#') return true;

        // 4. Contains checkbox or radio input
        const hasCheckboxOrRadio = $th.find('input[type="checkbox"], input[type="radio"]').length > 0;
        if (hasCheckboxOrRadio) return true;

        return false;
    }

    /**
     * Calculate minimum required width for a column header
     * Accounts for text content, sort button, and resize area
     * @param {string} text - Header text content
     * @param {boolean} hasSortButton - Whether column has sort button
     * @param {boolean} hasResizeArea - Whether column has resize handle
     * @returns {number} Minimum width in pixels
     */
    function calculateMinimumColumnWidth(text, hasSortButton, hasResizeArea) {
        // Create temporary element with table header styling to measure text width accurately
        const $temp = $('<th>').css({
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            padding: '0',
            margin: '0',
            border: 'none',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            fontWeight: 'inherit'
        }).html(`<div class="header-text">${text}</div>`).appendTo('body');

        const textWidth = $temp.find('.header-text').outerWidth();
        $temp.remove();

        // Calculate component widths (in pixels)
        const SORT_BUTTON_WIDTH = 32;   // 2rem button width
        const RESIZE_AREA_WIDTH = 20;   // Resize cursor area width  
        const BASE_PADDING = 24;        // 0.75rem left + 0.75rem right padding
        const TEXT_BUTTON_GAP = 8;      // Gap between text and sort button

        let totalWidth = textWidth + BASE_PADDING;

        if (hasSortButton) {
            totalWidth += SORT_BUTTON_WIDTH + TEXT_BUTTON_GAP;
        }

        if (hasResizeArea) {
            totalWidth += RESIZE_AREA_WIDTH;
        }

        // Ensure minimum of 100px for usability, especially for very short text
        return Math.max(Math.ceil(totalWidth), 100);
    }

    // ==========================================================================
    // HEADER BUILDING
    // ==========================================================================

    /**
     * Build header HTML with sorting, resizing, and reordering capabilities
     * @param {Array} allColumns - All column configurations
     * @param {Array} theadChildren - Existing header elements
     * @param {boolean} isCountable - Whether row counter is enabled
     * @param {string} tableId - Unique table identifier
     * @returns {string} Complete header row HTML
     */
    function buildHeaders(allColumns, theadChildren, isCountable, tableId) {
        let headersHtml = "";
        const isCounted = $(theadChildren[0]).hasClass("row-counter");
        const sortableColumns = allColumns.filter(column => column.sortable === true);

        theadChildren.forEach((childHeader, idx) => {
            const headerClassNames = $(childHeader).attr("class") ?? "";
            const colIndex = isCountable && isCounted ? idx : (isCountable && !isCounted ? idx + 1 : idx);
            const sortableColumn = sortableColumns.find(a => a.column === colIndex || a.column === $(childHeader).text().trim());
            const resizableColumn = allColumns.find(a => a.column === colIndex || a.column === $(childHeader).text().trim());

            if ($(childHeader).hasClass('col-sortable')) {
                headersHtml += `${childHeader.outerHTML}`;
                return;
            }

            // Build class list for the header
            let thClasses = headerClassNames;

            // Check if this is a non-interactive column (using jQuery element for proper checking)
            const $tempHeader = $(childHeader);
            const isNonInteractive = isNonInteractiveColumn($tempHeader);

            if (sortableColumn && !isNonInteractive) {
                thClasses += " col-sortable col-draggable";
            }
            if (resizableColumn && resizableColumn.resizable === true && !isNonInteractive) {
                thClasses += " col-resizable";
            }

            // Build data attributes and inline styles
            let dataAttributes = `data-original-index="${colIndex}"`;
            let inlineStyles = "";

            // Use data-fixed-width attribute for specific column types (not Action columns)
            if (shouldHaveFixedWidth($tempHeader)) {
                dataAttributes += ` data-fixed-width="56"`;
            }
            // Check for col-icon class and set fixed width (but not for col-freeze columns)
            else if (headerClassNames.includes('col-icon') && !headerClassNames.includes('col-freeze')) {
                dataAttributes += ` data-fixed-width="56"`;
            }

            // Find column config for width constraints (independent of resizable setting)
            const columnConfig = allColumns.find(a => a.column === colIndex || a.column === $(childHeader).text().trim());

            // Calculate minimum width based on content structure
            const headerText = $(childHeader).text().trim();
            const hasSortButton = sortableColumn && !isNonInteractive;
            const hasResizeArea = resizableColumn && resizableColumn.resizable === true && !isNonInteractive;

            // Calculate the minimum required width for proper layout
            const calculatedMinWidth = calculateMinimumColumnWidth(headerText, hasSortButton, hasResizeArea);

            // Apply width constraints if defined (regardless of resizable setting)
            if (columnConfig) {
                // Use the higher value between calculated minimum and developer-set minimum
                let finalMinWidth = calculatedMinWidth;
                if (columnConfig.minWidth) {
                    finalMinWidth = Math.max(calculatedMinWidth, columnConfig.minWidth);
                }
                dataAttributes += ` data-min-width="${finalMinWidth}"`;

                // Store width constraints as data attributes for two-phase layout
                if (columnConfig.maxWidth) {
                    dataAttributes += ` data-max-width="${columnConfig.maxWidth}"`;
                }
            } else {
                // No developer config - use calculated minimum
                dataAttributes += ` data-min-width="${calculatedMinWidth}"`;
            }

            if (resizableColumn && resizableColumn.resizable === true && !isNonInteractive) {
                dataAttributes += ` data-resizable="true"`;
            }

            if (!sortableColumn && !resizableColumn) {
                const $header = $(childHeader);
                // Use adjusted index so mapping aligns with tbody (accounts for row counter)
                $header.attr('data-original-index', colIndex);

                // Apply col-icon width styling if needed
                if (headerClassNames.includes('col-icon')) {
                    $header.attr('style', 'width: 56px');
                }

                headersHtml += $header[0].outerHTML;
            } else {
                const text = (sortableColumn && sortableColumn.customText) ? sortableColumn.customText : $(childHeader).html();
                let newHeader = text;

                if (sortableColumn && sortableColumn.context && typeof sortableColumn.context === "string" && !isNonInteractive) {
                    const defaultSort = sortableColumn.defaultSort ?? "asc";
                    // Extract text content only for aria-label (no HTML tags)
                    const textOnly = $(childHeader).text().trim();
                    // Generate unique mask IDs for this table to avoid conflicts across multiple tables
                    const uniqueUpMaskId = `sort-up-mask-${tableId || 'table'}-${colIndex}`;
                    const uniqueDownMaskId = `sort-down-mask-${tableId || 'table'}-${colIndex}`;
                    // Use flexible layout structure with wrapper container
                    newHeader = `<div class="header-content">
                                    <div class="header-text">${text}</div>
                                    <button type="button" 
                                        class="col-sort-btn"
                                        data-sort="${defaultSort}" 
                                        data-column-index="${colIndex}"
                                        data-sort-by="${sortableColumn.context}"
                                        aria-label="Sort ${textOnly}">
                                        <svg class="sort-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
                                            <defs>
                                                <mask id="${uniqueUpMaskId}" maskUnits="userSpaceOnUse">
                                                    <rect width="640" height="640" fill="black"/>
                                                    <path d="M130.4 268.2C135.4 280.2 147 288 160 288L480 288C492.9 288 504.6 280.2 509.6 268.2C514.6 256.2 511.8 242.5 502.7 233.3L342.7 73.3C330.2 60.8 309.9 60.8 297.4 73.3L137.4 233.3C128.2 242.5 125.5 256.2 130.5 268.2z" fill="white"/>
                                                </mask>
                                                <mask id="${uniqueDownMaskId}" maskUnits="userSpaceOnUse">
                                                    <rect width="640" height="640" fill="black"/>
                                                    <path d="M130.4 371.7C125.4 383.7 128.2 397.4 137.3 406.6L297.3 566.6C309.8 579.1 330.1 579.1 342.6 566.6L502.6 406.6C511.8 397.4 514.5 383.7 509.5 371.7C504.5 359.7 492.9 352 480 352L160 352C147.1 352 135.4 359.8 130.4 371.8z" fill="white"/>
                                                </mask>
                                            </defs>
                                            <rect class="sort-up" width="640" height="640" fill="currentColor" mask="url(#${uniqueUpMaskId})"/>
                                            <rect class="sort-down" width="640" height="640" fill="currentColor" mask="url(#${uniqueDownMaskId})"/>
                                        </svg>
                                    </button>
                                </div>`;
                } else {
                    // For non-sortable columns, wrap text in container for consistency
                    newHeader = `<div class="header-content">
                                    <div class="header-text">${text}</div>
                                </div>`;
                }

                // Add resize area if column is resizable and not non-interactive
                let resizeHandle = "";
                if (resizableColumn && resizableColumn.resizable === true && !isNonInteractive) {
                    resizeHandle = `<div class="col-resize-cursor-area"></div>`;
                }

                // Build the complete header - non-interactive columns should not be draggable
                const dragAttr = (sortableColumn && !isNonInteractive) ? ' draggable="true"' : '';
                headersHtml += `<th scope="col" class="${thClasses}" ${dataAttributes}${inlineStyles}${dragAttr}>${newHeader}${resizeHandle}</th>`;
            }
        })

        return `<tr>${headersHtml}</tr>`;
    }

    // ==========================================================================
    // TABLE BODY GENERATION
    // ==========================================================================

    /**
     * Generate table body with data or appropriate status message
     * @param {Object} options - Plugin configuration
     * @param {number} code - HTTP status code (0=loading, 200=success, 403/404/500=errors)
     */
    function generateTableBody(options, code = 0) {
        const $table = options._self;
        const domainURL = getDomainURL();
        const loaderImageURL = `${domainURL}/content/images/states/loader/voyadores-loader.gif`;
        const error403ImageURL = `${domainURL}/content/images/states/error/voyadores-403.svg`;
        const error404ImageURL = `${domainURL}/content/images/states/error/voyadores-404.svg`;
        const error500ImageURL = `${domainURL}/content/images/states/error/voyadores-500.svg`;
        const emptyImageURL = `${domainURL}${options.imageEmpty}`;
        let html = '';
        let tbody = $table.find('tbody');
        let colspanHtml = getColspan($table);

        clearTableBody(options);

        if (code == 0) {
            html = `<tr>
                        <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded ${options.cssClassNoResult}" aria-busy="true" aria-live="polite">
                            <img src="${loaderImageURL}" alt="" width="100" aria-hidden="true" />
                            <span class="sr-only">Loading, please wait...</span>
                        </td>
                    </tr>`;
        }

        if (code == 403) {
            html = `<tr>
                       <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                            <img src="${error403ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                            <h4 class="fw-semibold mt-4 mb-0">Access forbidden</h4>
                            <p id="p-message" class="text-secondary mt-2">${options.messageNoPermission}</p>
                        </td>
                   </tr>`;
        }

        if (code == 404) {
            html = `<tr>
                       <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                            <img src="${error404ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                            <h4 class="fw-semibold mt-4 mb-0">Not found</h4>
                            <p id="p-message" class="text-secondary mt-2">${options.messageNotFound}</p>
                       </td>
                   </tr>`;
        }

        if (code == 500) {
            html = `<tr>
                       <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                            <img src="${error500ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                            <h4 class="fw-semibold mt-4 mb-0">Internal server error</h4>
                            <p id="p-message" class="text-secondary mt-2">${options.messageErrorOccured}</p>
                       </td>
                   </tr>`;
        }

        if (code == 200) {
            html = options.mappingFunction(options.data);
            if (html == '') {
                html = `<tr>
                           <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                                <img src="${emptyImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                                <h4 class="fw-semibold mt-4 mb-0">${options.messageNoResultHeader}</h4>
                                <p id="p-message" class="text-secondary mt-2 text-wrap mx-auto">${options.messageNoResult}</p>
                           </td>
                       </tr>`;
            }
        }

        tbody.html(html);
        setTableBehaviors(options, code);

        // Synchronize body columns with current header order if needed
        if (code === 200 && options.headers.columnReorder) {
            synchronizeBodyWithHeaders(options);
        }
    }

    /**
     * Setup table behaviors after successful data load
     * @param {Object} options - Plugin configuration
     * @param {number} status - HTTP status code
     */
    function setTableBehaviors(options, status) {
        if (status !== 200) return;

        setRowCounter(options);
        setHeaderOnEmpty(options);

        // Only enable column features above minimum viewport width (desktop only)
        if (window.innerWidth >= options.minViewportWidth) {
            if (options.headers.columnReorder) {
                enableColumnReordering(options);
            }
            enableColumnResizing(options);
        }
    }

    // ==========================================================================
    // COLUMN REORDERING (DRAG & DROP)
    // ==========================================================================

    /**
     * Enable drag-and-drop column reordering using Sortable.js
     * Desktop only feature (requires minViewportWidth)
     * @param {Object} options - Plugin configuration
     */
    function enableColumnReordering(options) {
        if (window.innerWidth >= options.minViewportWidth) {
            if (options.headers.columnReorder) {
                enableColumnReordering(options);
            }
            // Enable column resizing if there are resizable columns
            enableColumnResizing(options);
        }
    }

    function enableColumnReordering(options) {
        // Only enable column reordering above minimum viewport width
        if (window.innerWidth < options.minViewportWidth) {
            return;
        }

        const $table = options._self;
        const $theadRow = $table.find('thead tr');
        const $thCells = $theadRow.children();
        const $tbody = $table.find('tbody');
        const minIndex = options.rowCounter && $thCells.eq(0).hasClass('row-counter') ? 1 : 0;

        // Note: Table layout is managed by two-phase system in applyTableLayoutConstraints
        // No need to manually override here

        // Remove any existing colgroups to prevent width conflicts
        $table.find('colgroup').remove();

        // Helper function to create Excel-style column highlight
        const createColumnHighlight = function ($table, columnIndex) {
            const $theadRow = $table.find('thead tr');
            const $th = $theadRow.children().eq(columnIndex);

            if ($th.length === 0) return;

            // Don't highlight non-interactive columns
            if (isNonInteractiveColumn($th)) return;

            // Calculate column position and width
            const tableOffset = $table.offset();
            const thOffset = $th.offset();
            const columnWidth = $th.outerWidth();
            const tableHeight = $table.outerHeight();

            // Create highlight overlay
            const $highlight = $('<div class="col-highlight-overlay"></div>');

            // Position the highlight overlay
            $highlight.css({
                left: (thOffset.left - tableOffset.left) + 'px',
                width: columnWidth + 'px',
                height: tableHeight + 'px',
                top: '0px'
            });

            // Add to table (which should have position: relative)
            $table.css('position', 'relative').append($highlight);
        };

        // Wait for Sortable.js to load
        const initSortable = () => {
            if (typeof Sortable === 'undefined') {
                setTimeout(initSortable, 100);
                return;
            }

            // Destroy existing sortable instance if it exists
            const existingSortable = $table.data('sortableInstance');
            if (existingSortable && existingSortable.destroy) {
                existingSortable.destroy();
            }

            // Add draggable class to headers (excluding non-interactive columns)
            $thCells.each(function (index) {
                const $th = $(this);

                if (index >= minIndex && !isNonInteractiveColumn($th)) {
                    $th.addClass('col-draggable');
                } else {
                    // Ensure non-interactive columns are not draggable
                    $th.removeClass('col-draggable').css('cursor', 'default');
                }
            });            // Initialize Sortable.js on the header row
            const sortableInstance = Sortable.create($theadRow[0], {
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                chosenClass: 'sortable-chosen',
                filter: function (evt, target, parent) {
                    // Don't allow dragging non-interactive columns
                    if (!parent || !parent.children) {
                        return false;
                    }
                    const index = Array.from(parent.children).indexOf(target);
                    const $target = $(target);

                    // Block drag on resize cursor areas
                    if ($(evt.target).hasClass('col-resize-cursor-area') ||
                        $(evt.target).closest('.col-resize-cursor-area').length) {
                        return true;
                    }

                    // Block drag on non-interactive columns
                    return index < minIndex || isNonInteractiveColumn($target);
                },
                // Prevent dropping at positions that would interfere with non-interactive columns
                onMove: function (evt) {
                    const draggedIndex = evt.dragged ? Array.from(evt.from.children).indexOf(evt.dragged) : -1;
                    const targetIndex = evt.related ? Array.from(evt.to.children).indexOf(evt.related) : -1;

                    // Check if dragged or target elements are non-interactive
                    const $dragged = evt.dragged ? $(evt.dragged) : null;
                    const $target = evt.related ? $(evt.related) : null;
                    const draggedIsNonInteractive = $dragged && isNonInteractiveColumn($dragged);
                    const targetIsNonInteractive = $target && isNonInteractiveColumn($target);

                    // Prevent moving to non-interactive column position
                    if (options.rowCounter && targetIndex < minIndex) {
                        return false;
                    }

                    // Prevent dragging non-interactive columns
                    if (draggedIndex < minIndex || draggedIsNonInteractive) {
                        return false;
                    }

                    // Prevent moving to non-interactive columns
                    if (targetIsNonInteractive) {
                        return false;
                    }

                    return true;
                },
                onStart: function (evt) {
                    // Prevent sort click from interfering during drag
                    const $th = $(evt.item);
                    $th.data('isDragging', true);
                    setTimeout(() => $th.removeData('isDragging'), 300);

                    // Don't highlight if dragging non-interactive column
                    const columnIndex = evt.oldIndex;
                    if (columnIndex < minIndex || isNonInteractiveColumn($th)) {
                        return;
                    }

                    // Highlight the entire column during drag - Excel style
                    $table.addClass('col-dragging');

                    // Clear any existing highlights first
                    $table.find('.col-highlight-overlay').remove();
                    $tbody.find('td.col-drag-highlight').removeClass('col-drag-highlight');

                    // Create Excel-style column highlight overlay
                    createColumnHighlight($table, columnIndex);
                },
                onChange: function (evt) {
                    // Update column highlighting position during drag
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;

                    // Skip if trying to move non-interactive columns
                    if (newIndex < minIndex || oldIndex < minIndex) {
                        return;
                    }

                    // Skip if target column is non-interactive
                    const $targetTh = $theadRow.children().eq(newIndex);
                    if (isNonInteractiveColumn($targetTh)) {
                        return;
                    }

                    // Update Excel-style column highlighting to follow the drag
                    $table.find('.col-highlight-overlay').remove();
                    createColumnHighlight($table, newIndex);
                },
                onEnd: function (evt) {
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;

                    // Prevent any moves that would interfere with row counter
                    if (options.rowCounter && (newIndex < minIndex || oldIndex < minIndex)) {
                        // Revert the move if it's invalid
                        return;
                    }

                    // Synchronize body columns to match the final header order
                    // sortable.js has already moved the header, now we move the body to match
                    if (oldIndex !== newIndex && oldIndex >= minIndex && newIndex >= minIndex) {
                        $tbody.find('tr').each(function () {
                            const $row = $(this);
                            const $cells = $row.children();

                            // Ensure we have valid indices
                            if ($cells.length > oldIndex && oldIndex >= 0) {
                                const $movedCell = $cells.eq(oldIndex).detach();

                                // Get fresh reference after detaching
                                const $updatedCells = $row.children();

                                // Insert at the correct position
                                if (newIndex >= $updatedCells.length) {
                                    $row.append($movedCell);
                                } else if (newIndex === 0) {
                                    $row.prepend($movedCell);
                                } else {
                                    $movedCell.insertAfter($updatedCells.eq(newIndex - 1));
                                }
                            }
                        });
                    }

                    // Update column indices for sorting
                    updateColumnIndices($table);

                    // Store the new column order for future synchronization
                    storeColumnOrder($table);

                    // Update sort indicators if any column is currently sorted
                    $table.find('tbody td.sort-active').removeClass('sort-active');
                    const activeA = $table.find('thead th a.sort.active');
                    if (activeA.length) {
                        const newColIndex = activeA.attr('data-column-index');
                        addColumnSortIndicator($table, newColIndex);
                    }

                    // Clean up column highlighting
                    $table.removeClass('col-dragging');
                    $table.find('.col-highlight-overlay').remove();
                    $tbody.find('td.col-drag-highlight').removeClass('col-drag-highlight');

                    // Trigger success callback if provided
                    if (options.success && typeof options.success === 'function') {
                        options.success(options.data);
                    }
                }
            });

            // Store sortable instance for cleanup if needed
            $table.data('sortableInstance', sortableInstance);

            // Store initial column order
            storeColumnOrder($table);
        };

        initSortable();
    }

    function updateColumnIndices($table) {
        // Update the data-column-index attributes for sortable headers after reordering
        const $theadRow = $table.find('thead tr');
        const $thCells = $theadRow.children();

        $thCells.each(function (index) {
            const $sortButton = $(this).find('.col-sort-btn[data-sort-by]');
            if ($sortButton.length > 0) {
                $sortButton.attr('data-column-index', index);
            }
        });
    }

    function storeColumnOrder($table) {
        const $theadRow = $table.find('thead tr');
        const $thCells = $theadRow.children();
        const columnOrder = [];

        // Build mapping based on data-original-index or text content
        $thCells.each(function (currentIndex) {
            const $th = $(this);
            let originalIndex = $th.data('originalIndex');

            if (originalIndex === undefined) {
                // First time - this is the original position
                originalIndex = currentIndex;
                $th.data('originalIndex', originalIndex);
            }

            columnOrder.push(originalIndex);
        });

        $table.data('columnOrder', columnOrder);
    }

    function synchronizeBodyWithHeaders(options) {
        const $table = options._self;
        const $theadRow = $table.find('thead tr');
        const $tbody = $table.find('tbody');

        // Get stored column order if it exists
        const storedColumnOrder = $table.data('columnOrder');

        if (!storedColumnOrder || $tbody.find('tr').length === 0) {
            return; // No stored order or no body content
        }

        // Apply the stored column order to body rows
        $tbody.find('tr').each(function () {
            const $row = $(this);
            const $cells = $row.children();
            const cellsArray = $cells.toArray();
            const reorderedCells = [];
            const included = new Set();

            // Reorder cells according to stored order
            storedColumnOrder.forEach(originalIndex => {
                const cell = cellsArray[originalIndex];
                if (cell && !included.has(cell)) {
                    reorderedCells.push(cell);
                    included.add(cell);
                }
            });

            // Safety: append any remaining cells that weren't mapped to avoid dropping columns
            if (reorderedCells.length !== cellsArray.length) {
                cellsArray.forEach(cell => {
                    if (!included.has(cell)) {
                        reorderedCells.push(cell);
                        included.add(cell);
                    }
                });
            }

            // Replace row content with reordered cells
            $row.empty().append(reorderedCells);
        });
    }

    function enableColumnResizing(options) {
        // Only enable column resizing above minimum viewport width
        if (window.innerWidth < options.minViewportWidth) {
            return;
        }

        const $table = options._self;
        const $theadRow = $table.find('thead tr');

        // Debug: Log resizable columns found
        const resizableHeaders = $theadRow.find('th.col-resizable, th[data-resizable="true"]');

        // Add table-bound resize indicator if not exists
        if ($table.find('.table-resize-indicator').length === 0) {
            $table.css('position', 'relative').append('<div class="table-resize-indicator"></div>');
        }

        const $tableResizeIndicator = $table.find('.table-resize-indicator');
        let isResizing = false;
        let currentResizeHandle = null;
        let startX = 0;
        let startWidth = 0;
        let currentTh = null;
        let columnIndex = 0;
        let resizeZoneWidth = 8; // Pixels from the right edge to trigger resize
        let rafId = null; // For requestAnimationFrame
        let lastMouseX = 0; // Track last mouse position

        // Note: Resize areas are now created during header building phase
        // No need to add additional elements here - simplifies the UI

        // Add hover handlers to show preview resize line
        $table.off('mouseenter.columnResizeHover mouseleave.columnResizeHover')
            .on('mouseenter.columnResizeHover', '.col-resize-cursor-area', function (e) {
                if (isResizing) return; // Don't show preview during active resize

                const $th = $(this).closest('th');
                if (!$th.hasClass('col-resizable')) return;

                // Show preview resize line at column's right edge
                const tableOffset = $table.offset();
                const currentThOffset = $th.offset();
                const currentThRight = Math.round((currentThOffset.left + $th.outerWidth()) - tableOffset.left);

                $tableResizeIndicator.addClass('hover-preview').css({
                    display: 'block',
                    transform: `translateX(${currentThRight}px)`,
                    top: 0,
                    height: $table.outerHeight()
                });
            })
            .on('mouseleave.columnResizeHover', '.col-resize-cursor-area', function (e) {
                if (isResizing) return; // Don't hide during active resize

                // Hide preview resize line
                $tableResizeIndicator.removeClass('hover-preview').css('display', 'none');
            });

        // Attach mousedown handler specifically to resize cursor areas
        $table.off('mousedown.columnResize').on('mousedown.columnResize', '.col-resize-cursor-area', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const $th = $(this).closest('th');

            if (!$th.hasClass('col-resizable')) {
                return;
            }

            isResizing = true;
            currentResizeHandle = null; // No longer using resize handles
            currentTh = $th;
            columnIndex = currentTh.index();

            startX = e.pageX;
            startWidth = currentTh.outerWidth();

            // CRITICAL: Lock all column widths before resize to prevent redistribution
            // This ensures only the target column changes width
            $table.css('table-layout', 'fixed');
            const $theadRow = $table.find('thead tr');
            $theadRow.children('th').each(function (index) {
                const $th = $(this);
                const currentWidth = $th.outerWidth();
                $th.css('width', currentWidth + 'px');

                // Also lock corresponding body cells
                $table.find('tbody tr').each(function () {
                    $(this).children().eq(index).css('width', currentWidth + 'px');
                });
            });

            // Add resizing classes
            $table.addClass('col-table-resizing');
            currentTh.addClass('col-table-resizing');

            // Add resizing class to corresponding body cells
            $table.find(`tbody tr td:nth-child(${columnIndex + 1})`).addClass('col-table-resizing');

            // Show Excel-style resize line at column's right edge
            const tableOffset = $table.offset();
            const currentThOffset = currentTh.offset();
            const currentThRight = Math.round((currentThOffset.left + currentTh.outerWidth()) - tableOffset.left);

            $tableResizeIndicator.removeClass('hover-preview').css({
                display: 'block',
                transform: `translateX(${currentThRight}px)`,
                top: 0,
                height: $table.outerHeight()
            });

            // Prevent text selection and other interactions
            $('body').css({
                'user-select': 'none',
                '-webkit-user-select': 'none',
                '-moz-user-select': 'none',
                '-ms-user-select': 'none'
            });
        });

        // Handle mouse move during resize with requestAnimationFrame for smooth updates
        $(document).off('mousemove.columnResize').on('mousemove.columnResize', function (e) {
            if (!isResizing) return;

            e.preventDefault();
            lastMouseX = e.pageX;

            // Cancel previous animation frame if it exists
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            // Schedule update for next frame
            rafId = requestAnimationFrame(() => {
                updateResizeIndicator(lastMouseX);
            });
        });

        // Function to update resize indicator and column widths
        function updateResizeIndicator(pageX) {
            const deltaX = pageX - startX;
            const newWidth = startWidth + deltaX;

            // Get min/max constraints
            let minWidth = parseInt(currentTh.data('min-width') || '50');
            const maxWidth = parseInt(currentTh.data('max-width') || '999999');

            // Account for sortable icon space (40px padding-right) to prevent overflow with resize handle
            if (currentTh.hasClass('col-sortable') && currentTh.find('.col-sort-btn').length > 0) {
                const sortableIconSpace = 60; // 40px padding + 20px buffer for content and resize handle
                minWidth = Math.max(minWidth, sortableIconSpace);
            }

            // Apply constraints to the width
            const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

            // Apply width ONLY to the resizing column (other columns are already locked)
            currentTh.css('width', constrainedWidth + 'px');

            // Apply width to corresponding body cells
            $table.find('tbody tr').each(function () {
                $(this).children().eq(columnIndex).css('width', constrainedWidth + 'px');
            });

            // Now calculate the indicator position based on the ACTUAL column position after resize
            const tableOffset = $table.offset();
            const currentThOffset = currentTh.offset();
            const currentThLeft = currentThOffset.left - tableOffset.left;
            const currentThWidth = currentTh.outerWidth();

            // Position the line exactly at the column's right edge
            // Round to nearest pixel for crisp rendering
            const indicatorPosition = Math.round(currentThLeft + currentThWidth);

            // Update Excel-style resize line position using transform for better performance
            $tableResizeIndicator.css('transform', `translateX(${indicatorPosition}px)`);
        }

        // Handle mouse up to end resize
        $(document).off('mouseup.columnResize').on('mouseup.columnResize', function (e) {
            if (!isResizing) return;

            // Cancel any pending animation frame
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            isResizing = false;

            // Clean up classes and states
            $table.removeClass('col-table-resizing');
            $table.find('th').removeClass('col-table-resizing');

            // Remove resizing class from all body cells
            $table.find('tbody tr td').removeClass('col-table-resizing');

            $tableResizeIndicator.hide();

            // Reset body styles
            $('body').css({
                'user-select': '',
                '-webkit-user-select': '',
                '-moz-user-select': '',
                '-ms-user-select': ''
            });

            // Reset variables
            currentResizeHandle = null;
            currentTh = null;
            startX = 0;
            startWidth = 0;
            columnIndex = 0;
            lastMouseX = 0;
        });
    }

    // ==========================================================================
    // ROW COUNTER & HEADER VISIBILITY
    // ==========================================================================

    /**
     * Add row counter column if enabled in configuration
     * @param {Object} options - Plugin configuration
     */
    function setRowCounter(options) {
        if (!options.rowCounter) return;

        const $table = options._self;

        // Add row counter header if not present
        if (!$table.find("thead th:nth-child(1)").hasClass("row-counter")) {
            $table.find("thead tr").prepend("<th scope='col' class='row-counter text-center' data-original-index='0' style='width: 56px;'>#</th>");
        }

        if (options.data.length < 1) return;

        // Add row numbers to each body row
        $table.find("tbody tr").each((i, tr) => $(tr).prepend(`<td class="row-counter text-center">${i + 1}</td>`));
    }

    /**
     * Show/hide header row based on configuration and data presence
     * @param {Object} options - Plugin configuration
     */
    function setHeaderOnEmpty(options) {
        const $table = options._self;
        const headerConfig = options.headers;
        const $tr = $table.find("thead tr");

        if (!headerConfig.hideOnEmpty || options.data.length > 0) {
            $tr.removeAttr("style");
            return;
        }

        $tr.css("display", "none");
    }

    // ==========================================================================
    // UTILITY FUNCTIONS
    // ==========================================================================

    /**
     * Calculate colspan for full-width status messages
     * @param {jQuery} $table - Table element
     * @returns {string} Colspan attribute string
     */
    function getColspan($table) {
        let colspan = 1;
        $table.find('thead > tr:nth-child(1) th').each(function () {
            if ($(this).attr('colspan')) {
                colspan += +$(this).attr('colspan');
            } else {
                colspan++;
            }
        });
        return colspan > 1 ? `colspan="${colspan}"` : '';
    }

    /**
     * Validate that data array has correct structure
     * All objects must have consistent properties
     * @param {Array} data - Data array to validate
     * @returns {boolean} True if valid structure
     */
    function validateDataStructure(data) {
        if (!$.isArray(data)) {
            console.error("The data is not an array.");
            return false;
        }

        if (data.length < 1) return false;

        if (!data.every(i => typeof i === "object" && i !== null)) {
            console.error("Not all elements in data are object.");
            return false;
        }

        const refKeys = Object.keys(data[0]);
        let objectSameKey = true;

        for (let i = 1; i < data.length; i++) {
            const currentKeys = Object.keys(data[i]);
            if (refKeys.length !== currentKeys.length || !refKeys.every(key => currentKeys.includes(key))) {
                objectSameKey = !objectSameKey;
                break;
            }
        }

        if (!objectSameKey) {
            console.error("Object structure mismatch.");
            return false;
        }

        return true;
    }

    /**
     * Get domain URL from hidden input element
     * @returns {string} Domain URL or empty string
     */
    function getDomainURL() {
        const domainURLInput = document.getElementById('voyadores-cdn-url');
        return domainURLInput?.value || '';
    }

}(jQuery));