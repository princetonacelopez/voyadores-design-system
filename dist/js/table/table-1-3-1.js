(function ($) {

    let settings    = [];
    let setting     = {};
    let table;

    $.fn.table = function (options, params) {
        //If the parameter is object type
        if (typeof (options) === 'object') {
            //New instance of control
            //Create an instance with default values
            table           = $(this);
            var currentId   = table.attr('id');

            var instance    = {
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
                                params              : {},
                                data                : [],
                                refresh             : refresh,
                                sortKey             : null,
                                sortType            : null,
                                async               : true
            };
            setting = $.extend(true, instance, options);
            settings.push(setting);

            //Perform table content refresh
            refresh();

            //return an instance
            return table;
        }

        //If the parameter is string type
        if (typeof (options) === 'string') {
            
            //Check if current table setting is already existing
            //If so, use it
            //If not, use whatever was passed
            table           = $(this);
            var currentId   = table.attr('id');

            if (options == 'refresh') {

                var foundSettings   = $.grep(settings, function (e) { return e.id == currentId; });
                var foundSetting    = foundSettings[0];

                //If a parameter was passed, set it
                if(params != undefined)
                    foundSetting.params = params;

                if (foundSettings.length > 0) {

                    setting = $.extend(true, foundSettings[0], options);
                    settings.push(setting);


                    //Perform table content refresh
                    refresh();

                    //return an instance
                    return table;
                }
            }

            if (options == 'load') {
                var foundSettings   = $.grep(settings, function (e) { return e.id == currentId; });
                var foundSetting    = foundSettings[0];

                //If a parameter was passed, set it
                if (params != undefined)
                    foundSetting.data = params;

                if (foundSettings.length > 0) {

                    setting = $.extend(true, foundSettings[0], options);
                    settings.push(setting);


                    //Perform element content refresh
                    load();

                    //return an instance
                    return table;
                }
            }

            if (options == 'clear') {
                table.find('tbody').empty();
            }
        }

        return table;
    }

    function refresh() {

        //Add loading status on the table
        generateTableBody(null, 0);

        //Build the API call parameters
        var parameters = {
            context     : document.body,
            dataType    : 'json',
            async       : setting.async,
            statusCode  : {
                404: function (data) {
                    generateTableBody(data, 404);
                },
                500: function (data) {
                    generateTableBody(data, 500);
                },
                200: function (data) {
                    generateTableBody(data, 200);
                }
            },
            complete: function (data) {
                setting.success();
            }
        };

        //Check the call type
        if (setting.type.toUpperCase() == 'GET') {

            //If GET, build querystring
            var queryString = '';
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

    function load() {

        generateTableBody(setting.data, 200);
        setting.success();
        
    }

    function generateTableBody(data, code) {
        var html = '';
        var tbody   = table.find('tbody');
        //Clear whatever is on the table
        tbody.find('tr').remove();

        //Add a loader
        if (code == 0) {
            html = `<tr>
                       <td colspan="${getColspan(table)}" class="busy ${setting.cssClassNoResult}"><strong>${setting.messageLoading}</strong></td>
                   </tr>`;

        }

        //No endpoint was found
        if (code == 404) {
            html = `<tr>
                       <td colspan="${getColspan(table)}" class="${setting.cssClassNoResult}">${setting.messageNotFound}</td>
                   </tr>`;
        }

        //Something's wrong with the endpoint
        if (code == 500) {
            html = `<tr>
                       <td colspan="${getColspan(table)}" class="${setting.cssClassNoResult}">${setting.messageErrorOccured}</td>
                   </tr>`;
        }

        //Green
        if (code == 200) {
            try {
                html = setting.mappingFunction(data);
            } catch (exception) {
                html = '';
            }

            if (html == '') {
                html = `<tr>
                           <td colspan="${getColspan(table)}" class="${setting.cssClassNoResult}"><strong>${setting.messageNoResult}</strong></td>
                       </tr>`;
            }
        }

        tbody.html(html);
    }

    function getColspan(table) {
        //Get the number of columns of table
        var colspan = 1;
        table.find('thead > tr:nth-child(1) th').each(function () {
            if ($(this).attr('colspan')) {
                colspan += +$(this).attr('colspan');
            } else {
                colspan++;
            }
        });

        return colspan;
    }

    function sort() {
        if (setting.sortKey == null) return;

        var col     = setting.sortKey;
        var reverse = setting.sortType == 'asc' ? 1 : -1;
        var table   = document.getElementById(setting.id);
        var tb = table.tBodies[0],
            tr = Array.prototype.slice.call(tb.rows, 0), 
            i;

        tr = tr.sort(function (a, b) {
            return reverse 
                * (a.cells[col].textContent.trim() 
                    .localeCompare(b.cells[col].textContent.trim()));
        });
        for (i = 0; i < tr.length; ++i) tb.appendChild(tr[i]);
    }

}(jQuery));