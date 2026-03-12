(function ($) {

    let settings    = [];
    let setting     = {}

    $.fn.loadMore = function (options) {
        
        let loaderButton    = $(this);
        let currentId       = $(this).attr('id');
        let instance        = {
            id              : currentId,
            counter         : 1,
            endpoint        : '',
            tableBodyName   : '',
            mappingFunction : function (data) {
                return '';
            },
            callback        : function () {
                return;
            },
            loaderClass     : 'load-more disabled',
            eofCallback     : function () {
                return;
            },
            refreshParams   : function () {
                return;
            },
            params: {}
        };

        if (typeof (options) === 'object') {

            setting = $.extend(true, instance, options);
            settings.push(setting);
            
            loaderButton.off().click(function () {

                currentId = $(this).attr('id');
                //Check if current control setting is already existing
                //If so, use it
                //If not, use whatever was passed
                var foundSettings = $.grep(settings, function (e) { return e.id == currentId; });
                if (foundSettings.length > 0) {
                    setting = foundSettings[0];
                } else {
                    settings.push(setting);
                    setting.counter = 1;
                }

                //Disable the button first
                loaderButton.addClass(setting.loaderClass);

                var page = setting.counter;
                page++;

                //get refreshed params
                setting.params = setting.refreshParams();

                //Build querystring
                var queryString = '';
                try {
                    queryString = jQuery.param(setting.params);
                } catch (exception) {
                    queryString = '';
                }

                queryString += '&page=' + page;

                $.ajax({
                    url     : setting.endpoint + '?' + queryString,
                    dataType: 'json'
                }).done(function (data) {

                    //Call the mapping function
                    var html = '';
                    try {
                        html = setting.mappingFunction(data);
                    } catch (exception) {
                        html = '';
                    }

                    //If no code was generated
                    //it's the end of the line, notify
                    if (html == '') {
                        setting.eofCallback();

                        loaderButton.removeClass(setting.loaderClass);
                        return;
                    }

                    $('#' + setting.tableBodyName).append(html);

                    setting.callback();

                    //Only increment the control counter 
                    //if the handler successfully returned data
                    //Update the array value
                    updateCounter(setting.id);

                    loaderButton.removeClass(setting.loaderClass);
                });
            });
        }

        if (typeof (options) === 'string') {
            if (options == 'reset') {
                reset(currentId);
            }
        }

        return loaderButton;
    }

    function reset(id) {
        let setting = settings.find(s => s.id == id);
        if (setting)
            setting.counter = 1;
    }

    function updateCounter(id) {
        let setting = settings.find(s => s.id == id);
        if (setting)
            setting.counter++;
    }

}(jQuery));