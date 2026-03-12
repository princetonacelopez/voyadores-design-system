---
title: "Request And Uri"
version: "1.0.0"
files: "`content/js/application/application.request.js` · `content/js/application/application.uri.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

Two global utility objects, initialized automatically on page load:

| Global | Constructor | Purpose |
|---|---|---|
| `globalRequest` | `Request()` | Axios-based HTTP client with CSRF injection and automatic 401 token refresh |
| `globalURI` | `URI('/')` | URL builder that composes base path, controller, action path, and query string |

`globalRequest` also registers a jQuery `ajaxError` handler that applies the same 401 refresh logic to all `$.ajax` / `$.getJSON` calls on the page.

---

## 2. Dependencies

| Library | Required | Description |
|---|---|---|
| Axios | **Yes** | Used by `globalRequest` for all HTTP operations |
| jQuery | **Yes** | Used for the `ajaxError` 401 handler and DOM ready wrapper |

Both must be loaded before `application.request.js`.

---

## 3. Setup

```html
<!-- Before closing </body> -->
<script src="/js/axios/axios.min.js"></script>
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/application/application.request.js"></script>
<script src="/js/application/application.uri.js"></script>
```

No initialization is required. Both globals are created immediately when the scripts are parsed.

### Required DOM element

`application.request.js` reads the CSRF token from the first input element with `name="__RequestVerificationToken"` on every request. This element must be present in the DOM before any request is made:

```html
<input name="__RequestVerificationToken" type="hidden" value="..." />
```

---

## 4. Global Singletons

| Variable | Initial value | Description |
|---|---|---|
| `globalRequest` | `new Request()` | HTTP client — use for all `get` and `post` calls |
| `globalURI` | `new URI('/')` | URI builder — `baseURI` can be reassigned per-page |
| `globalAccountId` | `""` | Global account ID string — set externally as needed |

> `globalRequest` is noted in source as a TODO regarding global variable usage. Prefer passing it as a dependency to classes rather than accessing it as a global wherever possible.

---

## 5. Request — Methods

### `globalRequest.get(path, parameters?)`

Performs a GET request via Axios.

```javascript
const response = await globalRequest.get('/reports/list', { page: 1, status: 'active' });
console.log(response.data);
```

| Parameter | Type | Description |
|---|---|---|
| `path` | `string` | Full URL or path. |
| `parameters` | `object` | Serialized as Axios `params` (query string). |


---

### `globalRequest.post(path, parameters?)`

Performs a POST request via Axios.

```javascript
const response = await globalRequest.post('/reports/save', { name: 'Q1 Summary' });
```

| Parameter | Type | Description |
|---|---|---|
| `path` | `string` | Full URL or path. |
| `parameters` | `object` | Sent as the request body (JSON). |


---

## 6. Request — CSRF Token Injection

Every Axios request made through `globalRequest` automatically includes the ASP.NET CSRF token:

```javascript
headers['__RequestVerificationToken'] =
    document.getElementsByName('__RequestVerificationToken')[0].value;
```

This is injected via Axios `transformRequest`, which runs before the request is sent. The token is appended to whatever headers Axios would normally send.

> If the CSRF input element is missing from the DOM at request time, this line will throw a runtime error.

---

## 7. Request — Axios 401 Refresh Flow

When any Axios request through `globalRequest` receives a **401 Unauthorized** response, the interceptor automatically attempts a token refresh before retrying.

### Flow

```
Axios response → 401
        │
        ├── refresh already in progress?
        │       └── YES → queue request in pendingRequests[], wait
        │
        └── NO → mark isTokenRefreshInitiated = true
                    │
                    ▼
            GET /session/get-refresh-token-cookie
                    │
             Extract { token, api }
                    │
            POST {api}/v1/auth/refresh
              headers: { X-Refresh-Token: token }
                    │
             Verify StatusCode === 200
                    │
             Extract { RefreshToken, AccessToken }
                    │
            POST /session/set-session-cookies
              body: { refreshToken, accessToken }
                    │
              Flush pendingRequests[]
                    │
              Retry original request
```

### Failure conditions

If any step fails (missing response, missing `token`/`api`, non-200 status code, or any thrown exception), `isTokenRefreshInitiated` is reset to `false` and the original error is re-rejected via `Promise.reject(error)`. Queued requests are **not** flushed on failure.

### Endpoints used during refresh

| Step | Method | URL | Description |
|---|---|---|---|
| 1 | `GET` | `/session/get-refresh-token-cookie` | Returns `{ token, api }` |
| 2 | `POST` | `{api}/v1/auth/refresh` | Exchanges refresh token for new tokens. Header: `X-Refresh-Token: {token}` |
| 3 | `POST` | `/session/set-session-cookies` | Stores new tokens in session. Body: `{ refreshToken, accessToken }` |

The refresh calls use a **separate** `axios.create()` instance to avoid circular interception.

---

## 8. Request — jQuery AJAX 401 Refresh Flow

A global `$(document).ajaxError` handler applies the same refresh logic to all jQuery AJAX calls (`$.ajax`, `$.getJSON`, `$.post`, etc.) that receive a **401** response.

