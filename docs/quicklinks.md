---
title: "Quicklinks"
version: "1.0.0"
files: "`content/js/application/application.quicklinks.js` · `dist/js/application/application.quicklinks.create.js` · `content/js/application/application.quicklinks.get.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Quick Links module manages a user's list of bookmarked pages accessible from the Start Page. It renders a toggle button (checkbox) in the app toolbar that lets the user add or remove the current page from their Quick Links.

The module detects the current page on load, fetches the user's saved quick links, and reflects the correct state. It enforces a **maximum of 6 quick links** per user and disables the button with a descriptive tooltip when the limit is reached.

---

## 2. Features

| Feature | Description |
|---|---|
| Auto-state detection | Checks whether the current page is already a quick link on load |
| Two load paths | Fetches all quick links on `/` or `/start`; single-page check on all other routes |
| Add / Remove toggle | Single checkbox button saves or removes the current page |
| Max limit enforcement | Disables the button with a tooltip when 6 quick links are saved |
| Tooltip messaging | Button tooltip updates dynamically to reflect the current action |
| Error fallback | API errors fall back to an empty data set (no broken UI) |

---

## 3. Dependencies

| Library / Global | Required | Description |
|---|---|---|
| jQuery | **Yes** | DOM queries, event binding, and `$.callAsync` |
| `globalRequest` | **Yes** | Application-level HTTP client (`get`, `post`) |
| `globalURI` | **Yes** | Application-level URI builder (`buildURI`) |
| `$.callAsync` | **Yes** | jQuery utility for wrapping async functions |

---

## 4. Files

| File | Exports | Description |
|---|---|---|
| `application.quicklinks.js` | — | Main orchestrator. Runs on page load, binds toggle button. |
| `application.quicklinks.create.js` | `saveQuickLink`, `removeQuickLink` | Saves and removes quick links via API. |
| `application.quicklinks.get.js` | `getQuickLinks`, `isPageQuickLink` | Fetches the user's quick link list or checks a single page. |

---

## 5. Setup

### 1. Include the module

```html
<script type="module" src="/js/application/application.quicklinks.js"></script>
```

### 2. Add the toggle button

```html
<div id="dv-set-quicklink" class="ms-3">
    <input id="btn-set-quick-link"
           class="btn-check"
           type="checkbox"
           autocomplete="off"
           data-quick-link-name="Reports"
           data-quick-link-icon="vi-chart-bar"
           data-quick-link-url="/reports" />
    <label class="btn text-primary px-0"
           for="btn-set-quick-link"
           title="Add to Quick Links"
           data-toggle="tooltip">
        <span class="vi-regular vi-bookmark"></span>
        <span class="vi-solid vi-bookmark"></span>
    </label>
</div>
```

No further initialization is needed. The module runs automatically on import.

---

## 6. Required DOM Elements

| Element | Required | Description |
|---|---|---|
| `#btn-set-quick-link` | **Yes** | Checkbox input. Must carry `data-quick-link-name`, `data-quick-link-icon`, and `data-quick-link-url`. |
| `label[for="btn-set-quick-link"]` | **Yes** | Tooltip target. `data-bs-original-title` and `aria-label` are set here. |
| `#dv-set-quicklink` | **Yes** (for disabled state) | Wrapper element. Receives tooltip attributes when the button is disabled (max limit reached). |

### Button data attributes

| Attribute | Description |
|---|---|
| `data-quick-link-name` | Display label of the page (e.g. `"Reports"`). Passed to `saveQuickLink` as `label`. |
| `data-quick-link-icon` | Icon class name (e.g. `"vi-chart-bar"`). Passed to `saveQuickLink` as `icon`. |
| `data-quick-link-url` | Pathname of the page (e.g. `"/reports"`). Passed to `saveQuickLink` as `linkUrl` and `removeQuickLink` as `pageUrl`. |

---

## 7. Page Load Behavior

