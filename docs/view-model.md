---
title: "View Model"
version: "1.0.0"
files: "`content/js/application/application.view-model.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

`ViewModelBase` is an ES module base class for all application view models. It wraps an HTTP client with a consistent `get` / `post` interface, optional `BrowserStorage`-backed caching for GET requests, and safe variants that return `[data, error]` tuples instead of throwing.

The HTTP client is stored in a `WeakMap` keyed by the instance, keeping it fully private and inaccessible outside the class.

---

## 2. Features

| Feature | Description |
|---|---|
| Private HTTP client | Stored in a `WeakMap` — not accessible via `instance._httpClient` |
| Optional GET caching | Pass any `BrowserStorage` implementation; GET responses are cached for 10 minutes |
| Safe methods | `safeGet` and `safePost` return `[data, error]` tuples — no try/catch needed at the call site |
| Automatic URL resolution | Joins `basePath` + relative path and normalizes double slashes |
| Constructor guards | Throws immediately if `basePath`, `httpClient`, or `storage` type are invalid |

---

## 3. Dependencies

| Module | Required | Description |
|---|---|---|
| `../browser-storage/base.storage.js` | **Yes** | `BrowserStorage` abstract base — used only for `instanceof` validation of the `storage` argument |

No jQuery or other runtime dependencies.

---

## 4. Setup

```javascript
import ViewModelBase from '/js/application/application.view-model.js';
```

`ViewModelBase` is not used directly — extend it to build feature-specific view models.

---

## 5. Constructor

```javascript
constructor(basePath, httpClient, storage = null)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `basePath` | `string` | **Yes** | The URL path prefix for all requests, e.g. `"/reports"`. |
| `httpClient` | `object` | **Yes** | An HTTP client with `.get(url, params)` and `.post(url, params)` methods. |
| `storage` | `BrowserStorage` instance | No | A `BrowserStorage` subclass instance used to cache GET responses. Defaults to `null` (no caching). |

### Throws

| Condition | Error message |
|---|---|
| `basePath` is falsy | `"A view model must pass the base path as super()"` |
| `httpClient` is falsy | `"A view model must pass an instance of a HTTP client"` |
| `storage` is provided but not a `BrowserStorage` instance | `"storage must be an instance of BrowserStorage"` |

### Public properties set by constructor

| Property | Type | Description |
|---|---|---|
| `this.basePath` | `string` | The base path passed to the constructor. Accessible from subclasses. |
| `this.storage` | `BrowserStorage \| null` | The storage instance, or `null` if not provided. |

---

## 6. Methods

### `get(path, params?)`

Performs a GET request. If a `storage` instance was provided, checks the cache first and stores the response for 10 minutes on a miss.

```javascript
const data = await this.get('list', { page: 1 });
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | Relative path appended to `basePath`. Also used as the cache key. |
| `params` | `object` | `{}` | Query parameters passed to the HTTP client. |



---

### `post(path, params?)`

Performs a POST request. No caching.

```javascript
const response = await this.post('save', { name: 'Acme Corp' });
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | Relative path appended to `basePath`. |
| `params` | `object` | `{}` | Request body passed to the HTTP client. |


---

### `safeGet(path, params?)`

Same as `get` but catches errors and returns a `[response, error]` tuple. Does **not** use the cache.

```javascript
const [response, error] = await this.safeGet('list');