The flow is identical to the Axios flow ([section 7](#7-request--axios-401-refresh-flow)), with these differences:

| Aspect | Axios flow | jQuery flow |
|---|---|---|
| Queuing mechanism | `Promise` resolve callbacks | `[options, Deferred]` pairs |
| Retry mechanism | `globalAxios(error.config)` | `$.ajax(originalOptions)` |
| Pending clear | On first successful retry | After `retryQueuedRequests()` completes |
| Guard state | Shared via closure | Separate `isTokenRefreshInitiated` in `$(function(){})` |

### jQuery retry

```javascript
function retryQueuedRequests() {
    while (pendingRequests.length > 0) {
        const [originalOptions, originalDeferred] = pendingRequests.shift();
        $.ajax(originalOptions)
            .done(originalDeferred.resolve)
            .fail(originalDeferred.reject);
    }
}
```

Each queued request is replayed using its original jQuery AJAX options object. The original callers receive the result through the resolved or rejected Deferred.

> The `isTokenRefreshInitiated` flags for Axios and jQuery are **independent**. A concurrent Axios 401 and jQuery 401 could each trigger a separate refresh. Consider serializing if this causes issues.

---

## 9. URI — Methods

### `globalURI.buildURI(path, controller?, params?)`

Builds a URL in the format `{baseURI}{controller}/{path}{?queryString}`.

```javascript
globalURI.baseURI = '/reports';

globalURI.buildURI('list');
// → "/reports//list"

globalURI.buildURI('list', 'summary');
// → "/reports/summary/list"

globalURI.buildURI('list', 'summary', { page: 1, status: 'active' });
// → "/reports/summary/list?page=1&status=active"
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | The action name or relative path segment. |
| `controller` | `string` | `undefined` | Optional controller segment. Becomes `{controller}/` in the URL. |
| `params` | `object` | `undefined` | Optional query parameters serialized as `?key=value&...`. |

> When `controller` is omitted, `defaultController` falls back to `'/'`, producing a double slash between `baseURI` and `path`. Ensure `baseURI` or the caller handles this if it matters.

---

### `globalURI.buildUrl(path, params?)`

Builds a simpler URL in the format `{baseURI}{path}/{?queryString}` — no controller segment.

```javascript
globalURI.baseURI = '/start';

globalURI.buildUrl('get-quicklinks');
// → "/start/get-quicklinks/"

globalURI.buildUrl('filter', { status: 'pending', page: 2 });
// → "/start/filter/?status=pending&page=2"
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | Action path appended directly after `baseURI`. |
| `params` | `object` | `undefined` | Optional query parameters. |

> Note: `buildUrl` always appends a trailing `/` before the query string (e.g. `"/start/filter/"`).

---

## 10. URI — URL Construction

### `baseURI`

`baseURI` is a mutable instance property. It defaults to `'/'` for `globalURI` and is commonly overridden per-page or per-ViewModel before building URLs:

```javascript
globalURI.baseURI = '/accounting';
const url = globalURI.buildURI('invoices', 'list');
// → "/accounting/list/invoices"
```

If `baseURI` is `undefined` or empty, both methods reset it to `'/'`.

### Query string format

```javascript
// params = { page: 1, status: 'active' }
// → "?page=1&status=active"
```

Values are inserted as-is (`key=${params[key]}`). There is no `encodeURIComponent` applied — avoid special characters in parameter values, or encode them before passing.

### `buildURI` vs `buildUrl` comparison

| | `buildURI(path, controller, params)` | `buildUrl(path, params)` |
|---|---|---|
| Pattern | `{base}{controller}/{path}{qs}` | `{base}{path}/{qs}` |
| Controller segment | Yes (optional) | No |
| Trailing slash on path | No | Yes |
| Typical use | Feature-specific actions with a controller scope | Simple path + optional query |

---

## 11. Full Example

### Making requests with `globalRequest`

```javascript
// GET with query params
const response = await globalRequest.get(
    globalURI.buildURI('list', 'invoices', { page: 1 })
);
console.log(response.data);

// POST
await globalRequest.post(
    globalURI.buildURI('save', 'invoices'),
    { amount: 5000, currency: 'PHP' }
);
```

### Building URLs with `globalURI`

```javascript
// Scoped to a module
globalURI.baseURI = '/accounting';

globalURI.buildURI('list', 'invoices');
// → "/accounting/invoices/list"

globalURI.buildURI('list', 'invoices', { status: 'paid', page: 2 });
// → "/accounting/invoices/list?status=paid&page=2"

globalURI.buildUrl('export', { format: 'csv' });
// → "/accounting/export/?format=csv"
```

### Using with ViewModelBase

```javascript
import ViewModelBase from '/js/application/application.view-model.js';

class InvoiceViewModel extends ViewModelBase {
    constructor() {
        super('/accounting/invoices', globalRequest);
    }

    getList(params = {}) {
        return this.get('list', params);
    }
}
```

### Resetting `globalURI.baseURI` between calls

`globalURI` is a shared singleton. If multiple modules set `baseURI`, the last write wins:

```javascript
// Module A
globalURI.baseURI = '/reports';
const reportsUrl = globalURI.buildURI('list');

// Module B — overwrites Module A's baseURI
globalURI.baseURI = '/payroll';
const payrollUrl = globalURI.buildURI('list');
```

For safer isolation, create a local `URI` instance:

```javascript
const myURI = new URI('/reports');
const url    = myURI.buildURI('list', 'summary');
```
