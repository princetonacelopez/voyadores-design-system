---
title: "Browser Storage"
version: "1.0.0"
files: "`base.storage.js` · `local.storage.js` · `session.storage.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Browser Storage module provides a thin, consistent wrapper over the native `localStorage` and `sessionStorage` Web APIs. Both implementations share a common abstract interface (`BrowserStorage`) and add:

- **Optional TTL expiry** — store items with an expiry time in seconds; expired items are auto-removed on read.
- **User-scoped namespacing** (`SessionStorage` only) — all session data is stored under a key derived from the current user's ID, preventing data leakage between users on shared sessions.

---

## 2. Files

| File | Class | Description |
|---|---|---|
| `base.storage.js` | `BrowserStorage` | Abstract base class defining the storage interface. |
| `local.storage.js` | `LocalStorage` | Implements the interface using `window.localStorage`. |
| `session.storage.js` | `SessionStorage` | Implements the interface using `window.sessionStorage`, namespaced per user. |

---

## 3. Setup

Both classes are ES modules. Import the one you need:

```javascript
import LocalStorage   from '/js/browser-storage/local.storage.js';
import SessionStorage from '/js/browser-storage/session.storage.js';

const local   = new LocalStorage();
const session = new SessionStorage();
```

`SessionStorage` requires a `#voyadores-user-id` hidden input somewhere in the DOM to scope storage to the current user:

```html
<input type="hidden" id="voyadores-user-id" value="user-123" />
```

If the element is missing or empty, the key falls back to `"guest"`.

---

## 4. LocalStorage

`LocalStorage` wraps `window.localStorage`. Data persists across browser sessions until explicitly removed or expired.

### Storage format

Each entry is stored as a JSON object:

```json
{
    "value": <any>,
    "expiresAt": <timestamp ms> | null
}
```

`expiresAt` is `null` when no expiry is set (the item never expires automatically).

### Example

```javascript
const local = new LocalStorage();

local.store('theme', 'dark');                   // No expiry
local.store('token', 'abc123', 3600);           // Expires in 1 hour

local.has('theme');                             // → true
local.get('theme');                             // → "dark"
local.remove('theme');
local.clear();                                  // Clears all of localStorage
```

---

## 5. SessionStorage

`SessionStorage` wraps `window.sessionStorage`. Data is cleared when the browser tab/session ends.

### User scoping

All items for a user are stored under a single `sessionStorage` key — the user ID read from `#voyadores-user-id`. The value at that key is a JSON object containing all the user's entries:

```json
{
    "sidebarOpen": {
        "value": true,
        "expiresAt": null,
        "storedAt": 1741564800000
    },
    "lastTab": {
        "value": "invoices",
        "expiresAt": 1741568400000,
        "storedAt": 1741564800000
    }
}
```

This means `clear()` removes only the current user's data, not other users' entries in the same session.

### Extra methods

`SessionStorage` extends the base interface with two additional methods not available on `LocalStorage`:

| Method | Returns | Description |
|---|---|---|
| `keys()` | `string[]` | Returns all keys stored for the current user. |
| `size()` | `number` | Returns the count of items stored for the current user. |

### Example

```javascript
const session = new SessionStorage();

session.store('sidebarOpen', true);
session.store('lastTab', 'invoices', 1800);     // Expires in 30 minutes

session.has('sidebarOpen');                     // → true
session.get('lastTab');                         // → "invoices"
session.keys();                                 // → ["sidebarOpen", "lastTab"]
session.size();                                 // → 2
session.remove('lastTab');
session.clear();                                // Removes only current user's data
```

---

## 6. Expiry Behavior

Both classes support optional TTL expiry via the third argument to `store()`.

```javascript
storage.store('key', 'value', 60);  // Expires in 60 seconds
```

| Scenario | Behavior |
|---|---|
| `expirySeconds` omitted or `null` | Item never expires automatically. |
| Item is expired when `get()` is called | Item is removed from storage and `null` is returned. |
| Item is expired when `has()` is called | Item is removed from storage and `false` is returned. |
| Expiry is checked on every read | There is no background cleanup — expiry only runs on access. |

---

## 7. User-scoped Storage

`SessionStorage` reads the user ID from a DOM element on every operation:

```html
<input type="hidden" id="voyadores-user-id" value="user-456" />
```

| Condition | Storage key used |
|---|---|
| Element found with a non-empty value | The trimmed value (e.g. `"user-456"`) |
| Element missing or value is empty | `"guest"` |

> All reads and writes are scoped to this key. If the user ID changes mid-session (e.g. after login), subsequent operations will target a different namespace.

---

## 8. Storage Formats

### LocalStorage entry (one key per item)

```
localStorage["theme"] = '{"value":"dark","expiresAt":null}'
localStorage["token"] = '{"value":"abc123","expiresAt":1741568400000}'
```

