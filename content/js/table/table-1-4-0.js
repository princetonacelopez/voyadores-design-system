(function ($) {

    let settings = [];

    $.fn.table = function (options, params) {

        let setting = {};
        let table   = null;

        //If the parameter is object type
        if (typeof (options) === 'object') {
            //New instance of control
            //Create an instance with default values
            table           = $(this);
            let currentId   = table.attr('id');

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
                params              : {},
                data                : [],
                async               : true
            };
            setting = Object.assign(instance, options);
            settings.push(setting);

            //Perform table content refresh
            refresh(table, setting);

            //return an instance
            return table;
        }

        //If the parameter is string type
        if (typeof (options) === 'string') {
            
            //Check if current table setting is already existing
            //If so, use it
            //If not, use whatever was passed
            table           = $(this);
            let currentId   = table.attr('id');

            if (options == 'refresh') {

                let foundSetting = settings.find((e) => e.id == currentId);
                if (foundSetting) {

                    //If a parameter was passed, set it
                    if (params != undefined)
                        foundSetting.params = params;

                    setting = Object.assign(foundSetting, options);
                    settings.push(setting);

                    //Perform table content refresh
                    refresh(table, setting);

                }
            }

            if (options == 'load') {
                let foundSettings = settings.find((e) => e.id == currentId);
                let foundSetting  = foundSettings[0];

                //If a parameter was passed, set it
                if (params != undefined)
                    foundSetting.data = params;

                if (foundSettings.length > 0) {

                    setting = Object.assign(foundSettings[0], options);
                    settings.push(setting);


                    //Perform element content refresh
                    load(setting);

                }
            }

            if (options == 'clear') {
                clear(table);
            }
        }

        return table;
    }

    function clear(table) {
        table.find('tbody').empty();
    }

    function refresh(table, setting) {

        //Add loading status on the table
        generateTableBody(table, setting, 0);

        //Build the API call parameters
        let parameters = {
            context     : document.body,
            dataType    : 'json',
            async       : setting.async,
            statusCode  : {
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