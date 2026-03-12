var globalURI = new URI('/');
var globalAccountId = "";

function URI(baseURI) {

    this.baseURI    = baseURI;
    this.buildURI   = function(path, controller, params) {

        let defaultController = '/';
        if (controller != undefined)
            defaultController = controller + '/';

        if (this.baseURI == undefined || this.baseURI == '')
            this.baseURI = '/';

        let queryString = buildQueryString(params);

        return `${this.baseURI}${defaultController}${path}${queryString}`;
    }

    this.buildUrl = function (path, params) {

        if (!this.baseURI)
            this.baseURI = '/';

        let queryString = buildQueryString(params);

        return `${this.baseURI}${path}/${queryString}`;
    }

    function buildQueryString(params) {
        let queryString = '';
        if (params != undefined) {
            queryString = '?' + Object.keys(params)
                                      .map(key => `${key}=${params[key]}`)
                                      .join('&');
        }

        return queryString;
    }
}
