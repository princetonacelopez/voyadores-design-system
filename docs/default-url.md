---
title: "Default Url"
version: "1.0.0"
files: "`application.default-url.js` · `application.default-url.get.js` · `application.default-url.create.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Default URL module lets users set or remove a **Default Page** — a saved URL the application redirects to on login or on direct navigation. It renders a toggle button (checkbox styled as an icon button) in the app toolbar, reflects the current default state on load, and provides an override confirmation flow when a different page is already set as default.

The module is split across three ES module files:

| File | Role |
|---|---|
| `application.default-url.js` | Main orchestrator — UI rendering, state management, event handling |
| `application.default-url.get.js` | Fetches the current default URL from the API |
| `application.default-url.create.js` | Saves or removes the default URL via the API |

---

## 2. Features

| Feature | Description |
|---|---|
| Auto-rendered toggle button | Injects the checkbox + label HTML into the toolbar on page load |
| Three-state awareness | Detects whether no default is set, the current page is default, or another page is default |
| Override confirmation | Shows a Bootstrap Popover asking the user to confirm before replacing an existing default |
| Outside-click dismissal | Popover auto-closes and cancels if the user clicks outside it |
| Tooltip labeling | Button tooltip updates dynamically to reflect the current action |
| State refresh after change | Re-fetches the API after every save/remove to keep UI in sync |
| Input validation | `saveDirectUrl` validates required fields before posting |

---

## 3. Dependencies

| Library / Global | Required | Description |
|---|---|---|
| jQuery | **Yes** | DOM manipulation and `$.callAsync` |
| Bootstrap 5 | **Yes** | `bootstrap.Popover` for the override confirmation |
| `globalRequest` | **Yes** | Application-level HTTP client (`get`, `post`) |
| `globalURI` | **Yes** | Application-level URI builder (`buildURI`) |
| `$.callAsync` | **Yes** | jQuery utility for wrapping async functions |

---

## 4. Files

### `application.default-url.get.js`

Exports a single function that fetches the current default URL for the logged-in user.

```javascript
export const getDirectUrl = () =>
    globalRequest.get(globalURI.buildURI('get-direct-url', 'user'));
```

Returns a Promise resolving to an object with a `data.RedirectUrl` property.

---

### `application.default-url.create.js`

Exports two functions for saving and removing the default URL.

```javascript
export const saveDirectUrl = (params) => { ... }
export const removeDirectUrl = () => { ... }
```

