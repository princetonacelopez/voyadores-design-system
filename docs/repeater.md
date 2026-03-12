---
title: "Repeater"
version: "1.6.1"
files: "`repeater-1-6-1.min.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2024-10-01"
---

## 1. Overview

The jQuery Custom Repeater is a jQuery plugin that renders dynamic HTML from a data source — either a static array or a remote API endpoint. It handles all state screens automatically: loading, empty, 403, 404, and 500. The output HTML is fully controlled by a `mappingFunction` you provide, making it usable for cards, lists, tables, or any repeating UI pattern.

---

## 2. Features

- **Two data modes:** static array or AJAX endpoint (GET or POST)
- **Automatic state management:** loading, empty, 403, 404, 500
- **Fully custom output:** you define the HTML via `mappingFunction`
- **Programmatic refresh:** call `refresh` with new params to reload
- **Data-only refresh:** call `refreshData` to re-render without a network request
- **Clear method:** wipe the container without re-initializing
- **Configurable empty state:** custom message, image, or full HTML override
- **CDN-aware image paths:** reads base URL from a hidden `#voyadores-cdn-url` input

---

## 3. Dependencies

| Dependency | Version | Notes |
|---|---|---|
| jQuery | 3.x recommended | Required. Must be loaded before the plugin. |

---

## 4. Setup

### Via CDN

```html
<!-- jQuery -->
<script src="https://cdn.voyadores.com/content/js/jquery/jquery-3.6.0.min.js"></script>

<!-- Repeater plugin -->
<script src="https://cdn.voyadores.com/content/js/repeater/repeater-1-6-1.min.js"></script>
```

### CDN Base URL Helper (required for state images)

Add this hidden input anywhere in your page so the plugin can resolve absolute image paths:

```html
<input type="hidden" id="voyadores-cdn-url" value="https://cdn.voyadores.com" />
```

If omitted, state images will use relative paths (empty string prefix), which may result in broken images.

---

## 5. Required HTML Structure

The repeater targets any container element identified by an `id`. The plugin empties and repopulates this container on every render.

```html
<div id="my-list"></div>
```

Initialize on that element:

```js
$('#my-list').repeater({ ... });
```

---

## 6. Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `""` | API URL. Leave empty to use static `data`. |
| `type` | `string` | `"GET"` | HTTP method. `"GET"` or `"POST"`. |
| `async` | `boolean` | `false` | Whether the AJAX call is asynchronous. |
| `params` | `object` | `{}` | Query params (GET) or body (POST) sent with the request. |
| `data` | `array` | `[]` | Static data array. Used when `endpoint` is empty. |
| `mappingFunction` | `function(data)` | returns `""` | Receives the data and returns an HTML string. |
| `success` | `function(data)` | no-op | Called after a successful render. Receives the raw data. |
| `fail` | `function(message)` | no-op | Called when an unsupported HTTP method is used. |
| `messageNoResultHeader` | `string` | `"No data found"` | Heading shown in the default empty state. |
| `messageNoResult` | `string` | `"There's nothing to display here at the moment."` | Body text shown in the default empty state. |
| `cssClassNoResult` | `string` | `""` | Extra CSS class applied to all state screen wrappers. |
| `imageEmpty` | `string` | `/content/images/states/empty/voyadores.default.empty.svg` | Path (relative to CDN base) for the empty state image. |
| `customEmpty` | `string\|null` | `null` | Full HTML string to override the default empty state. |

> **Note:** `sortKey` and `sortType` are reserved fields in the options object but are not yet implemented by the plugin logic.

---

## 7. Data Modes

### Static Mode

Set `endpoint` to `""` (or omit it) and pass data directly:

```js
$('#my-list').repeater({
  data: [
    { id: 1, name: 'Item A' },
    { id: 2, name: 'Item B' },
  ],
  mappingFunction: function(data) {
    return data.map(item => `<div class="item">${item.name}</div>`).join('');
  }
});
```

### AJAX Mode — GET

```js
$('#my-list').repeater({
  endpoint: '/api/items',
  type: 'GET',
  params: { category: 'tools', page: 1 },
  mappingFunction: function(data) {
    return data.map(item => `<div class="item">${item.name}</div>`).join('');
  }
});
```

The params are appended as a query string: `/api/items?category=tools&page=1`

### AJAX Mode — POST

```js
$('#my-list').repeater({
  endpoint: '/api/items/search',
  type: 'POST',
  params: { query: 'button', limit: 20 },
  mappingFunction: function(data) {
    return data.map(item => `<li>${item.label}</li>`).join('');
  }
});
```

> Only `GET` and `POST` are supported. Any other `type` value will trigger the `fail` callback with an "Unsupported call type" message and abort.

---

## 8. Mapping Function

The `mappingFunction` is the core of the plugin. It receives the response data and must return an HTML string. If it returns an empty string or throws an error, the empty state is shown instead.

```js
mappingFunction: function(data) {
  if (!data || !data.length) return '';
  return data.map(function(item) {
    return `
      <div class="card mb-2">
        <div class="card-body">
          <h5 class="card-title">${item.title}</h5>
          <p class="card-text">${item.description}</p>
        </div>
      </div>
    `;
  }).join('');
}
```

**Return empty string to trigger the empty state** — no need to render a fallback yourself.

---

## 9. Commands Reference

After initialization, call methods by passing a command string as the first argument.

### `refresh`

Reloads data from the endpoint (or re-renders static data). Optionally update `params`.

```js
// Refresh with existing params
$('#my-list').repeater('refresh');

// Refresh with new params
$('#my-list').repeater('refresh', { page: 2, category: 'icons' });
```