The module inspects `window.location.pathname` immediately on load and takes one of two paths:

### On `/` or `/start` (Start Page)

Calls `getQuickLinks()` to fetch **all** of the user's saved quick links. Passes the full list to `setupQuickLinkPage`.

```
GET /start/get-user-quicklinks
→ response.data = [{ PageUrl: '/reports' }, { PageUrl: '/payroll' }, ...]
```

### On any other page

Calls `isPageQuickLink(urlPath)` to check whether only the **current page** is saved. Normalizes the response into a single-item or empty array before passing to `setupQuickLinkPage`.

```
GET /start/is-page-quicklink?pageUrl=/reports
→ response.data = true | false
→ normalized: [{ PageUrl: '/reports' }] | []
```

### Error fallback

If either API call fails, `setupQuickLinkPage` is called with `{ data: [] }` so the button renders in its default "not bookmarked" state without breaking.

---

## 8. Button States

`setPageQuickLinkState(data)` is called after the API response with the quick link list.

| Condition | Button state | Tooltip |
|---|---|---|
| `data` is empty | Unchecked, enabled | (unchanged from default) |
| Current page is in the list | Checked, enabled | (unchanged from default) |
| 6 quick links exist and page is not bookmarked | Unchecked, **disabled** | `"Maximum number of Quick Links reached. To add {label} as a Quick Link, remove a link in the Start Page"` |

> The maximum limit is **6** quick links. When `data.length === 6` and the current page is not already bookmarked, the button is disabled.

---

## 9. Toggle Behavior

When the user clicks `#btn-set-quick-link`, the `click` event handler fires:

> **Note:** The handler reads the checked state *after* the native checkbox toggle, then inverts it to determine the *previous* state. `isQuickLink = !btn.is(':checked')` means: if the box is now checked, it was previously unchecked (user is adding).

| Previous state | Action | API call | Tooltip after |
|---|---|---|---|
| Unchecked → now checked | Add to Quick Links | `saveQuickLink({ label, icon, linkUrl })` | `"Remove from Quick Links"` |
| Checked → now unchecked | Remove from Quick Links | `removeQuickLink(linkUrl, label)` | `"Add to Quick Links"` |

Both calls use `$.callAsync` and `await`. The button is not re-disabled or updated after the call — state is set only on page load.

---

## 10. API Functions

### `getQuickLinks()`

Fetches all quick links saved by the current user.

```javascript
import { getQuickLinks } from './application.quicklinks.get.js';

const response = await $.callAsync(getQuickLinks);
// response.data = [{ PageUrl: '/reports' }, ...]
```


---

### `isPageQuickLink(pageUrl)`

Checks whether a specific page URL is saved as a quick link for the current user.

```javascript
import { isPageQuickLink } from './application.quicklinks.get.js';

const response = await $.callAsync(isPageQuickLink, '/reports');
// response.data = true | false
```

| Parameter | Type | Description |
|---|---|---|
| `pageUrl` | `string` | The pathname to check, e.g. `"/reports"`. |


---

### `saveQuickLink(params)`

Saves a page as a quick link for the current user.

```javascript
import { saveQuickLink } from './application.quicklinks.create.js';

await $.callAsync(saveQuickLink, {
    label:   'Reports',
    icon:    'vi-chart-bar',
    linkUrl: '/reports'
});
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `params.label` | `string` | **Yes** | Display name of the page. |
| `params.icon` | `string` | **Yes** | Icon class name. |
| `params.linkUrl` | `string` | **Yes** | Pathname of the page. |



---

### `removeQuickLink(pageUrl, pageLabel)`

Removes a page from the current user's quick links.

```javascript
import { removeQuickLink } from './application.quicklinks.create.js';

