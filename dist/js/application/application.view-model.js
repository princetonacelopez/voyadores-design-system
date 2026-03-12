/*
 * 
 * Base class for all ViewModels
 * 
 */

import BrowserStorage from "../browser-storage/base.storage.js";

const _privateProps = new WeakMap();

export default class ViewModelBase {
    constructor(basePath, httpClient, storage = null) {

        if (!basePath)
            throw new Error("A view model must pass the base path as super()");

        if (!httpClient)
            throw new Error("A view model must pass an instance of a HTTP client");

        if (storage && !(storage instanceof BrowserStorage)) {
            throw new Error('storage must be an instance of BrowserStorage');
        }

        else {
            this.storage = storage;
        }

        this.basePath = basePath;

        _privateProps.set(this, {
            _httpClient: httpClient
        })
    }

    get = async (path, params = {}) => {
        if (this.storage) {
            // if nothing was stored
            if (!this.storage.has(path)) {

                const response = await _privateProps.get(this)._httpClient.get(this.#resolvePath(path), params);
                const tenMinsInSecs = 600;

                this.storage.store(path, response.data, tenMinsInSecs);

                return response.data;

            } else {

                return this.storage.get(path);

            }

        }

        const response = await _privateProps.get(this)._httpClient.get(this.#resolvePath(path), params);

        return response.data;
    };

    post = (path, params = {}) => _privateProps.get(this)._httpClient.post(this.#resolvePath(path), params);

    safeGet = async (path, params = {}) => {
        try {
            const response = await _privateProps.get(this)._httpClient.get(this.#resolvePath(path), params);
            return [response, null];
        } catch (e) {
            return [null, {
                response: e?.response ?? null,
                message: e?.message ?? e
            }];
        }
    }

    safePost = async (path, params = {}) => {
        try {
            const response = await _privateProps.get(this)._httpClient.post(this.#resolvePath(path), params);
            return [response, null];
        } catch (e) {
            return [null, {
                response: e?.response ?? null,
                message: e?.message ?? e
            }];
        }
    }

    #resolvePath(relative = "/") {
        const currentUrl = new URL(location.href);
        currentUrl.pathname = `${this.basePath}/${relative}`;
        return currentUrl.href
            .replace("://", "__PROTO__")
            .replace(/([^:]\/)\/+/g, '$1')
            .replace("__PROTO__", "://");
    }
}