### `refreshData`

Re-renders the current output using new static `data` — no network request.

```js
$('#my-list').repeater('refreshData', [
  { id: 3, name: 'Item C' },
  { id: 4, name: 'Item D' },
]);
```

### `clear`

Empties the container. Does not reset options or state.

```js
$('#my-list').repeater('clear');
```

---

## 10. State Screens

The plugin automatically displays a full-container state screen while loading or when an HTTP error occurs. All images are resolved against the CDN base URL from `#voyadores-cdn-url`.

| State | Trigger | Image |
|---|---|---|
| **Loading** | Before any request starts | `/content/images/states/loader/voyadores-loader.gif` (32px) |
| **403 Forbidden** | Server returns 403 | `/content/images/states/error/voyadores-403.svg` (160px) |
| **404 Not Found** | Server returns 404 | `/content/images/states/error/voyadores-404.svg` (160px) |
| **500 Server Error** | Server returns 500 | `/content/images/states/error/voyadores-500.svg` (160px) |
| **Empty** | `mappingFunction` returns `""` or throws | Configurable via `imageEmpty` |

State screens are styled with:

```css
text-center status-text rounded p-6 {cssClassNoResult}
background-color: rgba(106, 106, 106, 0.06)
```

---

## 11. Empty State Customization

### Option A — Change the text and image

```js
$('#my-list').repeater({
  imageEmpty: '/content/images/states/empty/general.notifications.empty.svg',
  messageNoResultHeader: 'No notifications',
  messageNoResult: 'You have no new notifications at this time.',
  cssClassNoResult: 'my-empty-class',
  mappingFunction: function(data) { return ''; }
});
```


| Image filename | Rendered width |
|---|---|
| `general.notifications.empty.svg` | 160px |
| `voyadores.default.empty.svg` | 80px |
| Any other path | 160px |

### Option B — Provide fully custom HTML

```js
$('#my-list').repeater({
  customEmpty: `
    <div class="text-center py-5">
      <p class="text-muted">Nothing here yet. Try a different filter.</p>
    </div>
  `,
  mappingFunction: function(data) { return ''; }
});
```

When `customEmpty` is set, it overrides the default empty state entirely (including the image and messages).

---

## 12. Callbacks

### `success(data)`

Called after a successful render — whether from static data or a 200 response.

```js
success: function(data) {
  console.log('Rendered', data.length, 'items');
  updatePaginationControls(data);
}
```

### `fail(message)`

Called only when an unsupported HTTP method is configured (not for HTTP error codes — those are handled by the built-in state screens).

```js
fail: function(message) {
  console.error('Repeater config error:', message);
}
```

---

## 13. Usage Examples

### Card list from API

```html
<input type="hidden" id="voyadores-cdn-url" value="https://cdn.voyadores.com" />
<div id="product-cards"></div>

<script>
$('#product-cards').repeater({
  endpoint: '/api/products',
  type: 'GET',
  params: { limit: 12 },
  mappingFunction: function(data) {
    return data.map(function(p) {
      return `
        <div class="col-md-4 mb-3">
          <div class="card h-100">
            <div class="card-body">
              <h6 class="card-title">${p.name}</h6>
              <p class="card-text text-muted">${p.description}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },
  success: function(data) {
    console.log('Loaded', data.length, 'products');
  }
});
</script>
```

### Notification list with custom empty state

```html
<ul id="notifications" class="list-group"></ul>

<script>
$('#notifications').repeater({
  endpoint: '/api/notifications',
  type: 'GET',
  imageEmpty: '/content/images/states/empty/general.notifications.empty.svg',
  messageNoResultHeader: 'All caught up',
  messageNoResult: 'No new notifications.',
  mappingFunction: function(data) {
    return data.map(function(n) {
      return `<li class="list-group-item">${n.message}</li>`;
    }).join('');
  }
});
</script>
```

### Refresh on filter change

```html
<select id="category-filter">
  <option value="all">All</option>
  <option value="active">Active</option>
  <option value="archived">Archived</option>
</select>
<div id="item-list"></div>

<script>
$('#item-list').repeater({
  endpoint: '/api/items',
  type: 'GET',
  params: { category: 'all' },
  mappingFunction: function(data) {
    return data.map(item => `<div class="item-row">${item.label}</div>`).join('');
  }
});

$('#category-filter').on('change', function() {
  $('#item-list').repeater('refresh', { category: $(this).val() });
});
</script>
```

### Static data with refreshData

```js
// Initial render
$('#local-list').repeater({
  data: initialItems,
  mappingFunction: function(data) {
    return data.map(i => `<div>${i.name}</div>`).join('');
  }
});

// Later, update with new data without a network call
$('#local-list').repeater('refreshData', updatedItems);
```

---

## 14. Best Practices

- **Always set `#voyadores-cdn-url`** — without it, state images will be broken in environments with a base URL.
- **Return `""` from `mappingFunction` to trigger the empty state** rather than rendering your own fallback UI; this keeps state handling consistent.
- **Use `refreshData` instead of `refresh`** when your data is already available client-side — it avoids an unnecessary network round trip.
- **Keep `async: false` only for synchronous requirements** — for most UI use cases, consider setting `async: true` to avoid blocking the browser during AJAX calls.
- **Use `customEmpty`** when the default empty state layout doesn't fit your design — it accepts any HTML string.
- **Sanitize data before rendering in `mappingFunction`** — the plugin does no output escaping; XSS protection is your responsibility if any data comes from user input.
