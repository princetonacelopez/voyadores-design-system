(function ($) {

    let settings = [];

    $.fn.table = function (options, params) {

        let setting = {};
        let table = $(this);

        const currentId = table.attr('id');
        if (!currentId) return;

        if (typeof (options) === 'object') {

            let instance    = {
                id                  : currentId,
                endpoint            : '',
                type                : 'GET',
                mappingFunction     : function (data) { return ''; },
                success             : function (e, data) { return; },
                fail                : function (error) { return; },
                messageNoResult     : 'No records returned',
                messageErrorOccured : 'Error occurred',
                messageNotFound     : 'Data not found',
                cssClassNoResult    : 'text-center',
                messageLoading      : 'Loading data...',
                messageNoPermission : "No permission given to view this data",
                params              : {},
                data                : [],
                headers             : [],
                async               : true
            };
            setting = Object.assign(instance, options);
            settings.push(setting);

            generateTableHeaders(table, setting);

            refresh(table, setting);

        }

        if (typeof (options) === 'string') {
            
            if (options == 'refresh') {

                const settingIndex = settings.findIndex(e => e.id == currentId);
                let foundSetting = settings[settingIndex];
                if (foundSetting) {

                    //If a parameter was passed, set it
                    if (params) {
                        if (params.constructor.name == 'Object')
                            foundSetting.params = params;
                        if (params.constructor.name == 'Array')
                            foundSetting.data = params;
                    }
                    
                    setting = Object.assign(foundSetting, setting);

                    settings[settingIndex] = setting;

                    refresh(table, setting);

                }
            }

            if (options == 'load') {
                const settingIndex = settings.findIndex(e => e.id == currentId);
                let foundSetting = settings[settingIndex]
                if (foundSetting) {
                    //If a parameter was passed, set it
                    if (params) {
                        foundSetting.data = params;
                    }

                    setting = Object.assign(foundSetting, setting);

                    settings[settingIndex] = setting;

                    load(setting);

                }
            }

            if (options == 'clear') {
                clear(table);
            }
        }

        return table;
    }

    //Actions
    function clear(table) {
        table.find('tbody').empty();
    }

    function refresh(table, setting) {

        //Add loading status on the table
        generateTableBody(table, setting, 0);

        if (!setting.endpoint) {
            generateTableBody(table, setting, 200);
            setting.success();
            return;
        }

        //Build the API call parameters
        let parameters = {
            context     : document.body,
            dataType    : 'json',
            async       : setting.async,
            statusCode: {
                403: function () {
                    generateTableBody(table, setting, 403);
                },
                404: function (response) {
                    setting.data = response;
                    generateTableBody(table, setting, 404);
                },
                500: function (response) {
                    setting.data = response;
                    generateTableBody(table, setting, 500);
                },
                200: function (response) {
                    setting.data = response;
                    generateTableBody(table, setting, 200);
                }
            },
            complete: function (data) {
                setting.success();
            }
        };

        //Check the call type
        if (setting.type.toUpperCase() == 'GET') {

            //If GET, build querystring
            let queryString = '';
            try {
                queryString = jQuery.param(setting.params);
            } catch (exception) {
                queryString = '';
            }

            parameters.url = setting.endpoint + '?' + queryString;

        } else if (setting.type.toUpperCase() == 'POST') {

            //If POST, pass the object as usual
            parameters.url = setting.endpoint;
            parameters.data = setting.params;
        } else {
            setting.fail("Unsupported call type");

            return;
        }

        //Perform the call
        $.ajax(parameters);
    }

    function load(table, setting) {

        generateTableBody(table, setting, 200);
        setting.success();
        
    }

    //Header
    function generateTableHeaders(table, setting) {

        if (setting.headers.length <= 0)
            return;

        let thead = table.find('thead');
        if (thead) {
            let order = 0;
            let html = setting.headers.map(header => {
                const headerHtml = generateTableHeader(header, order);
                order++;

                return headerHtml;
            });

            thead.html(`<tr>${html}</tr>`);
        }

        table.find('thead a').click(function () {
            let sort = $(this).attr('data-sort');
            let sortDirection = $(this).attr('data-sort-direction');

            let sortParams = {
                sort: sort,
                sortDirection: sortDirection
            };
            let oldParams = setting.params;
            let newParams = Object.assign(oldParams, sortParams);

            setting.headers = updateHeaderCurrentSort(setting.headers, sort);
            setting.params = newParams;

            generateTableHeaders(table, setting);

            refresh(table, setting);
        });
    }

    function generateTableHeader(headerExpression, order) {

        let header = buildHeaderObject(headerExpression, order);
        let headerClass = header.class == null ? '' : `class=${header.class}`;
        let sortIcon = buildSortIcon(header.sortDirection, header.sortCurrent);
        let headerLabel = buildHeaderLabel(header);

        return `<th ${headerClass}>
                    ${headerLabel} ${sortIcon}
                </th>`;
    }

    function buildHeaderLabel(header) {
        let headerLabel = '';
        if (header.sortable) {
            headerLabel = `<a href="#" data-sort="${header.order}" data-sort-direction="${header.sortDirection}">${header.label}</a>`;
        } else {
            headerLabel = header.label;
        }

        return headerLabel;
    }

    function buildSortIcon(direction, current) {

        let icon = '';
        if (current) {
            if (direction == 0) {
                icon = '&#9660';
            } else if (direction == 1) {
                icon = '&#9650';
            }
        }

        return icon;
    }

    function buildHeaderObject(expression, order) {

        return {
            sortCurrent   : checkHeaderIsCurrentSort(expression),
            sortable      : checkHeaderSortable(expression),
            sortDirection : getHeaderSortDirection(expression),
            label         : getHeaderLabel(expression),
            order         : order,
            class         : getHeaderClass(expression),
        };
    }

    function getHeaderSortDirection(expression) {

        let regex = /\[([^\[\]]*)\]/g;
        let matches = expression.match(regex);
        if (matches) {
            const match = matches.find(m => m === '[v]' || m === '[ʌ]');
            if (match) {
                let bracketedString = match.substring(1, match.length - 1);
                if (bracketedString === "v") {
                    return 0;
                } else if (bracketedString === "ʌ") {
                    return 1;
                }
            }
        }


        return 1;
    }

    function getHeaderLabel(expression) {

        let regex = /^[a-zA-Z0-9#\s]+(?=\[)|^[a-zA-Z0-9#\s]+/;
        let match = expression.match(regex);

        return match ?? "";

    }

    function updateHeaderCurrentSort(headers, currentSort) {
        const previousOrder = headers.findIndex(h => h.includes('[0]'));
        const currentOrder = parseInt(currentSort);
        if (previousOrder == currentOrder) {
            let currentHeader = headers[currentOrder];
            const regex = /\[([^\[\]]*)\]/g;
            const matches = currentHeader.match(regex);
            if (matches) {
                const match = matches.find(m => m === '[v]' || m === '[ʌ]');
                if (match) {
                    let bracketedString = match.substring(1, match.length - 1);
                    if (bracketedString === 'v') {
                        currentHeader = currentHeader.replace('[v]', '[ʌ]');
                    } else if (bracketedString === 'ʌ') {
                        currentHeader = currentHeader.replace('[ʌ]', '[v]');
                    }
                }
            }
            headers[currentOrder] = currentHeader + '[0]';

        } else {
            headers[currentOrder] = headers[currentOrder] + '[0]';
        }
        

        if (previousOrder > -1) {
            headers[previousOrder] = headers[previousOrder].replace('[0]', '');
        }

        return headers;
    }

    function getHeaderClass(expression) {
        let regex = /\[c=([^\[\]]*)\]/;
        let match = expression.match(regex);
        if (match) {
            return match[1];
        }
        return null;
    }

    function checkHeaderSortable(expression) {
        return /\[(v|ʌ)\]/.test(expression);
    }

    function checkHeaderIsCurrentSort(expression) {
        return /\[(0)\]/.test(expression);
    }

    //Body
    function generateTableBody(table, setting, code) {
        let html        = '';
        let tbody       = table.find('tbody');
        let colspanHtml = getColspan(table);

        //Clear whatever is on the table
        tbody.find('tr').remove();

        //Add a loader
        if (code == 0) {
            html = `<tr>
                       <td ${colspanHtml} class="busy ${setting.cssClassNoResult}"><strong>${setting.messageLoading}</strong></td>
                   </tr>`;

        }

        // No permission given
        if (code == 403) {
            html = `<tr>
                       <td ${colspanHtml} class="busy ${setting.cssClassNoResult}"><strong>${setting.messageNoPermission}</strong></td>
                   </tr>`;

        }

        //No endpoint was found
        if (code == 404) {
            html = `<tr>
                       <td ${colspanHtml} class="${setting.cssClassNoResult}">${setting.messageNotFound}</td>
                   </tr>`;
        }

        //Something's wrong with the endpoint
        if (code == 500) {
            html = `<tr>
                       <td ${colspanHtml} class="${setting.cssClassNoResult}">${setting.messageErrorOccured}</td>
                   </tr>`;
        }

        //Green
        if (code == 200) {
            html = setting.mappingFunction(setting.data);

            if (html == '') {
                html = `<tr>
                           <td ${colspanHtml} class="${setting.cssClassNoResult}"><strong>${setting.messageNoResult}</strong></td>
                       </tr>`;
            }
        }

        tbody.html(html);
    }

    function getColspan(table) {

        let colspan = 1;

        //Get the number of columns of table
        table.find('thead > tr:nth-child(1) th').each(function () {
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

}(jQuery));