await $.callAsync(removeQuickLink, '/reports', 'Reports');
```

| Parameter | Type | Description |
|---|---|---|
| `pageUrl` | `string` | Pathname of the page to remove. |
| `pageLabel` | `string` | Display name of the page. |



---

## 11. Validation

`saveQuickLink` validates the merged parameters before posting. If any field is empty, it returns a rejected Promise with an HTML-formatted error string.

| Field | Rule | Error message |
|---|---|---|
| `label` | Must not be empty | `- Page label not found.` |
| `icon` | Must not be empty | `- Icon not found.` |
| `linkUrl` | Must not be empty | `- Page url not found.` |

Errors are joined with `<br />` and wrapped in an `Error` object.

---

## 12. API Endpoints

| Method | URL | Description |
|---|---|---|
| `GET` | `/start/get-user-quicklinks` | Returns all quick links for the current user |
| `GET` | `/start/is-page-quicklink?pageUrl={path}` | Returns `true`/`false` for a specific page |
| `POST` | `/start/save-quicklink` | Saves a new quick link. Body: `{ PageLabel, PageUrl, PageIcon }` |
| `POST` | `/start/remove-quicklink` | Removes a quick link. Body: `{ pageUrl, pageLabel }` |

GET URLs are built via `globalURI.buildURI(action, 'start', params?)`. POST URLs use `window.location.origin + '/start/' + action`.

---

## 13. Global Dependencies

| Global | Used in | Description |
|---|---|---|
| `globalRequest.get(url)` | `getQuickLinks`, `isPageQuickLink` | Performs a GET request and returns a Promise |
| `globalRequest.post(url, body)` | `saveQuickLink`, `removeQuickLink` | Performs a POST request and returns a Promise |
| `globalURI.buildURI(action, scope, params?)` | `getQuickLinks`, `isPageQuickLink` | Constructs a scoped API URL with optional query params |
| `$.callAsync(fn, ...args)` | `application.quicklinks.js` | jQuery wrapper that calls an async function and returns a Promise |

---

## 14. Console Messages

| Level | Message |
|---|---|
| `warn` | `No response data, skipping setup.` — `setupQuickLinkPage` received a null or missing `data` property |
| `error` | `Error fetching quick links:` — `getQuickLinks` call failed (Start Page path) |
| `error` | `Error checking quick link:` — `isPageQuickLink` call failed (non-Start Page path) |

---

## 15. Full Example

### Minimal page setup

```html
<!-- Toolbar -->
<div class="d-flex align-items-center">

    <div id="dv-set-quicklink" class="ms-3">
        <input id="btn-set-quick-link"
               class="btn-check"
               type="checkbox"
               autocomplete="off"
               data-quick-link-name="Reports"
               data-quick-link-icon="vi-chart-bar"
               data-quick-link-url="/reports" />
        <label class="btn text-primary px-0"
               for="btn-set-quick-link"
               title="Add to Quick Links"
               data-toggle="tooltip">
            <span class="vi-regular vi-bookmark"></span>
            <span class="vi-solid vi-bookmark"></span>
        </label>
    </div>

</div>

<!-- Scripts -->
<script src="/js/jquery/jquery.min.js"></script>
<script type="module" src="/js/application/application.quicklinks.js"></script>
```

### Using the API functions directly

```javascript
import { getQuickLinks, isPageQuickLink } from '/js/application/application.quicklinks.get.js';
import { saveQuickLink, removeQuickLink }  from '/js/application/application.quicklinks.create.js';

// Fetch all quick links
const all = await $.callAsync(getQuickLinks);
console.log(all.data);  // → [{ PageUrl: '/reports' }, ...]

// Check if current page is a quick link
const check = await $.callAsync(isPageQuickLink, '/reports');
console.log(check.data);  // → true

// Save a quick link
await $.callAsync(saveQuickLink, {
    label:   'Reports',
    icon:    'vi-chart-bar',
    linkUrl: '/reports'
});

// Remove a quick link
await $.callAsync(removeQuickLink, '/reports', 'Reports');
```
