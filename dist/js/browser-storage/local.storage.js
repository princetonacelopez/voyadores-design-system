import BrowserStorage from "./base.storage.js";

export default class LocalStorage extends BrowserStorage {
    constructor() {
        super();
    }

    store(key, value, expirySeconds = null) {
        const item = {
            value,
            expiresAt: expirySeconds ? Date.now() + expirySeconds * 1000 : null
        };
        localStorage.setItem(key, JSON.stringify(item));
    }

    get(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        try {
            const item = JSON.parse(raw);

            // Check for expiry
            if (item.expiresAt && Date.now() > item.expiresAt) {
                localStorage.removeItem(key);
                return null;
            }

            return item.value;
        } catch {
            return null;
        }
    }

    has(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return false;

        try {
            const item = JSON.parse(raw);

            // Check for expiry
            if (item.expiresAt && Date.now() > item.expiresAt) {
                localStorage.removeItem(key);
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    remove(key) {
        localStorage.removeItem(key);
    }

    clear() {
        localStorage.clear();
    }
}