### SessionStorage entry (one key per user, all items nested)

```
sessionStorage["user-456"] = '{
    "theme":    { "value": "dark",     "expiresAt": null,            "storedAt": 1741564800000 },
    "lastTab":  { "value": "invoices", "expiresAt": 1741568400000,   "storedAt": 1741564800000 }
}'
```

---

## 9. Method Reference

### `BrowserStorage` (abstract base)

All methods throw `Error` if called directly on the base class. Subclasses must implement them.

| Method | Signature | Description |
|---|---|---|
| `store` | `store(key, value, expirySeconds?)` | Persist a value. |
| `get` | `get(key)` | Retrieve a value, or `null` if missing or expired. |
| `has` | `has(key)` | Check whether a non-expired value exists for the key. |
| `remove` | `remove(key)` | Delete the entry for the key. |
| `clear` | `clear()` | Remove all entries. |

### `LocalStorage`

Inherits all five base methods. No additional methods.

| Method | Returns | Notes |
|---|---|---|
| `store(key, value, expirySeconds?)` | `void` | Serializes to JSON. `expirySeconds` defaults to `null`. |
| `get(key)` | `any \| null` | Returns `null` on missing, expired, or unparseable entries. |
| `has(key)` | `boolean` | Returns `false` on missing, expired, or unparseable entries. |
| `remove(key)` | `void` | Calls `localStorage.removeItem(key)`. |
| `clear()` | `void` | Calls `localStorage.clear()` — clears **all** keys in localStorage. |

### `SessionStorage`

Inherits and implements all five base methods, plus two extras.

| Method | Returns | Notes |
|---|---|---|
| `store(key, value, expirySeconds?)` | `void` | Stores under the current user's namespace. Logs an error if `key` is empty. |
| `get(key)` | `any \| null` | Auto-removes expired items. Logs an error if `key` is empty. |
| `has(key)` | `boolean` | Auto-removes expired items. Returns `false` if `key` is empty. |
| `remove(key)` | `void` | Deletes the key from the user's storage object. Logs an error if `key` is empty. |
| `clear()` | `void` | Removes only the current user's sessionStorage entry (not other users). |
| `keys()` | `string[]` | Returns all keys for the current user. |
| `size()` | `number` | Returns the number of items for the current user. |

---

## 10. Extending BrowserStorage

To create a custom storage backend, extend `BrowserStorage` and implement all five methods:

```javascript
import BrowserStorage from '/js/browser-storage/base.storage.js';

export default class CookieStorage extends BrowserStorage {
    store(key, value, expirySeconds = null) {
        // implement...
    }

    get(key) {
        // implement...
    }

    has(key) {
        // implement...
    }

    remove(key) {
        // implement...
    }

    clear() {
        // implement...
    }
}
```

---

## 11. Console Messages

| Class | Level | Message |
|---|---|---|
| `SessionStorage` | `warn` | `[SessionStorage] User ID not found in DOM` — `#voyadores-user-id` is missing or empty |
| `SessionStorage` | `error` | `[SessionStorage] Failed to parse storage:` — stored JSON is malformed |
| `SessionStorage` | `error` | `[SessionStorage] Failed to save storage:` — `sessionStorage.setItem` threw (e.g. quota exceeded) |
| `SessionStorage` | `error` | `[SessionStorage] Cannot store with empty key` |
| `SessionStorage` | `error` | `[SessionStorage] Cannot get with empty key` |
| `SessionStorage` | `error` | `[SessionStorage] Cannot remove with empty key` |

---

## 12. Full Example

```html
<input type="hidden" id="voyadores-user-id" value="user-789" />
```

```javascript
import LocalStorage   from '/js/browser-storage/local.storage.js';
import SessionStorage from '/js/browser-storage/session.storage.js';

// --- LocalStorage ---
const local = new LocalStorage();

// Store permanently
local.store('appVersion', '3.1.0');

// Store with 1-hour expiry
local.store('authToken', 'eyJhbGci...', 3600);

// Read
if (local.has('authToken')) {
    const token = local.get('authToken');    // → "eyJhbGci..."
}

// Remove
local.remove('authToken');

// Nuke everything
local.clear();


// --- SessionStorage ---
const session = new SessionStorage();

// Store tab state for the session
session.store('activeTab', 'invoices');

// Store with 30-minute expiry
session.store('searchQuery', 'acme corp', 1800);

// Read
const tab = session.get('activeTab');       // → "invoices"

// Check
session.has('searchQuery');                 // → true (if within 30 min)

// List all keys for this user
session.keys();                             // → ["activeTab", "searchQuery"]
session.size();                             // → 2

// Remove one
session.remove('searchQuery');

// Clear only this user's data
session.clear();
```
