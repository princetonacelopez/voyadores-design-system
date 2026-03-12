/*!
 * jQuery Custom Table Plugin v2.2.1
 * (c) 2026 Network Economic Services Ventures Philippines, Inc.
 * Date: 02/27/2026
 * All rights reserved.
 *
 * Features:
 * - New table events: add, update, remove
 * - View Transition and animation for rendering table rows
 */

(function ($) {
	/**
	 * Default configuration options for the table plugin
	 * These values are merged with user-provided options during initialization
	 */
	const defaultConfig = {
		endpoint: "",
		mappingFunction: () => "",
		success: () => "",
		fail: () => "",
		transformData: null,
		messageNoResultHeader: "No data found",
		messageNoResult: `There's nothing to display here at the moment.`,
		messageNoPermission: `You don't have permission to view this content.`,
		messageErrorOccured: `There's a problem loading this content. Please try again later.`,
		messageNotFound: `The content you're looking for isn't available. It might have been moved or deleted.`,
		cssClassNoResult: "",
		messageLoading: "Loading data...",
		imageEmpty: "/content/images/states/empty/voyadores.default.empty.svg",
		params: () => ({}),
		data: [],
		async: true,
		rowCounter: true,
		headers: {
			hideOnEmpty: false,
			columns: [],
			columnReorder: true,
		},
		loadMore: {
			id: "",
			hideOnEmpty: true,
			showOnPageSize: 20,
			onEmpty: () => "",
		},
	};

	/**
	 * Tracks the current page number for pagination when load more is enabled
	 * Increments with each "load more" action
	 * Resets to 1 when a new table instance is initialized
	 */
	let pageCount = 1;

	/**
	 * jQuery plugin entry point for table initialization and commands
	 * @param {Object|String} options - Configuration object for initialization or command string ("refresh", "clear")
	 * @param {*} params - Additional parameters for commands (data array, params object, or params function)
	 *
	 * Usage:
	 * - Initialize: $('#myTable').table({ endpoint: '/api/data', ... })
	 * - Refresh: $('#myTable').table('refresh', newData)
	 * - Clear: $('#myTable').table('clear')
	 */
	$.fn.table = function (options, params) {
		// Reset page count to 1 for new table instance or command

		if (typeof options === "object") {
			initialize(options, this);
		} else if (typeof options === "string") {
			handleStringCommand(options, params, this);
		}
	};

	/**
	 * Initializes a new table instance with the provided configuration
	 * Stores config in table's data attribute for later access by commands
	 * @param {Object} options - User configuration options
	 * @param {jQuery} self - The table element
	 */
	function initialize(options, self) {
		const $table = $(self);
		$table.addClass("table-custom");
		const id = $table.attr("id");

		if (!id) return;

		options._id = id;
		options._self = $table;

		const userOptions = $.extend(true, {}, defaultConfig, options);

		$table.data("config", userOptions);

		pageCount = 1;

		refresh(userOptions);
	}

	/**
	 * Handles string-based commands for existing table instances
	 * Commands: "refresh" - reload data, "clear" - empty table body
	 * @param {String} options - Command name
	 * @param {*} params - Command parameters (data, params object, or function)
	 * @param {jQuery} self - The table element
	 */
	function handleStringCommand(options, params, self) {
		const $table = $(self);

		// Retrieve stored configuration from previous initialization
		const storedOptions = $table.data("config") || null;

		if (!storedOptions)
			throw new Error(
				`Unable to trigger '${options}'. No existing instance found with the id of '${$table.attr("id")}'.`,
			);

		if (options === "refresh") {
			pageCount = 1;

			if ($.isArray(params)) {
				const isValid = validateDataStructure(params);

				storedOptions.data = isValid ? params : [];
			} else if (typeof params === "object")
				storedOptions.params = () => params;
			else if (typeof params === "function") storedOptions.params = params;
		}

		if (options === "clear") {
			clearTableBody(storedOptions);
			return;
		}

		if (options === "add") {
			addRow(storedOptions, params);
			return;
		}

		if (options === "update") {
			updateRow(storedOptions, params);
			return;
		}

		if (options === "remove") {
			removeRow(storedOptions, params);
			return;
		}

		refresh(storedOptions);
	}

	/**
	 * Refreshes the table by loading data and rebuilding the table body
	 * Handles both static data and AJAX endpoint scenarios
	 * @param {Object} options - Table configuration options
	 */
	function refresh(options) {
		// Display loading state immediately
		generateTableBody(options);

		// Hide load more button during loading
		loadMore(options, []);

		if (!options.endpoint) {
			if (
				options.transformData &&
				typeof options.transformData === "function"
			) {
				options.data = options.transformData(options.data);
			}

			// Sets the headers (sortable, resizable)
			setHeaders(options);

			generateTableBody(options, 200);
			loadMore(options, options.data, 200);
			options.success(options.data);
			return;
		}

		handleAjaxCall(options, (data, status) => {
			if (status === 200) {
				options.data = data;

				// Sets the headers (sortable, resizable)
				setHeaders(options);

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
	 * Manages the "Load More" button visibility and click behavior
	 * Shows/hides button based on data availability and attaches pagination handler
	 * @param {Object} options - Table configuration
	 * @param {Array} data - Current data set
	 * @param {Number} status - HTTP status code (200, 404, 500, etc.)
	 */
	function loadMore(options, data, status) {
		const loadMoreConfig = options.loadMore;

		// Exit if loadMore is not properly configured
		if ($.isArray(loadMoreConfig) || !loadMoreConfig.id) return;

		const element = $(`#${loadMoreConfig.id}`).show();

		if (
			status !== 200 ||
			!data.length ||
			data.length < loadMoreConfig.showOnPageSize
		)
			return element.hide();

		element.off().click(function () {
			$(this).prop("disabled", true);

			// increment page by 1 for every fetch
			const page = (pageCount += 1);

			handleAjaxCall(
				options,
				(data, status) => {
					$(this).prop("disabled", false);

					if (status !== 200) return;

					if (data.length > 0) {
						processNewPagedData(options, data);
					} else {
						loadMoreConfig.onEmpty(this);

						if (!loadMoreConfig.hideOnEmpty) return;

						element.hide();
					}
				},
				page,
			);
		});
	}

	/**
	 * Processes newly loaded paginated data and appends it to the table
	 * Maintains current sort order if a column is actively sorted
	 * @param {Object} options - Table configuration
	 * @param {Array} data - New page of data to append
	 */
	function processNewPagedData(options, data) {
		const $table = options._self;
		const activeSort = getActiveHeaderSort(options);

		// Append new data to existing dataset
		options.data.push(...data);

		if (activeSort) {
			sortData(options.data, activeSort.sortBy, activeSort.sort);
			onSuccess(options);
			addColumnSortIndicator($table, activeSort.colIndex);
		} else {
			onSuccess(options);
		}
	}

	/**
	 * Retrieves information about the currently active sort column
	 * @param {Object} options - Table configuration
	 * @returns {Object|null} Sort info {sort, sortBy, colIndex} or null if no active sort
	 */
	function getActiveHeaderSort(options) {
		const activeSortHeader = options._self.find("thead th a.sort.active");
		if (activeSortHeader.length === 0) return null;
		const sortBy = activeSortHeader.attr("data-sort-by");
		const colIndex = activeSortHeader.attr("data-column-index");
		const sort = activeSortHeader.attr("data-sort") === "desc" ? "asc" : "desc";

		return { sort, sortBy, colIndex };
	}

	/**
	 * Executes AJAX request to fetch data from the configured endpoint
	 * Automatically appends pagination and custom parameters to query string
	 * @param {Object} options - Table configuration
	 * @param {Function} callback - Callback function(data, statusCode)
	 * @param {Number} page - Page number to fetch (default: 1)
	 */
	function handleAjaxCall(options, callback, page = 1) {
		let queryString = `page=${page}`;

		if (typeof options.params === "function") {
			const queryParams = options.params();

			if (typeof queryParams === "object" && !$.isArray(queryParams)) {
				queryString = `${$.param(queryParams)}&page=${page}`;
			}
		} else {
			throw new TypeError(
				`The option 'params' for #${options._id} must be a function.`,
			);
		}

		const apiUrl = `${options.endpoint}?${queryString}`;

		//Build the API call parameters
		const parameters = {
			url: apiUrl,
			context: document.body,
			dataType: "json",
			async: options.async,
			complete: function (response) {
				const statusCode = response.status;
				let data = response.responseJSON;

				if (
					options.transformData &&
					typeof options.transformData === "function"
				) {
					data = options.transformData(data);
				}

				const isValid = validateDataStructure(data);

				if (callback && typeof callback === "function") {
					callback(isValid ? data : [], statusCode);
				}
			},
		};

		//Perform the call
		$.ajax(parameters);
	}

	/**
	 * Configures table headers with sorting, resizing, and reordering features
	 * Rebuilds header HTML with appropriate attributes and event handlers
	 * Falls back to cleaning up attributes when no columns are configured
	 * @param {Object} options - Table configuration
	 */
	function setHeaders(options) {
		const columns = options.headers.columns || options.headers.sortable || [];
		const hasData =
			options.data && $.isArray(options.data) && options.data.length > 0;

		// Skip if no data available
		if (!hasData) return;

		const thead = options._self.find("thead");

		// Reset layout mode to auto to allow measurement during render
		options._self.removeClass("fixed-layout");

		const theadChildren = [...thead.find("tr").children()];

		if (!thead || theadChildren.length === 0) return;

		// Only process if there are configured columns
		if ($.isArray(columns) && columns.length > 0) {
			// Validate sortable columns - only allow string and number types
			// Disable sorting for columns with incompatible data types (objects, arrays, etc.)
			columns.forEach((header) => {
				if (!header.sortable) return;

				const contextValues = options.data.map(
					(obj) => obj[header.context] ?? "",
				);

				if (
					contextValues.every(
						(c) => typeof c === "string" || typeof c === "number",
					)
				)
					return;

				console.warn(
					`Unable to set column '${header.column}' as sortable. The context '${header.context}' is not of type string or number.`,
				);
				header.sortable = false;
			});

			const theadHtml = buildHeaders(
				columns,
				theadChildren,
				options.rowCounter,
				options.headers.columnReorder,
			);

			thead.html(theadHtml);

			// Attach event handlers for interactive header features
			sortEventHandler(thead.find("tr a.sort"), options);

			// Enable column width adjustment via resize handles
			resizeEventHandler(thead.find("tr th"), options);

			// Enable drag-and-drop column reordering if configured
			if (options.headers.columnReorder) {
				reorderEventHandler(thead.find("tr th"), options);
			}
		} else {
			// If no columns configured, clean up any leftover attributes and classes from previous renders
			thead.find("th").each(function () {
				const $th = $(this);
				// Remove data attributes used for column reordering
				$th.removeAttr("data-original-index");
				$th.removeAttr("draggable");
				$th.removeAttr("data-min-width");
				$th.removeAttr("data-max-width");
				// Remove sortable-related classes
				$th.removeClass("sortable");
				// Remove any sort links
				const $sortLink = $th.find("a.sort");
				if ($sortLink.length > 0) {
					$th.html($sortLink.html());
				}
				// Remove resize handles
				$th.find(".col-resize-cursor-area").remove();
			});
		}
	}

	/**
	 * Attaches mousedown event handlers to resize handles for column width adjustment
	 * Simplified, fluid UX with proper constraint handling
	 * Only activates when resizable: true is explicitly set in column config
	 * @param {jQuery} headers - Collection of th elements
	 * @param {Object} options - Table configuration
	 */
	function resizeEventHandler(headers, options) {
		const $table = options._self;

		headers.each(function () {
			const $th = $(this);
			const $handle = $th.find(".col-resize-cursor-area");

			// Skip if no resize handle (column not marked as resizable)
			if ($handle.length === 0) return;

			$handle.off("mousedown").on("mousedown", function (e) {
				e.preventDefault();
				e.stopPropagation();

				const startX = e.pageX;
				const startWidth = $th.outerWidth();

				// Get constraints from data attributes
				const minWidth = parseFloat($th.attr("data-min-width")) || 40;
				const maxWidth = parseFloat($th.attr("data-max-width")) || Infinity;

				let currentWidth = startWidth;
				let rafId = null;

				// Hint browser to isolate this element for compositing during drag
				$th[0].style.willChange = "width";

				// Add resizing class and highlight the active header
				$table.addClass("col-table-resizing");
				$th.addClass("col-resize-active");

				// Live width update throttled to one write per animation frame (≤60fps)
				$(document).on("mousemove.tableResize", function (e) {
					const diff = e.pageX - startX;
					let newWidth = startWidth + diff;

					if (newWidth < minWidth) newWidth = minWidth;
					if (newWidth > maxWidth) newWidth = maxWidth;

					currentWidth = newWidth;

					if (rafId) return; // already scheduled for this frame
					rafId = requestAnimationFrame(() => {
						$th[0].style.width = currentWidth + "px";
						rafId = null;
					});
				});

				$(document).on("mouseup.tableResize", function () {
					$(document).off(".tableResize");

					if (rafId) {
						cancelAnimationFrame(rafId);
						rafId = null;
					}

					$table.removeClass("col-table-resizing");
					$th.removeClass("col-resize-active");
					$th[0].style.willChange = "";
					$th[0].style.width = currentWidth + "px";

					// Persist width to config
					const originalIndex = $th.attr("data-original-index");
					if (
						originalIndex !== undefined &&
						options.headers.columns[originalIndex]
					) {
						options.headers.columns[originalIndex].width = currentWidth + "px";
					}
				});
			});

			// Prevent click propagation
			$handle.on("click", (e) => e.stopPropagation());

			// Double-click to auto-fit
			$handle.on("dblclick", function (e) {
				e.preventDefault();
				e.stopPropagation();

				// Clone table to measure natural width
				const $tableClone = $table.clone();
				$tableClone
					.css({
						position: "absolute",
						visibility: "hidden",
						width: "auto",
						"table-layout": "auto",
					})
					.appendTo("body");

				const columnIndex = $th.index();
				const $clonedTh = $tableClone.find("thead th").eq(columnIndex);
				$clonedTh.css("width", "auto");
				const optimalWidth = $clonedTh.outerWidth();
				$tableClone.remove();

				// Apply constraints
				const minWidth = parseFloat($th.attr("data-min-width")) || 40;
				const maxWidth = parseFloat($th.attr("data-max-width")) || Infinity;
				let finalWidth = optimalWidth;
				if (finalWidth < minWidth) finalWidth = minWidth;
				if (finalWidth > maxWidth) finalWidth = maxWidth;

				// Apply with smooth transition
				$th.css({
					transition: "width 0.15s ease",
					width: finalWidth + "px",
				});

				setTimeout(() => $th.css("transition", ""), 150);

				// Persist to config
				const originalIndex = $th.attr("data-original-index");
				if (
					originalIndex !== undefined &&
					options.headers.columns[originalIndex]
				) {
					options.headers.columns[originalIndex].width = finalWidth + "px";
				}
			});
		});
	}

	/**
	 * Attaches HTML5 drag-and-drop event handlers for column reordering
	 * Allows users to drag column headers to reposition them
	 * Automatically reorders table body cells to match new header order
	 * @param {jQuery} headers - Collection of th elements
	 * @param {Object} options - Table configuration
	 */
	function reorderEventHandler(headers, options) {
		let dragSrcEl = null;

		headers.each(function () {
			const $th = $(this);
			// Only enable dragging for valid data columns (excludes row counters, checkboxes, hidden columns)
			if ($th.attr("data-original-index") === undefined) return;
			if (!isColumnReorderable($th)) return;

			$th.on("dragstart", function (e) {
				dragSrcEl = this;
				e.originalEvent.dataTransfer.effectAllowed = "move";
				e.originalEvent.dataTransfer.setData("text/html", this.outerHTML);
				$(this).addClass("is-dragging");
				e.stopPropagation();

				// Create styled drag preview image for better UX
				const scrollX = window.scrollX || window.pageXOffset;
				const scrollY = window.scrollY || window.pageYOffset;

				const $dragImage = $("<div>").html($(this).html());
				$dragImage.find(".col-resize-cursor-area").remove(); // Clean up extraneous elements
				$dragImage.css({
					position: "absolute",
					top: "-1000px",
					left: "-1000px",
					"z-index": "99999",
					opacity: "1",
					"background-color": "#fff",
					border: "1px solid #ccc",
					"box-shadow": "0 3px 6px rgba(0,0,0,0.16)",
					padding: "8px",
					width: $(this).outerWidth() + "px",
					height: $(this).outerHeight() + "px",
					display: "block",
					overflow: "hidden",
					"white-space": "nowrap",
					"text-overflow": "ellipsis",
					"font-weight": "bold",
					"font-size": "14px",
					"font-family": "inherit",
					color: "#333",
				});

				$("body").append($dragImage);

				// setDragImage requires the element to be visible
				if (e.originalEvent.dataTransfer.setDragImage) {
					e.originalEvent.dataTransfer.setDragImage($dragImage[0], 0, 0);
				}

				// Cleanup immediately after the browser takes the snapshot
				setTimeout(() => {
					$dragImage.remove();
				}, 0);
			});

			$th.on("dragover", function (e) {
				if (e.preventDefault) e.preventDefault();
				e.originalEvent.dataTransfer.dropEffect = "move";
				$(this).addClass("drag-over");
				return false;
			});

			$th.on("dragenter", function (e) {
				$(this).addClass("drag-over");
			});

			$th.on("dragleave", function (e) {
				$(this).removeClass("drag-over");
			});

			$th.on("drop", function (e) {
				if (e.stopPropagation) e.stopPropagation();

				const $target = $(this);
				if (dragSrcEl !== this) {
					// Validate drop target is a valid data column
					if ($target.attr("data-original-index") === undefined) return false;

					// Prevent dropping on restricted columns (row counters, checkboxes, etc.)
					if (!isColumnReorderable($target)) return false;

					// Reposition header by inserting before or after target based on drag direction
					const srcIndex = $(dragSrcEl).index();
					const targetIndex = $target.index();

					if (srcIndex < targetIndex) {
						$target.after(dragSrcEl);
					} else {
						$target.before(dragSrcEl);
					}

					// Synchronize table body columns to match new header order
					reorderTableBody(options);
				}
				return false;
			});

			$th.on("dragend", function (e) {
				headers.removeClass("is-dragging drag-over");
			});
		});
	}

	/**
	 * Tags each table body cell with its original column index
	 * Required for reorderTableBody to map cells to their original positions
	 * Skips row counter cells as they are not part of the data
	 * @param {Object} options - Table configuration
	 */
	function tagTableRows(options) {
		const $table = options._self;
		$table.find("tbody tr").each(function () {
			const $cells = $(this).children("td");
			let dataIndex = 0;
			$cells.each(function () {
				if ($(this).hasClass("row-counter")) return;
				$(this).attr("data-original-index", dataIndex++);
			});
		});
	}

	/**
	 * Reorders all table body cells to match the current header order
	 * Uses data-original-index attributes to identify and reposition cells
	 * Preserves row counter column at the start of each row
	 * @param {Object} options - Table configuration
	 */
	function reorderTableBody(options) {
		const $table = options._self;
		const $headers = $table.find("thead th");

		// Build mapping of current visual position to original data index
		const columnMap = [];
		let hasRowCounter = false;

		$headers.each(function () {
			const originalIndex = $(this).attr("data-original-index");
			if (
				originalIndex !== undefined &&
				originalIndex !== null &&
				originalIndex !== ""
			) {
				columnMap.push(parseInt(originalIndex));
			} else if ($(this).hasClass("row-counter")) {
				hasRowCounter = true;
			}
		});

		$table.find("tbody tr").each(function () {
			const $row = $(this);
			const $cells = $row.children("td");
			// If we have a row counter, we generally want to preserve it at the start (or identify it)
			// But relying on index is risky now. We use the data-original-index.

			const reorderedCells = columnMap.map((originalIdx) => {
				// Find the cell with this original index
				return $cells.filter(`[data-original-index="${originalIdx}"]`);
			});

			const $rc = hasRowCounter ? $cells.filter(".row-counter") : null;

			$row.empty();
			if ($rc && $rc.length > 0) $row.append($rc);

			reorderedCells.forEach(($cell) => $row.append($cell));
		});
	}

	/**
	 * Attaches click event handlers to sortable column headers
	 * Toggles sort direction and updates table display with sorted data
	 * @param {jQuery} sortableHeaders - Collection of sortable link elements
	 * @param {Object} options - Table configuration
	 */
	function sortEventHandler(sortableHeaders, options) {
		const $table = options._self;
		sortableHeaders.off().click(function () {
			if (!options.data.length) return;

			const sort = $(this).attr("data-sort");
			const sortBy = $(this).attr("data-sort-by");
			const colIndex = $(this).attr("data-column-index");

			sortData(options.data, sortBy, sort);

			onSuccess(options);
			modifyHeaderSortDirection(this, sort, options);
			addColumnSortIndicator($table, colIndex);
		});
	}

	/**
	 * Success callback handler that regenerates table body and triggers user callback
	 * @param {Object} options - Table configuration
	 */
	function onSuccess(options) {
		clearTableBody(options);
		generateTableBody(options, 200);
		options.success(options.data);
	}

	function addColumnSortIndicator($table, index) {
		$table
			.find(`tbody td:nth-child(${parseInt(index) + 1})`)
			.each((_, td) => $(td).toggleClass("sort-active"));
	}

	function modifyHeaderSortDirection(sortedColumn, sort, options) {
		if (sort === "asc") {
			$(sortedColumn).attr("data-sort", "desc");
			$(sortedColumn)
				.removeClass("sort-desc active")
				.addClass("sort-asc active");
		} else {
			$(sortedColumn).attr("data-sort", "asc");
			$(sortedColumn)
				.removeClass("sort-asc active")
				.addClass("sort-desc active");
		}

		const currentIndex = $(sortedColumn).attr("data-column-index");
		const inactiveSort = [
			...options._self.find("thead a.sort-asc, thead a.sort-desc"),
		].filter((a) => $(a).attr("data-column-index") !== currentIndex);

		inactiveSort.forEach((s) => {
			$(s).attr({
				class: "sort",
				"data-sort": "asc",
			});
		});
	}

	function clearTableBody(options) {
		options._self.find("tbody").empty();
	}

	/**
	 * Sorts the data array by a specified key and direction
	 * Modifies the original array in place
	 * @param {Array} data - Data array to sort
	 * @param {String} key - Object property name to sort by
	 * @param {String} direction - Sort direction ("asc" or "desc")
	 * @returns {Array} Sorted array reference
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
	 * Compares two values for sorting based on their data type
	 * Handles numeric and string comparisons with locale-aware string sorting
	 * @param {*} firstElement - First value to compare
	 * @param {*} secondElement - Second value to compare
	 * @param {String} sortOrder - "asc" for ascending, "desc" for descending
	 * @returns {Number} Negative, zero, or positive number for sort comparison
	 */
	function handleSorting(firstElement, secondElement, sortOrder) {
		// Sort by numeric comparison
		if (typeof firstElement === "number" && typeof secondElement === "number") {
			return sortOrder === "asc"
				? firstElement - secondElement
				: secondElement - firstElement;
		}
		// Sort by string
		else if (
			typeof firstElement === "string" &&
			typeof secondElement === "string"
		) {
			return sortOrder === "asc"
				? firstElement.localeCompare(secondElement)
				: secondElement.localeCompare(firstElement);
		}

		// Default to ascending if types are different or not supported
		return sortOrder === "asc"
			? firstElement - secondElement
			: secondElement - firstElement;
	}

	/**
	 * Builds header HTML with configured features (sorting, resizing, reordering)
	 * Matches columns config with existing header elements and generates enhanced HTML
	 * Preserves headers without config while adding interactive features to configured ones
	 * @param {Array} columns - Column configuration array
	 * @param {Array} theadChildren - Existing th elements
	 * @param {Boolean} isCountable - Whether row counter is enabled
	 * @param {Boolean} isReorderable - Whether column reordering is enabled
	 * @returns {String} HTML string for tr element with configured headers
	 */
	function buildHeaders(columns, theadChildren, isCountable, isReorderable) {
		let headersHtml = "";
		const isCounted = $(theadChildren[0]).hasClass("row-counter");
		let dataIndex = 0;

		theadChildren.forEach((childHeader, idx) => {
			let headerClassNames = $(childHeader).attr("class") ?? "";
			let headerStyle = $(childHeader).attr("style") ?? "";

			const $childHeader = $(childHeader);
			const isRowCounter = $childHeader.hasClass("row-counter");

			// Clean up any previously applied sortable classes to prevent duplication
			// We'll rebuild the header fresh each time
			headerClassNames = headerClassNames
				.replace(/\bsortable\b/g, "")
				.replace(/\bcol-resizable\b/g, "")
				.trim();

			// Determine the stable identity index for this column
			let originalIndexAttr = $childHeader.attr("data-original-index");
			let currentOriginalIndex =
				originalIndexAttr !== undefined
					? parseInt(originalIndexAttr)
					: undefined;

			if (!isRowCounter) {
				if (currentOriginalIndex === undefined) {
					currentOriginalIndex = dataIndex;
				}
				dataIndex++;
			}

			const colIndex = isCountable && !isCounted ? idx + 1 : idx;

			// Find column config using same logic as v2.0.1
			// Match by column index or header text (same as v2.0.1's sortableHeaders.find)
			const headerText = $childHeader.text().trim();
			const columnConfig = columns.find((a) => {
				// Primary matching: by column property (can be index or text)
				if (a.column === colIndex || a.column === headerText) {
					return true;
				}
				return false;
			});

			if (!columnConfig) {
				// No config for this column - preserve it exactly as-is
				// However, add data-original-index for tbody reordering to work correctly
				const $temp = $(childHeader).clone();

				// Add data-original-index if not already present (needed for reorderTableBody)
				if (
					!$temp.attr("data-original-index") &&
					currentOriginalIndex !== undefined &&
					!isRowCounter
				) {
					$temp.attr("data-original-index", currentOriginalIndex);
				}

				// Add draggable ONLY if reorderable and passes reorderable checks
				if (isReorderable && !isRowCounter && isColumnReorderable($temp)) {
					if (!$temp.attr("draggable")) {
						$temp.attr("draggable", "true");
					}
				}

				headersHtml += $temp.prop("outerHTML");
			} else {
				// Extract original text content, unwrapping any existing sort links
				let content;
				if (columnConfig.customText) {
					content = columnConfig.customText;
				} else {
					// If header contains a sort link, get its content; otherwise get header's HTML
					const $existingLink = $childHeader.find("a.sort");
					content =
						$existingLink.length > 0
							? $existingLink.html()
							: $childHeader.html();
				}

				let resizeHandle = "";

				// Update content from config if provided, but we still check the original $childHeader for restrictions

				// If config has specific index, prefer it (though normally matches currentOriginalIndex on init)
				if (columnConfig.originalIndex !== undefined) {
					currentOriginalIndex = columnConfig.originalIndex;
				}

				if (
					columnConfig.sortable &&
					columnConfig.context &&
					typeof columnConfig.context === "string"
				) {
					const defaultSort = columnConfig.defaultSort ?? "asc";

					content = `<a class="sort" 
                                    data-sort="${defaultSort}" 
                                    data-column-index="${colIndex}"
                                    data-sort-by="${columnConfig.context}"
                                    href="javascript:void(0)">${content}
                                </a>`;

					if (!headerClassNames.includes("sortable"))
						headerClassNames += " sortable";
				}

				// Only add resize handle if explicitly enabled
				if (columnConfig.resizable === true) {
					resizeHandle = `<span class="col-resize-cursor-area"></span>`;
					if (!headerClassNames.includes("col-resizable"))
						headerClassNames += " col-resizable";
				}

				// Apply width constraints
				let dataAttrs = "";

				// Clean up headerStyle and ensure proper formatting
				headerStyle = headerStyle.trim();

				// Set explicit width if provided
				if (columnConfig.width) {
					headerStyle +=
						(headerStyle ? "; " : "") + `width: ${columnConfig.width}`;
				}

				// Set min width constraint
				if (columnConfig.minWidth) {
					headerStyle +=
						(headerStyle ? "; " : "") + `min-width: ${columnConfig.minWidth}`;
					dataAttrs += ` data-min-width="${parseFloat(columnConfig.minWidth)}"`;
				}

				// Set max width constraint
				if (columnConfig.maxWidth) {
					headerStyle +=
						(headerStyle ? "; " : "") + `max-width: ${columnConfig.maxWidth}`;
					dataAttrs += ` data-max-width="${parseFloat(columnConfig.maxWidth)}"`;
				}

				// Always write the original index
				dataAttrs += ` data-original-index="${currentOriginalIndex}"`;

				// Check if reorderable based on class/content restrictions
				const canReorder = isReorderable && isColumnReorderable($childHeader);
				const draggable = canReorder ? ' draggable="true"' : "";
				headersHtml += `<th scope="col"${draggable} class="${headerClassNames}" style="${headerStyle}"${dataAttrs}>${content}${resizeHandle}</th>`;
			}
		});

		return `<tr>${headersHtml}</tr>`;
	}

	/**
	 * Generates and renders the table body based on status code
	 * Displays loading, error states, or data rows with appropriate messaging
	 * Handles row tagging and reordering when columns are configured
	 * @param {Object} options - Table configuration
	 * @param {Number} code - Status code (0=loading, 200=success, 403/404/500=errors)
	 */
	function generateTableBody(options, code = 0) {
		const $table = options._self;
		const domainURL = getDomainURL();
		const loaderImageURL = `${domainURL}/content/images/states/loader/voyadores-loader.gif`;
		const error403ImageURL = `${domainURL}/content/images/states/error/voyadores-403.svg`;
		const error404ImageURL = `${domainURL}/content/images/states/error/voyadores-404.svg`;
		const error500ImageURL = `${domainURL}/content/images/states/error/voyadores-500.svg`;
		const emptyImageURL = `${domainURL}${options.imageEmpty}`;
		let html = "";
		let tbody = $table.find("tbody");
		let colspanHtml = getColspan($table);

		//Clear whatever is on the table
		clearTableBody(options);

		//Add a loader
		if (code == 0) {
			html = `<tr>
                        <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded ${options.cssClassNoResult}" aria-busy="true" aria-live="polite">
                            <img src="${loaderImageURL}" alt="" width="100" aria-hidden="true" />
                            <span class="sr-only">Loading, please wait...</span>
                        </td>
                    </tr>`;
		}

		// No permission given
		if (code == 403) {
			html = `<tr>
                       <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                            <img src="${error403ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                            <h4 class="fw-semibold mt-4 mb-0">Access forbidden</h4>
                            <p id="p-message" class="text-secondary mt-2">${options.messageNoPermission}</p>
                        </td>
                   </tr>`;
		}

		//No endpoint was found
		if (code == 404) {
			html = `<tr>
                       <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                            <img src="${error404ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                            <h4 class="fw-semibold mt-4 mb-0">Not found</h4>
                            <p id="p-message" class="text-secondary mt-2">${options.messageNotFound}</p>
                       </td>
                   </tr>`;
		}

		//Something's wrong with the endpoint
		if (code == 500) {
			html = `<tr>
                       <td ${colspanHtml} class="text-center status-text border-bottom-0 rounded p-6 ${options.cssClassNoResult}">
                            <img src="${error500ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                            <h4 class="fw-semibold mt-4 mb-0">Internal server error</h4>
                            <p id="p-message" class"text-secondary mt-2">${options.messageErrorOccured}</p>
                       </td>
                   </tr>`;
		}

		//Green
		if (code == 200) {
			html = options.mappingFunction(options.data);

			if (html == "") {
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

		// Apply column reordering only when:
		// 1. We have actual data (not loading/error/empty states)
		// 2. Columns are configured (reorderTableBody needs column mapping)
		// 3. Headers have been manually reordered by user (not in natural order)
		const columns = options.headers.columns || options.headers.sortable || [];
		const hasConfiguredColumns = $.isArray(columns) && columns.length > 0;

		if (
			code === 200 &&
			tbody.find(".status-text").length === 0 &&
			hasConfiguredColumns
		) {
			// Tag all cells with their original column index for reordering capability
			tagTableRows(options);

			// Only perform expensive reordering if user has dragged columns out of natural order
			if (needsReordering(options)) {
				reorderTableBody(options);
			}
		} else if (
			code === 200 &&
			tbody.find(".status-text").length === 0 &&
			!hasConfiguredColumns
		) {
			// If no columns configured, clean up any leftover data-original-index attributes from cells
			tbody.find("td[data-original-index]").removeAttr("data-original-index");
		}

		setTableBehaviors(options, code);
	}

	function setTableBehaviors(options, status) {
		if (status !== 200) return;

		// Table behaviors
		setRowCounter(options);
		setHeaderOnEmpty(options);

		// Freeze column widths after auto-layout to ensure filling + truncation
		freezeColumnWidths(options);
	}

	/**
	 * Locks column widths to their auto-calculated values and switches to fixed layout
	 * Enables text truncation and ensures resizable columns maintain their widths
	 * Only applies when resizable columns are configured
	 * @param {Object} options - Table configuration
	 */
	function freezeColumnWidths(options) {
		const $table = options._self;
		if ($table.hasClass("fixed-layout")) return;

		// Check if any column has resizable enabled
		const columns = options.headers.columns || [];
		const hasResizableColumn = columns.some((col) => col.resizable === true);

		// Only apply fixed layout if resizable columns exist
		if (!hasResizableColumn) return;

		// Measure current widths (rendered by browser in auto mode)
		const $headers = $table.find("thead th");
		$headers.each(function () {
			const width = $(this).outerWidth();
			$(this).css("width", width);
		});

		// Switch to fixed layout to enforce truncation and strict sizing
		$table.addClass("fixed-layout");
	}

	function setRowCounter(options) {
		if (!options.rowCounter) return;

		const $table = options._self;

		if (!$table.find("thead th:nth-child(1)").hasClass("row-counter"))
			$table
				.find("thead tr")
				.prepend("<th scope='col' class='row-counter text-center'>#</th>");

		if (options.data.length < 1) return;
		$table
			.find("tbody tr")
			.each((i, tr) =>
				$(tr).prepend(`<td class="row-counter text-center">${i + 1}</td>`),
			);
	}

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

	function getColspan($table) {
		let colspan = 1;

		//Get the number of columns of table
		$table.find("thead > tr:nth-child(1) th").each(function () {
			if ($(this).attr("colspan")) {
				colspan += +$(this).attr("colspan");
			} else {
				colspan++;
			}
		});

		let colspanHtml = "";
		if (colspan > 1) colspanHtml = `colspan="${colspan}"`;

		return colspanHtml;
	}

	/**
	 * Validates that data is a proper array of objects with consistent structure
	 * Ensures all objects have the same keys for reliable table rendering
	 * @param {*} data - Data to validate
	 * @returns {Boolean} True if valid, false otherwise
	 */
	function validateDataStructure(data) {
		if (!$.isArray(data)) {
			console.error("The data is not an array.");
			return false;
		}

		if (data.length < 1) return false;

		if (!data.every((i) => typeof i === "object" && i !== null)) {
			console.error("Not all elements in data are object.");
			return false;
		}

		const refKeys = Object.keys(data[0]);
		let objectSameKey = true;

		for (let i = 1; i < data.length; i++) {
			const currentKeys = Object.keys(data[i]);
			if (
				refKeys.length !== currentKeys.length ||
				!refKeys.every((key) => currentKeys.includes(key))
			) {
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

	function getDomainURL() {
		const domainURLInput = document.getElementById("voyadores-cdn-url");
		return domainURLInput?.value || "";
	}

	/**
	 * Determines if a column header can be reordered via drag-and-drop
	 * Excludes special columns like row counters, icons, checkboxes, and hidden columns
	 * @param {jQuery} $th - Table header element to check
	 * @returns {Boolean} True if column can be reordered
	 */
	function isColumnReorderable($th) {
		if ($th.hasClass("row-counter")) return false;
		if ($th.hasClass("col-icon")) return false;
		if (
			$th.hasClass("visually-hidden") ||
			$th.find(".visually-hidden").length > 0
		)
			return false;
		if ($th.find('input[type="checkbox"], input[type="radio"]').length > 0)
			return false;

		return true;
	}

	/**
	 * Resolves the insertion index for the add command
	 * @param {Array} data - Current data array
	 * @param {String|Number} insertAt - 'first', 'last', positive index, or negative-from-end
	 * @returns {Number} Zero-based splice index
	 */
	function resolveInsertIndex(data, insertAt) {
		if (insertAt === "first") return 0;
		if (insertAt === "last" || insertAt === undefined || insertAt === null)
			return data.length;
		if (typeof insertAt === "number") {
			if (insertAt < 0) return Math.max(data.length + insertAt + 1, 0);
			return Math.min(insertAt, data.length);
		}
		return data.length;
	}

	/**
	 * Finds the data array index for update/remove operations
	 * Matches by key property first, falls back to numeric at index
	 * @param {Array} data - Current data array
	 * @param {Object} params - { key?, item?, at? }
	 * @returns {Number} Resolved index or -1 if not found
	 */
	function findDataIndex(data, params) {
		if (params.key !== undefined && params.item !== undefined) {
			const keyVal = params.item[params.key];
			const idx = data.findIndex(
				(row) =>
					row[params.key] === keyVal ||
					String(row[params.key]) === String(keyVal),
			);
			if (idx !== -1) return idx;
		}
		if (typeof params.at === "number") {
			const resolved = params.at < 0 ? data.length + params.at : params.at;
			return resolved >= 0 && resolved < data.length ? resolved : -1;
		}
		return -1;
	}

	/**
	 * Updates row counter cell values for all body rows without full re-render
	 * Adds a counter cell to rows that don't have one yet
	 * @param {Object} options - Table configuration
	 */
	function updateRowCounters(options) {
		if (!options.rowCounter) return;
		options._self.find("tbody tr").each(function (i) {
			const $rc = $(this).children(".row-counter");
			if ($rc.length > 0) {
				$rc.text(i + 1);
			} else {
				$(this).prepend(`<td class="row-counter text-center">${i + 1}</td>`);
			}
		});
	}

	/**
	 * Tags a single row's data cells with their original column index
	 * Single-row counterpart to tagTableRows
	 * @param {jQuery} $row - The tr element to tag
	 */
	function tagSingleRow($row) {
		let dataIndex = 0;
		$row.children("td").each(function () {
			if ($(this).hasClass("row-counter")) return;
			$(this).attr("data-original-index", dataIndex++);
		});
	}

	/**
	 * Applies the current visual column order to a single row's cells
	 * Used after the user has drag-reordered columns, so new rows match the display
	 * @param {jQuery} $row - The tr element to reorder
	 * @param {Object} options - Table configuration
	 */
	function applyColumnOrderToRow($row, options) {
		if (!needsReordering(options)) return;

		const $headers = options._self.find("thead th");
		const columnMap = [];
		let hasRowCounter = false;

		$headers.each(function () {
			const originalIndex = $(this).attr("data-original-index");
			if (
				originalIndex !== undefined &&
				originalIndex !== null &&
				originalIndex !== ""
			) {
				columnMap.push(parseInt(originalIndex));
			} else if ($(this).hasClass("row-counter")) {
				hasRowCounter = true;
			}
		});

		if (columnMap.length === 0) return;

		const $cells = $row.children("td");
		const reorderedCells = columnMap.map((originalIdx) =>
			$cells.filter(`[data-original-index="${originalIdx}"]`),
		);

		const $rc = hasRowCounter ? $cells.filter(".row-counter") : null;
		$row.empty();
		if ($rc && $rc.length > 0) $row.append($rc);
		reorderedCells.forEach(($cell) => $row.append($cell));
	}

	/**
	 * Adds a single row to the table without full re-render
	 * Falls back to a full rebuild when the table is in an empty/error state
	 * @param {Object} options - Table configuration
	 * @param {Object} params - { item: Object, insertAt: 'first'|'last'|Number }
	 */
	function addRow(options, params) {
		if (!params || typeof params !== "object" || $.isArray(params)) return;

		const item = params.item;
		if (!item || typeof item !== "object" || $.isArray(item)) return;

		const insertIndex = resolveInsertIndex(options.data, params.insertAt);
		const $tbody = options._self.find("tbody");
		const isStatusState = $tbody.find(".status-text").length > 0;

		// Mutate data first so setHeaders / generateTableBody see the new item
		options.data.splice(insertIndex, 0, item);

		if (isStatusState) {
			// Table was in an empty/error state — rebuild headers and body
			setHeaders(options);
			generateTableBody(options, 200);
			return;
		}

		const rowHtml = options.mappingFunction([item]);
		if (!rowHtml) return;

		const $newRow = $(rowHtml).filter("tr").first();
		if ($newRow.length === 0) return;

		tagSingleRow($newRow);
		applyColumnOrderToRow($newRow, options);

		const $existingRows = $tbody.children("tr");

		const doInsert = () => {
			if (insertIndex === 0 || $existingRows.length === 0) {
				$tbody.prepend($newRow);
			} else if (insertIndex >= $existingRows.length) {
				$tbody.append($newRow);
			} else {
				$existingRows.eq(insertIndex).before($newRow);
			}
			updateRowCounters(options);
		};

		if ("startViewTransition" in document) {
			$newRow[0].style.viewTransitionName = "table-row";
			document.startViewTransition(doInsert).finished.then(() => {
				$newRow[0].style.viewTransitionName = "";
				$newRow.addClass("row-added");
				setTimeout(() => $newRow.removeClass("row-added"), 10200);
			});
		} else {
			// Insert at natural height so we can measure it
			doInsert();
			const rowHeight = $newRow.outerHeight();
			const $tds = $newRow.find("td");
			// Set the target height and force height:0 as the animation start state
			$tds.css({ "--row-height": rowHeight + "px", height: "0" });
			// rAF ensures height:0 is painted before the animation class is added,
			// so the expand keyframe begins from a true zero height
			requestAnimationFrame(() => {
				$tds.css("height", "");
				$newRow.addClass("row-added");
				setTimeout(() => $newRow.removeClass("row-added"), 10200);
			});
		}
	}

	/**
	 * Updates a single row in the table without full re-render
	 * Finds the target row by key match (primary) or numeric index fallback
	 * @param {Object} options - Table configuration
	 * @param {Object} params - { item: Object, key?: String, at?: Number }
	 */
	function updateRow(options, params) {
		if (!params || typeof params !== "object" || $.isArray(params)) return;

		const item = params.item;
		if (!item || typeof item !== "object" || $.isArray(item)) return;

		const resolvedIndex = findDataIndex(options.data, params);
		if (resolvedIndex === -1) return;

		// Merge existing row data with new item data to support partial updates
		const mergedItem = $.extend(true, {}, options.data[resolvedIndex], item);
		options.data[resolvedIndex] = mergedItem;

		const rowHtml = options.mappingFunction([mergedItem]);
		if (!rowHtml) return;

		const $newRow = $(rowHtml).filter("tr").first();
		if ($newRow.length === 0) return;

		tagSingleRow($newRow);
		applyColumnOrderToRow($newRow, options);

		if (options.rowCounter && $newRow.children(".row-counter").length === 0) {
			$newRow.prepend(
				`<td class="row-counter text-center">${resolvedIndex + 1}</td>`,
			);
		}

		const $oldRow = options._self.find("tbody tr").eq(resolvedIndex);

		if ("startViewTransition" in document) {
			$oldRow[0].style.viewTransitionName = "table-row";
			$newRow[0].style.viewTransitionName = "table-row";
			document.startViewTransition(() => $oldRow.replaceWith($newRow)).finished.then(() => {
				$newRow[0].style.viewTransitionName = "";
				$newRow.addClass("row-updated");
				setTimeout(() => $newRow.removeClass("row-updated"), 10100);
			});
		} else {
			$oldRow.replaceWith($newRow);
			$newRow.addClass("row-updated");
			setTimeout(() => $newRow.removeClass("row-updated"), 10100);
		}
	}

	/**
	 * Removes a single row from the table without full re-render
	 * Finds the target row by key/value match; shows empty state if the last row is removed
	 * @param {Object} options - Table configuration
	 * @param {Object} params - { key: String, value: * }
	 */
	function removeRow(options, params) {
		if (!params || typeof params !== "object" || $.isArray(params)) return;
		if (params.key === undefined || params.value === undefined) return;

		const resolvedIndex = options.data.findIndex(
			(row) =>
				row[params.key] === params.value ||
				String(row[params.key]) === String(params.value),
		);
		if (resolvedIndex === -1) return;

		options.data.splice(resolvedIndex, 1);

		const $row = options._self.find("tbody tr").eq(resolvedIndex);

		const afterRemove = () => {
			if (options.data.length === 0) {
				generateTableBody(options, 200);
				return;
			}
			updateRowCounters(options);
		};

		if ("startViewTransition" in document) {
			$row[0].style.viewTransitionName = "table-row";
			document.startViewTransition(() => $row.remove()).finished.then(afterRemove);
		} else {
			// Measure natural height before the collapse keyframe zeroes it
			const rowHeight = $row.outerHeight();
			$row.find("td").css("--row-height", rowHeight + "px");
			$row.addClass("row-removing");
			// slide(380ms) + collapse-delay(320ms) + collapse(280ms) + buffer
			setTimeout(() => { $row.remove(); afterRemove(); }, 620);
		}
	}

	/**
	 * Checks if table columns are currently in their original natural order
	 * Returns true if any column has been moved from its original position
	 * This avoids unnecessary reordering operations on initial render or refresh
	 * @param {Object} options - Table configuration
	 * @returns {Boolean} True if reordering is needed, false if already in natural order
	 */
	function needsReordering(options) {
		const $headers = options._self.find("thead th");
		let expectedIndex = 0;

		for (let i = 0; i < $headers.length; i++) {
			const $th = $($headers[i]);

			// Skip row counter column
			if ($th.hasClass("row-counter")) continue;

			const originalIndex = $th.attr("data-original-index");

			// Skip headers without data-original-index
			if (
				originalIndex === undefined ||
				originalIndex === null ||
				originalIndex === ""
			)
				continue;

			// Check if this column is in its expected position
			if (parseInt(originalIndex) !== expectedIndex) {
				return true; // Found a column out of order
			}

			expectedIndex++;
		}

		return false; // All columns are in their natural order
	}
})(jQuery);
