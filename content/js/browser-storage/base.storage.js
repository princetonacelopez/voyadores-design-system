export default class BrowserStorage {
    store(key, value, expirySeconds = null) {
        throw new Error("The method 'store(key, value, expirySeconds)' is not implemented")
    }

    has(key) {
        throw new Error("The method 'has(key)' is not implemented")
    }

    get(key) {
        throw new Error("The method 'get(key)' is not implemented")
    }

    remove(key) {
        throw new Error("The method 'remove(key)' is not implemented")
    }

    clear() {
        throw new Error("The method 'clear()' is not implemented")
    }
}