if (error) {
    console.error(error.message);
} else {
    console.log(response.data);
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | Relative path appended to `basePath`. |
| `params` | `object` | `{}` | Query parameters. |


| Tuple index | On success | On error |
|---|---|---|
| `[0]` | Full HTTP response object | `null` |
| `[1]` | `null` | `{ response: e?.response ?? null, message: e?.message ?? e }` |

---

### `safePost(path, params?)`

Same as `post` but catches errors and returns a `[response, error]` tuple.

```javascript
const [response, error] = await this.safePost('save', { name: 'Acme Corp' });

if (error) {
    console.error(error.message);
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | Relative path appended to `basePath`. |
| `params` | `object` | `{}` | Request body. |


---

## 7. Caching Behavior

Caching is only active when a `BrowserStorage` instance is passed to the constructor. Only `get()` (not `safeGet`) uses the cache.

### Flow

```
get(path, params)
    │
    ├── storage === null ──────────────────► HTTP GET → return response.data
    │
    └── storage present
            │
            ├── storage.has(path) === false ──► HTTP GET
            │                                    → storage.store(path, data, 600)
            │                                    → return response.data
            │
            └── storage.has(path) === true ───► return storage.get(path)
```

### Cache key

The **relative `path` string** is used as the cache key, not the full URL. Keys are not namespaced by `basePath` — if two view models with different base paths call `get('list')`, they will share the same cache entry if they share the same storage instance.

### TTL

All cached entries expire after **600 seconds (10 minutes)**. This is hardcoded.

---

## 8. URL Resolution

The private `#resolvePath(relative)` method builds the full request URL by:

1. Starting from `new URL(location.href)` (preserving protocol, host, and query string context).
2. Setting `pathname` to `${this.basePath}/${relative}`.
3. Normalizing any double slashes introduced by a leading `/` on `relative` using a regex replace.

```javascript
// basePath = '/reports', relative = 'list'
// → https://app.voyadores.com/reports/list

// basePath = '/reports', relative = '/list'  (leading slash)
// → https://app.voyadores.com/reports/list   (double slash normalized)
```

The normalization preserves `://` in the protocol:

```javascript
.replace("://", "__PROTO__")
.replace(/([^:]\\/)\\/+/g, '$1')
.replace("__PROTO__", "://")
```

---

## 9. Error Handling Patterns

### Throwing pattern (using `get` / `post`)

Wrap the call in `try/catch` at the call site:

```javascript
try {
    const data = await this.get('list');
    renderTable(data);
} catch (error) {
    notify(error.message, 'error');
}
```

### Tuple pattern (using `safeGet` / `safePost`)

No try/catch needed:

```javascript
const [data, error] = await this.safeGet('list');

if (error) {
    notify(error.message, 'error');
    return;
}

renderTable(data.data);
```

> `safeGet` and `safePost` return the **full response object** at index `[0]`, not just `.data`. Access `response.data` for the unwrapped payload.

---

## 10. Extending ViewModelBase

Subclasses call `super(basePath, httpClient, storage?)` and define their own methods using `this.get`, `this.post`, `this.safeGet`, and `this.safePost`.

```javascript
import ViewModelBase    from '/js/application/application.view-model.js';
import LocalStorage     from '/js/browser-storage/local.storage.js';

export default class ReportsViewModel extends ViewModelBase {
    constructor(httpClient) {
        super('/reports', httpClient, new LocalStorage());
    }

    getList(params = {}) {
        return this.get('list', params);
    }

    getById(id) {
        return this.get(`detail/${id}`);
    }

    save(data) {
        return this.post('save', data);
    }

    safeDelete(id) {
        return this.safePost(`delete/${id}`);
    }
}
```

### Rules

| Rule | Detail |
|---|---|
| `basePath` must be non-empty | Any falsy value throws in the constructor |
| `httpClient` must be an object with `.get` and `.post` | No interface check is enforced at runtime — ensure compatibility |
| `storage` must be a `BrowserStorage` subclass instance | Passing a plain object throws immediately |
| Cache is per path string | Use distinct paths or distinct storage instances to avoid cross-ViewModel collisions |

---

## 11. Full Example

### Defining a ViewModel

```javascript
import ViewModelBase    from '/js/application/application.view-model.js';
import SessionStorage   from '/js/browser-storage/session.storage.js';

export default class InvoiceViewModel extends ViewModelBase {
    constructor(httpClient) {
        // Cache responses in sessionStorage
        super('/accounting/invoices', httpClient, new SessionStorage());
    }

    // Cached GET — returns response.data directly
    getInvoices(filters = {}) {
        return this.get('list', filters);
    }

    // Non-cached GET — safe tuple return
    getInvoiceById(id) {
        return this.safeGet(`detail/${id}`);
    }

    // POST — returns raw response
    saveInvoice(data) {
        return this.post('save', data);
    }

    // POST — safe tuple return
    deleteInvoice(id) {
        return this.safePost(`delete/${id}`);
    }
}
```

### Using the ViewModel

```javascript
import InvoiceViewModel from './invoice.view-model.js';

const vm = new InvoiceViewModel(globalRequest);

// Throwing pattern
try {
    const invoices = await vm.getInvoices({ status: 'pending' });
    renderList(invoices);
} catch (e) {
    notify(e.message, 'error');
}

// Safe pattern
const [response, error] = await vm.getInvoiceById(42);

if (error) {
    notify(error.message, 'error');
} else {
    renderDetail(response.data);
}

// POST
await vm.saveInvoice({ amount: 5000, currency: 'PHP' });

// Safe POST
const [res, err] = await vm.deleteInvoice(42);
if (err) {
    notify(`Delete failed: ${err.message}`, 'error');
}
```

### Using without caching

```javascript
const vm = new InvoiceViewModel(globalRequest);
// Pass no storage argument — all GET requests go directly to the network
```

```javascript
export default class InvoiceViewModel extends ViewModelBase {
    constructor(httpClient) {
        super('/accounting/invoices', httpClient); // no storage
    }
}
```
