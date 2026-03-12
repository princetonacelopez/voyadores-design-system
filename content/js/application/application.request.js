// TODO: Beware of global variables.
const globalRequest = new Request();

function Request() {
    const globalAxios = axios.create({
        transformRequest: [(data, headers) => {

            headers['__RequestVerificationToken'] = document.getElementsByName('__RequestVerificationToken')[0].value;

            return data;

        }, ...axios.defaults.transformRequest],
    });

    // Store any pending requests while token is refreshed
    const pendingRequests = [];
    let isTokenRefreshInitiated = false;

    this.get = (path, parameters) => globalAxios.get(path, { params: parameters });

    this.post = (path, parameters) => globalAxios.post(path, parameters);

    // Intercept response
    globalAxios.interceptors.response.use(responseSuccess, responseError);

    function responseSuccess(response) {
        if (isTokenRefreshInitiated) {
            isTokenRefreshInitiated = false;
        }

        return response;
    }

    async function responseError(error) {

        // If not related to authentication, just return the error
        if (!error?.response || error.response.status !== 401) {
            return Promise.reject(error);
        }

        // If token refresh is already ongoing, queue the other failed request again to
        // be resent later after refresh is complete
        if (isTokenRefreshInitiated) {
            return new Promise(resolve => pendingRequests.push(() => resolve(globalAxios(error.config))));
        }

        isTokenRefreshInitiated = true;

        try {
            // Create a separate instance of axios to avoid conflicts with
            // the globalAxios instance
            const mvcClient = axios.create();

            const mvcResponse = await mvcClient.get("/session/get-refresh-token-cookie");

            if (!mvcResponse) {
                isTokenRefreshInitiated = false;
                return Promise.reject(error);
            }

            const { token, api } = mvcResponse.data;

            if (!token || !api) {
                isTokenRefreshInitiated = false;
                return Promise.reject(error);
            }

            const apiClient = axios.create({
                baseURL: api,
                headers: {
                    "X-Refresh-Token": token
                }
            })

            const apiResponse = await apiClient.post("v1/auth/refresh", {});

            if (!apiResponse || apiResponse.data.StatusCode !== 200) {
                isTokenRefreshInitiated = false;
                return Promise.reject(error);
            }

            const tokenData = apiResponse.data.Data;
            await mvcClient.post("/session/set-session-cookies", {
                refreshToken: tokenData.RefreshToken,
                accessToken: tokenData.AccessToken
            });

            // All queued requests will be resent after the 
            // token cookies are successfully set
            pendingRequests.forEach(resend => resend());

            // Resends the original request
            return globalAxios(error.config);
        } catch {
            isTokenRefreshInitiated = false;
            return Promise.reject(error);
        }
    }
}


$(function () {

    let isTokenRefreshInitiated = false;
    const pendingRequests = [];

    // Global token refresh handler for any requests that uses jQuery AJAX
    $(document).ajaxError(async function (event, jqXHR, options) {
        if (jqXHR.status === 401) {
            const deferred = $.Deferred();

            // Queue the failed request to retry after token refresh
            pendingRequests.push([options, deferred]);

            if (!isTokenRefreshInitiated) {
                isTokenRefreshInitiated = true;

                try {
                    // Create a separate instance of axios to avoid conflicts with
                    // the globalAxios instance
                    const mvcClient = axios.create();

                    const mvcResponse = await mvcClient.get("/session/get-refresh-token-cookie");

                    if (!mvcResponse) {
                        isTokenRefreshInitiated = false;
                        return;
                    };

                    const { token, api } = mvcResponse.data;

                    if (!token || !api) {
                        isTokenRefreshInitiated = false;
                        return;
                    }

                    const apiClient = axios.create({
                        baseURL: api,
                        headers: {
                            "X-Refresh-Token": token
                        }
                    })

                    const apiResponse = await apiClient.post("v1/auth/refresh", {});

                    if (!apiResponse || apiResponse.data.StatusCode !== 200) {
                        isTokenRefreshInitiated = false;
                        return;
                    };

                    const tokenData = apiResponse.data.Data;
                    await mvcClient.post("/session/set-session-cookies", {
                        refreshToken: tokenData.RefreshToken,
                        accessToken: tokenData.AccessToken
                    });

                    retryQueuedRequests();

                    isTokenRefreshInitiated = false;
                    pendingRequests.length = 0;

                } catch (e) {
                    isTokenRefreshInitiated = false;
                    throw new Error("An error occured while handling the request: ", e);
                }
            }

            return deferred.promise();
        }
    });

    function retryQueuedRequests() {
        while (pendingRequests.length > 0) {
            const [originalOptions, originalDeferred] = pendingRequests.shift();

            // Resend the original requests
            $.ajax(originalOptions)
                .done(originalDeferred.resolve)
                .fail(originalDeferred.reject);
        }
    }
})



