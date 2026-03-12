(function ($) {

    var settings    = [];
    var setting     = {};
    var element;
    var loader;

    $.fn.repeater = function (options, params) {
        //If the parameter is object type
        if (typeof (options) === 'object') {
            //New instance of control
            //Create an instance with default values
            element           = $(this);
            var currentId     = element.attr('id');

            var instance    = {
                                id              : currentId,
                                endpoint        : '',
                                type            : 'GET',
                                mappingFunction : function (data) { return ''; },
                                success         : function (e, data) { return; },
                                fail            : function (error) { return; },
                                messageNoResult : 'No records returned',
                                cssClassNoResult: 'text-center',
                                messageLoading  : 'Loading data...',
                                params          : {},
                                refresh         : refresh,
                                sortKey         : null,
                                sortType        : null,
                                async           : false
                            };
            setting = $.extend(true, instance, options);
            settings.push(setting);

            //Perform elemt content refresh
            refresh();

            //return an instance
            return element;
        }

        //If the parameter is string type
        if (typeof (options) === 'string') {
            
            //Check if current element setting is already existing
            //If so, use it
            //If not, use whatever was passed
            element         = $(this);
            var currentId   = element.attr('id');

            if (options == 'refresh') {

                var foundSettings   = $.grep(settings, function (e) { return e.id == currentId; });
                var foundSetting    = foundSettings[0];

                //If a parameter was passed, set it
                if(params != undefined)
                    foundSetting.params = params;

                if (foundSettings.length > 0) {

                    setting = $.extend(true, foundSettings[0], options);
                    settings.push(setting);


                    //Perform element content refresh
                    refresh();

                    //return an instance
                    return element;
                }
            }

            if (options == 'clear') {
                element.empty();
            }
        }

        return element;
    }

    function refresh() {

        //Add loading status on the element
        generateElementBody(null, 0);

        //Build the API call parameters
        var parameters = {
            context     : document.body,
            dataType    : 'json',
            type        : setting.type,
            async       : setting.async,
            statusCode  : {
                404: function (data) {
                    generateElementBody(data, 404);
                },
                500: function (data) {
                    generateElementBody(data, 500);
                },
                200: function (data) {
                    generateElementBody(data, 200);
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

            //If POST, past the object as usual
            parameters.url = setting.endpoint;
            parameters.data = setting.params;
        } else {
            setting.fail("Unsupported call type");

            return;
        }

        //Perform the call
        $.ajax(parameters);
    }

    function generateElementBody(data, code) {
        var html = '';

        element.empty();


        //Add a loader
        if (code == 0) {
            html = '<div class="' + setting.cssClassNoResult + '">' +
                   '    <strong>' + setting.messageLoading + '</strong>' +
                   '</div>';

        }

        //No endpoint was found
        if (code == 404) {
            html = '<div class="' + setting.cssClassNoResult + '">' +
                   '    No data' +
                   '</div>';
        }

        //Something's wrong with the endpoint
        if (code == 500) {
            html = '<div class="' + setting.cssClassNoResult + '">' +
                   '    Error occured' +
                   '</div>';
        }

        //Green
        if (code == 200) {
            try {
                html = setting.mappingFunction(data);
            } catch (exception) {
                html = '';
            }

            if (html == '') {
                html = '<div class="' + setting.cssClassNoResult + '">' +
                       '    <strong>' + setting.messageNoResult + '</strong>' +
                       '</div>';
            }
        }

        element.html(html);
    }

}(jQuery));