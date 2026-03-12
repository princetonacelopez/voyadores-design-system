import BrowserStorage from "./base.storage.js";

export default class SessionStorage extends BrowserStorage {
    /**
     * Get the user ID from the hidden input field
     * @returns {string|null} The user ID or null if not found
     */
    #getUserId() {
        const userIdInput = document.getElementById('voyadores-user-id');
        const userId = userIdInput?.value?.trim();

        if (!userId) {
            console.warn('[SessionStorage] User ID not found in DOM');
        }
        
        return userId || 'guest';
    }

    /**
     * Get the storage key for the current user
     * @returns {string} The storage key
     */
    #getStorageKey() {
        const userId = this.#getUserId();
        return userId;
    }

    /**
     * Get the user's storage object from sessionStorage
     * @returns {Object} The user's storage object
     */
    #getUserStorage() {
        const storageKey = this.#getStorageKey();
        const raw = sessionStorage.getItem(storageKey);
        
        if (!raw) {
            return {};
        }

        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch (error) {
            console.error('[SessionStorage] Failed to parse storage:', error);
            return {};
        }
    }

    /**
     * Save the user's storage object to sessionStorage
     * @param {Object} storageObj - The storage object to save
     */
    #setUserStorage(storageObj) {
        const storageKey = this.#getStorageKey();
        
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(storageObj));
        } catch (error) {
            console.error('[SessionStorage] Failed to save storage:', error);
        }
    }

    store(key, value, expirySeconds = null) {
        if (!key) {
            console.error('[SessionStorage] Cannot store with empty key');
            return;
        }

        const userStorage = this.#getUserStorage();
        
        userStorage[key] = {
            value,
            expiresAt: expirySeconds ? Date.now() + (expirySeconds * 1000) : null,
            storedAt: Date.now()
        };

        this.#setUserStorage(userStorage);
    }

    get(key) {
        if (!key) {
            console.error('[SessionStorage] Cannot get with empty key');
            return null;
        }

        const userStorage = this.#getUserStorage();
        const item = userStorage[key];
        
        if (!item) {
            return null;
        }

        // check for expiry
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.remove(key); // auto-clean expired items
            return null;
        }

        return item.value;
    }

    has(key) {
        if (!key) {
            return false;
        }

        const userStorage = this.#getUserStorage();
        const item = userStorage[key];
        
        if (!item) {
            return false;
        }

        // check for expiry
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.remove(key);
            return false;
        }

        return true;
    }

    remove(key) {
        if (!key) {
            console.error('[SessionStorage] Cannot remove with empty key');
            return;
        }

        const userStorage = this.#getUserStorage();
        
        if (key in userStorage) {
            delete userStorage[key];
            this.#setUserStorage(userStorage);
        }
    }

    /**
     * Clear all storage for the current user
     */
    clear() {
        const storageKey = this.#getStorageKey();
        sessionStorage.removeItem(storageKey);
    }

    /**
     * Get all keys stored for the current user
     * @returns {string[]} Array of keys
     */
    keys() {
        const userStorage = this.#getUserStorage();
        return Object.keys(userStorage);
    }

    /**
     * Get the size of items stored for the current user
     * @returns {number} Number of items
     */
    size() {
        return this.keys().length;
    }
}