See [API Functions](#10-api-functions) for full details.

---

### `application.default-url.js`

The main async IIFE module. Imports from the two files above, fetches the current default on load, renders the toggle button HTML, and wires up all events.

---

## 5. Setup

### 1. Include the module

```html
<script type="module" src="/js/application/application.default-url.js"></script>
```

### 2. Add the quick link source element

The module reads the page name and icon from a hidden input with `id="btn-set-quick-link"`. Add it once per page:

```html
<input type="hidden"
       id="btn-set-quick-link"
       data-quick-link-name="Reports"
       data-quick-link-icon="vi-chart-bar" />
```

### 3. Add the quick link container anchor

The toggle button HTML is inserted **before** a container with `id="dv-set-quicklink"`:

```html
<div id="dv-set-quicklink">
    <!-- other toolbar items -->
</div>
```

No further initialization is required. The module runs automatically on load.

---

## 6. Required DOM Elements

| Element | Required | Description |
|---|---|---|
| `#btn-set-quick-link` | **Yes** | Hidden input that provides `data-quick-link-name` and `data-quick-link-icon` for the generated button. If missing, the toggle button is not rendered. |
| `#dv-set-quicklink` | **Yes** | Anchor element. The toggle button `<div>` is inserted immediately before it. If missing, the toggle button is not rendered. |
| `#btn-set-default-url` | Auto-generated | The checkbox input created by `setDefaultUrlHtml()`. |
| `label[for="btn-set-default-url"]` | Auto-generated | The label/button created by `setDefaultUrlHtml()`. Used as the popover anchor and tooltip target. |
| `#dv-set-default-url` | Auto-generated | Wrapper `<div>` created by `setDefaultUrlHtml()`. |

### Generated HTML

`setDefaultUrlHtml()` inserts the following structure before `#dv-set-quicklink`:

```html
<div id="dv-set-default-url" class="ms-3">
    <input id="btn-set-default-url"
           class="btn-check"
           type="checkbox"
           autocomplete="off"
           data-default-url-name="{quickLinkName}"
           data-default-url-icon="{quickLinkIcon}" />
    <label class="btn text-primary px-0"
           for="btn-set-default-url"
           title="Set as Default Page"
           data-toggle="tooltip">
        <span class="vi-regular vi-home-dash"></span>
        <span class="vi-solid vi-home-dash"></span>
    </label>
</div>
```

---

## 7. Button States

On page load the module fetches the current default URL and sets the button state accordingly.

| Condition | Checkbox | Tooltip label |
|---|---|---|
| No default URL is set | Unchecked | `Set as Default Page` |
| Current page is the default | Checked | `Remove as Default Page` |
| Another page is the default | Unchecked | `Set as Default Page` |

The button is always enabled (`disabled: false`) across all three states.

---

## 8. Toggle Behavior

When the user clicks the toggle button (`#btn-set-default-url`), the `change` event fires:

### Checking (setting as default)

| Scenario | Action |
|---|---|
| No existing default | Calls `saveDirectUrl`, refreshes state, updates tooltip to `Remove as Default Page` |
| Current page is already default | Calls `saveDirectUrl` directly (re-saves) |
| Another page is already default | Prevents the checkbox from checking, shows the **Override Confirmation Popover** |

### Unchecking (removing default)

Calls `removeDirectUrl`, refreshes state, updates tooltip to `Set as Default URL`.

After every save or remove, the module re-calls `getDirectUrl` to refresh the `hasDefaultUrl` and `isCurrentPageDefault` state variables.

---

## 9. Override Confirmation Popover

When the user tries to replace an existing default with the current page, a Bootstrap Popover appears on the label element with a confirmation prompt.


> *"{CurrentDefaultPage}" is your current default page. Set "{NewPage}" as the new default?*
>
> `[Cancel]` `[Set as Default]`

### Interaction outcomes

| Action | Result |
|---|---|
| Click **Set as Default** | Disposes popover, calls `saveDirectUrl`, refreshes state |
| Click **Cancel** | Disposes popover, checkbox remains unchecked |
| Click outside popover | Same as Cancel |

### Popover configuration

| Option | Value |
|---|---|
| `placement` | `'bottom'` |
| `trigger` | `'manual'` |
| `container` | `'body'` |
| `html` | `true` |
| `sanitize` | `false` |

The outside-click listener uses the namespace `click.popover-outside` and is removed after any outcome.

---

## 10. API Functions

### `getDirectUrl()`

Fetches the current default URL for the logged-in user.

```javascript
import { getDirectUrl } from './application.default-url.get.js';

const result = await $.callAsync(getDirectUrl);
// result.data.RedirectUrl → "/reports/summary" or ""
```


---

### `saveDirectUrl(params)`

Saves the current page as the user's default URL.

```javascript
import { saveDirectUrl } from './application.default-url.create.js';

await $.callAsync(saveDirectUrl, { linkUrl: '/reports/summary' });
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `params.linkUrl` | `string` | **Yes** | The pathname to save as the default URL. |




---

### `removeDirectUrl()`

Removes the user's current default URL.

```javascript
import { removeDirectUrl } from './application.default-url.create.js';

await $.callAsync(removeDirectUrl);
```

No parameters. Fires a POST with no body.


---

## 11. Validation

`saveDirectUrl` validates the merged parameters before posting. If any field fails, the function returns a rejected Promise with an HTML-formatted error string.

| Field | Rule | Error message |
|---|---|---|
| `label` | Must not be empty | `- Page label not found.` |
| `icon` | Must not be empty | `- Icon not found.` |
| `linkUrl` | Must not be empty | `- Page url not found.` |

Errors are joined with `<br />` and returned as a single HTML string.

> **Note:** `label` and `icon` are not passed directly from `application.default-url.js` — they are read from `data-default-url-name` and `data-default-url-icon` on `#btn-set-default-url`. If those attributes are missing, validation will fail.

---

## 12. Internal Helpers

These functions are private to `application.default-url.js` and are not exported.

### `setDefaultUrlHtml()`

Reads `#btn-set-quick-link` data attributes and injects the toggle button HTML before `#dv-set-quicklink`. Returns early (silently) if either element is not found.

---

### `tooltipMessage(message, state?)`

Updates the tooltip text on `label[for="btn-set-default-url"]` and `#dv-set-default-url`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | — | Tooltip text to display |
| `state` | `string` | `''` | Pass `'disabled'` to apply `.disabled.text-muted` to the label and attach the tooltip to `#dv-set-default-url` instead |

Sets both `data-bs-original-title` and `aria-label`. Removes the native `title` attribute to prevent double-tooltips.

---

### `formatPageNameFromUrl(url)`

Converts a URL pathname into a human-readable page name.

```javascript
formatPageNameFromUrl('/accounting/general-ledger');
// → "General Ledger"

formatPageNameFromUrl('/reports');
// → "Reports"

formatPageNameFromUrl('');
// → "Unknown Page"
```

Logic:
1. Strips the leading `/` and splits by `/`.
2. Takes the last non-empty segment.
3. Replaces `-` and `_` with spaces.
4. Converts to Title Case.

---

### `showOverridePopover(element, currentDefaultPage, newDefaultPage, onConfirm, onCancel)`

Creates and shows a Bootstrap Popover with an override confirmation UI. Attaches delegated click handlers for Confirm, Cancel, and outside-click dismissal. All handlers clean themselves up after firing.

| Parameter | Type | Description |
|---|---|---|
| `element` | jQuery object | The element to anchor the popover to (the label) |
| `currentDefaultPage` | `string` | Formatted name of the existing default page |
| `newDefaultPage` | `string` | Formatted name of the page being set as default |
| `onConfirm` | `function` | Async callback executed when the user confirms |
| `onCancel` | `function` | Callback executed when the user cancels or clicks outside |

---

## 13. API Endpoints

| Method | URL | Description |
|---|---|---|
| `GET` | `/user/get-direct-url` | Returns the current default URL (`{ data: { RedirectUrl } }`) |
| `POST` | `/user/save-direct-url` | Saves a new default URL. Body: `{ directUrl: string }` |
| `POST` | `/user/remove-default-url` | Removes the current default URL. No body. |

URLs are constructed using `globalURI.buildURI` (get) and `window.location.origin + '/user/' + action` (post).

---

## 14. Global Dependencies

| Global | Used in | Description |
|---|---|---|
| `globalRequest.get(url)` | `getDirectUrl` | Performs a GET request and returns a Promise |
| `globalRequest.post(url, body?)` | `saveDirectUrl`, `removeDirectUrl` | Performs a POST request and returns a Promise |
| `globalURI.buildURI(action, scope)` | `getDirectUrl` | Constructs a scoped API URL |
| `$.callAsync(fn, ...args)` | `application.default-url.js` | jQuery wrapper that calls an async function and returns a Promise |
| `bootstrap.Popover` | `showOverridePopover` | Bootstrap 5 Popover class |

---

## 15. Full Example

### Minimal page setup

```html
<!-- Hidden input with page metadata -->
<input type="hidden"
       id="btn-set-quick-link"
       data-quick-link-name="Reports"
       data-quick-link-icon="vi-chart-bar" />

<!-- Toolbar: the module inserts the button before this element -->
<div class="d-flex align-items-center">
    <!-- ... other toolbar items ... -->
    <div id="dv-set-quicklink">
        <!-- quick link button lives here -->
    </div>
</div>

<!-- Scripts -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/bootstrap/bootstrap.bundle.min.js"></script>
<script type="module" src="/js/application/application.default-url.js"></script>
```

After the script loads, the toolbar will contain:

```html
<div id="dv-set-default-url" class="ms-3">
    <input id="btn-set-default-url" class="btn-check" type="checkbox"
           data-default-url-name="Reports" data-default-url-icon="vi-chart-bar" />
    <label class="btn text-primary px-0" for="btn-set-default-url"
           data-bs-original-title="Set as Default Page" aria-label="Set as Default Page">
        <span class="vi-regular vi-home-dash"></span>
        <span class="vi-solid vi-home-dash"></span>
    </label>
</div>
```

### Using the API functions directly

```javascript
import { getDirectUrl }              from '/js/application/application.default-url.get.js';
import { saveDirectUrl, removeDirectUrl } from '/js/application/application.default-url.create.js';

// Get current default
const result = await $.callAsync(getDirectUrl);
console.log(result.data.RedirectUrl);   // → "/reports/summary"

// Save current page as default
await $.callAsync(saveDirectUrl, { linkUrl: window.location.pathname });

// Remove default
await $.callAsync(removeDirectUrl);
```
