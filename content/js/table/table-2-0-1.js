/*!
 * JQuery Custom Table v2.0.1
 * (c) 2024 Network Economic Services Ventures Philippines, Inc.
 * Date: 10/01/2024
 * All rights reserved.
 */

(function ($) {

    // Default configuration options
    const defaultConfig = {
        endpoint                : "",
        mappingFunction         : () => "",
        success                 : () => "",
        fail                    : () => "",
        transformData           : null,
        messageNoResultHeader   : 'No data found',
        messageNoResult         : `There's nothing to display here at the moment.`,
        messageNoPermission     : `You don't have permission to view this content.`,
        messageErrorOccured     : `There's a problem loading this content. Please try again later.`,
        messageNotFound         : `The content you're looking for isn't available. It might have been moved or deleted.`,
        cssClassNoResult        : '',
        messageLoading          : 'Loading data...',
        imageEmpty              : '/content/images/states/empty/voyadores.default.empty.svg',
        params                  : () => ({}),
        data                    : [],
        async                   : true,
        rowCounter              : true,
        headers: {
            hideOnEmpty         : false,        
            sortable            : []            
        },
        loadMore: {
            id                  : "",
            hideOnEmpty         : true,
            showOnPageSize      : 20,
            onEmpty             : () => "",
        },
    };

    // The page count if load more is set. Will increment
    // on its entire lifecycle unless a new table instance is called
    let pageCount = 1;

    $.fn.table = function (options, params) {
        // set the page count back to 1
        pageCount = 1;

        if (typeof (options) === 'object') {

            initialize(options, this);

        } else if (typeof options === "string") {

            handleStringCommand(options, params, this);

        }
    }

    function initialize(options, self) {
        const $table = $(self);
        const id = $table.attr("id");

        if (!id) return;

        options._id = id;
        options._self = $table;

        const userOptions = $.extend(true, {}, defaultConfig, options);

        $table.data("config", userOptions);

        refresh(userOptions);
    }

    function handleStringCommand(options, params, self) {
        const $table = $(self);

        // Check if table instance already exist
        const storedOptions = $table.data("config") || null;

        if (!storedOptions)
            throw new Error(`Unable to trigger '${options}'. No existing instance found with the id of '${$table.attr("id")}'.`);

        if (options === "refresh") {
            if ($.isArray(params)) {
                const isValid = validateDataStructure(params);

                storedOptions.data = isValid ? params : [];
            }
            else if (typeof params === "object")
                storedOptions.params = () => params;
            else if (typeof params === "function")
                storedOptions.params = params;
        }

        if (options === "clear") {
            clearTableBody(storedOptions);
            return;
        }

        refresh(storedOptions);
    }

    function refresh(options) {

        // Builds the initial table body with a loading message
        generateTableBody(options);

        // Hide load more button when table is in loading state
        loadMore(options, []);

        if (!options.endpoint) {

            if (options.transformData && typeof options.transformData === "function") {
                options.data = options.transformData(options.data);
            }

            // Sets the sortable headers
            setSortableHeaders(options);

            generateTableBody(options, 200);
            loadMore(options, options.data, 200);
            options.success(options.data);
            return;

        }

        handleAjaxCall(options, (data, status) => {
            if (status === 200) {
                options.data = data;

                // Sets the sortable headers
                setSortableHeaders(options);

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

    function loadMore(options, data, status) {
        const loadMoreConfig = options.loadMore;

        if ($.isArray(loadMoreConfig) || !loadMoreConfig.id) return;

        const element = $(`#${loadMoreConfig.id}`).show();

        if (status !== 200 || !data.length || data.length < loadMoreConfig.showOnPageSize)
            return element.hide();

        element.off().click(function () {
            $(this).prop("disabled", true);

            // increment page by 1 for every fetch
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
        })
    }

    function processNewPagedData(options, data) {
        const $table = options._self;
        const activeSort = getActiveHeaderSort(options);

        options.data.push(...data);

        if (activeSort) {
            sortData(options.data, activeSort.sortBy, activeSort.sort);
            onSuccess(options);
            addColumnSortIndicator($table, activeSort.colIndex);
        } else {
            onSuccess(options);    
        }
    }

    function getActiveHeaderSort(options) {
        const activeSortHeader = options._self.find("thead th a.sort.active");
        if (activeSortHeader.length === 0) return null;
        const sortBy = activeSortHeader.attr("data-sort-by");
        const colIndex = activeSortHeader.attr("data-column-index");
        const sort = activeSortHeader.attr("data-sort") === "desc" ? "asc" : "desc";

        return { sort, sortBy, colIndex };
    }

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

        //Build the API call parameters
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

        //Perform the call
        $.ajax(parameters);
    }

    function setSortableHeaders(options) {

        const sortableHeaders = options.headers.sortable;
        const hasData = options.data && $.isArray(options.data) && options.data.length > 0;

        if (!$.isArray(sortableHeaders) || !hasData) return;

        const thead = options._self.find('thead');
        const theadChildren = [...thead.find("tr").children()];

        if (!thead || theadChildren.length === 0) return;

        // remove unsortable data type context
        sortableHeaders.forEach(header => {
            const contextValues = options.data.map(obj => obj[header.context] ?? "");

            if (contextValues.every(c => typeof c === "string" || typeof c === "number")) return;

            console.warn(`Unable to set column '${header.column}' as sortable. The context '${header.context}' is not of type string or number.`)
            sortableHeaders.splice(sortableHeaders.findIndex(a => a.context === header.context), 1);
        })

        const theadHtml = buildSortableHeaders(sortableHeaders, theadChildren, options.rowCounter);

        thead.html(theadHtml);

        // add click event listener for column sorting
        sortEventHandler(thead.find("tr a"), options);
    }

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
        })
    }

    function onSuccess(options) {
        clearTableBody(options);
        generateTableBody(options, 200);
        options.success(options.data);
    }

    function addColumnSortIndicator($table, index) {
        $table.find(`tbody td:nth-child(${parseInt(index) + 1})`).each((_, td) => $(td).toggleClass("sort-active"));
    }

    function modifyHeaderSortDirection(sortedColumn, sort, options) {
        if (sort === "asc") {
            $(sortedColumn).attr("data-sort", "desc");
            $(sortedColumn).removeClass("sort-desc active").addClass("sort-asc active");
        } else {
            $(sortedColumn).attr("data-sort", "asc");
            $(sortedColumn).removeClass("sort-asc active").addClass("sort-desc active");
        }

        const currentIndex = $(sortedColumn).attr("data-column-index");
        const inactiveSort = [...options._self.find('thead a.sort-asc, thead a.sort-desc')]
            .filter(a => $(a).attr("data-column-index") !== currentIndex);

        inactiveSort.forEach(s => {
            $(s).attr({
                "class": "sort",
                "data-sort": "asc"
            });
        });
    }

    function clearTableBody(options) {
        options._self.find('tbody').empty();
    }

    function sortData(data, key, direction) {
        if (!$.isArray(data)) return;

        return data.sort((a, b) => {
            const aValue = a[key] ?? "";
            const bValue = b[key] ?? "";

            return handleSorting(aValue, bValue, direction);
        });
    }

    function handleSorting(firstElement, secondElement, sortOrder) {
        // Sort by numeric
        if (typeof firstElement === 'number' && typeof secondElement === 'number') {
            return sortOrder === 'asc' ? firstElement - secondElement : secondElement - firstElement;
        }
        // Sort by string
        else if (typeof firstElement === 'string' && typeof secondElement === 'string') {
            return sortOrder === 'asc' ? firstElement.localeCompare(secondElement) : secondElement.localeCompare(firstElement);
        }

        // Default to ascending if types are different or not supported
        return sortOrder === 'asc' ? firstElement - secondElement : secondElement - firstElement;
    }

    function buildSortableHeaders(sortableHeaders, theadChildren, isCountable) {
        let headersHtml = "";
        const isCounted = $(theadChildren[0]).hasClass("row-counter");

        theadChildren.forEach((childHeader, idx) => {
            const headerClassNames = $(childHeader).attr("class") ?? "";
            const colIndex = isCountable && !isCounted ? idx + 1 : idx;
            const sortableHeader = sortableHeaders.find(a => a.column === colIndex || a.column === $(childHeader).text().trim());

            // Check if the header already has the 'sortable' class
            if ($(childHeader).hasClass('sortable')) {
                headersHtml += `${childHeader.outerHTML}`;
                return;
            }

            if (!sortableHeader) {
                headersHtml += `${childHeader.outerHTML}`;
            } else {
                const text = sortableHeader.customText ?? $(childHeader).html();
                let newHeader = text;

                if (sortableHeader.context && typeof sortableHeader.context === "string") {
                    const defaultSort = sortableHeader.defaultSort ?? "asc";

                    newHeader = `<a class="sort" 
                                    data-sort="${defaultSort}" 
                                    data-column-index="${colIndex}"
                                    data-sort-by="${sortableHeader.context}"
                                    href="javascript:void(0)">${text}
                                </a>`;
                }

                headersHtml += `<th scope="col" class="${headerClassNames} sortable">${newHeader}</th>`;
            }
        })

        return `<tr>${headersHtml}</tr>`;
    }

    function generateTableBody(options, code = 0) {
        const $table             = options._self;
        const domainURL          = getDomainURL();
        const loaderImageURL     = `${domainURL}/content/images/states/loader/voyadores-loader.gif`;
        const error403ImageURL   = `${domainURL}/content/images/states/error/voyadores-403.svg`;
        const error404ImageURL   = `${domainURL}/content/images/states/error/voyadores-404.svg`;
        const error500ImageURL   = `${domainURL}/content/images/states/error/voyadores-500.svg`;
        const emptyImageURL      = `${domainURL}${options.imageEmpty}`;
        let html                 = '';
        let tbody                = $table.find('tbody');
        let colspanHtml          = getColspan($table);

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
    }

    function setTableBehaviors(options, status) {
        if (status !== 200) return;

        // Table behaviors
        setRowCounter(options);
        setHeaderOnEmpty(options);
    }

    function setRowCounter(options) {
        if (!options.rowCounter) return;

        const $table = options._self;

        if (!$table.find("thead th:nth-child(1)").hasClass("row-counter"))
            $table.find("thead tr").prepend("<th scope='col' class='row-counter text-center'>#</th>");

        if (options.data.length < 1) return;
        $table.find("tbody tr").each((i, tr) => $(tr).prepend(`<td class="row-counter text-center">${i + 1}</td>`));
    }

    function setHeaderOnEmpty(options) {
        const $table = options._self;
        const headerConfig = options.headers;
        const $tr = $table.find("thead tr");

        if (!headerConfig.hideOnEmpty || options.data.length > 0) {
            $tr.removeAttr("style");
            return;
        };

        $tr.css("display", "none");
    }

    function getColspan($table) {
        let colspan = 1;

        //Get the number of columns of table
        $table.find('thead > tr:nth-child(1) th').each(function () {
            if ($(this).attr('colspan')) {
                colspan += +$(this).attr('colspan');
            } else {
                colspan++;
            }
        });

        let colspanHtml = '';
        if (colspan > 1)
            colspanHtml = `colspan="${colspan}"`;

        return colspanHtml;
    }

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

    function getDomainURL() {
        const domainURLInput = document.getElementById('voyadores-cdn-url');
        return domainURLInput?.value || '';
    }

}(jQuery));