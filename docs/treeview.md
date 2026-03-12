---
title: "Treeview"
version: "1.0.0"
files: "`treeview-1-0-0.min.js` + `treeview-1-0-0.min.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Voyadores Treeview is a jQuery plugin that renders a hierarchical tree structure from a nested data array. It supports multi-level nesting, expand/collapse behavior, row action buttons, and automatic state screens for loading, empty, and error conditions. Data can come from a static array or a remote GET endpoint.

---

## 2. Features

- **Unlimited nesting depth** via recursive `nodes` arrays
- **Expand / collapse** per branch, with optional collapse-all-on-load
- **Action buttons** per node — rendered inline or collapsed into a "more" menu on mobile
- **Two data modes:** static array or AJAX GET endpoint
- **Automatic state screens:** loading, empty, 404, 500
- **Configurable tree header** label pinned above the root
- **Light and dark theme** support via Bootstrap `data-bs-theme`
- **CDN-aware image paths** from `#voyadores-cdn-url`

---

## 3. Dependencies

| Dependency | Notes |
|---|---|
| jQuery 3.x | Required. Must load before the plugin. |
| Bootstrap 5.x | Required for utility classes (`d-flex`, `btn`, `btn-group`, `vstack`, etc.) and theme tokens. |
| Voyadores Icon Font | Required if action buttons use `vi-solid` / `vi-regular` icon classes. |

---

## 4. Setup

### Via CDN

```html
<!-- Bootstrap CSS -->
<link rel="stylesheet" href="https://cdn.voyadores.com/content/css/bootstrap/bootstrap.voyadores.theme.min.css" />

<!-- Treeview CSS -->
<link rel="stylesheet" href="https://cdn.voyadores.com/content/css/treeview/treeview-1-0-0.min.css" />

<!-- jQuery -->
<script src="https://cdn.voyadores.com/content/js/jquery/jquery-3.6.0.min.js"></script>

<!-- Treeview JS -->
<script src="https://cdn.voyadores.com/content/js/treeview/treeview-1-0-0.min.js"></script>
```

### CDN Base URL Helper (required for state images)

```html
<input type="hidden" id="voyadores-cdn-url" value="https://cdn.voyadores.com" />
```

State screen images (404, 500, empty) are resolved relative to this value. If omitted, the prefix will be an empty string and images may be broken unless the asset paths are available at the root.

---

## 5. Required HTML Structure

The treeview targets any block element with an `id`. The plugin fully controls its inner HTML.

```html
<div id="my-tree" class="root"></div>
```

> Apply the `.root` class to get the correct background, border, and padding from the treeview CSS.

Initialize with jQuery:

```js
$('#my-tree').treeview({ ...options });
```

---

## 6. Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `""` | API URL. Leave empty to use static `data`. |
| `type` | `string` | `"GET"` | HTTP method. Only `"GET"` is supported for AJAX. |
| `async` | `boolean` | `true` | Whether the AJAX request is asynchronous. |
| `params` | `object` | `{}` | Query parameters appended to the GET request URL. |
| `data` | `array` | `[]` | Static node array. Used when `endpoint` is empty. |
| `collapseOnLoad` | `boolean` | `false` | If `true`, all branches start collapsed. Default is all expanded. |
| `actions` | `array` | `[]` | Array of action button configs. See [Action Buttons](#9-action-buttons). |
| `treeHeader` | `string` | `"Accounts"` | Label shown in the top-left header above the tree. |
| `onSuccess` | `function(data)` | no-op | Called after a successful render. Receives the raw data or AJAX response. |
| `onFailure` | `function(message)` | no-op | Called on unsupported HTTP method or server error. Receives the error message. |
| `messageNoResultHeader` | `string` | `"No data found"` | Heading in the empty state. |
| `messageNoResult` | `string` | `"There's nothing to display here at the moment."` | Body text in the empty state. |
| `messageErrorOccured` | `string` | `"There's a problem loading this content. Please try again later."` | Message for 500 errors and static-data failures. |
| `messageNotFound` | `string` | `"The content you're looking for isn't available. It might have been moved or deleted."` | Message for 404 errors. |
| `imageEmpty` | `string` | `/content/images/states/empty/voyadores.default.empty.svg` | Path (relative to CDN base) for the empty state image. |

---

## 7. Data Structure

Each node in the `data` array (or API response) must follow this shape:

```js
{
  id: "unique-id",       // string or number — identifies the node
  rootId: "parent-id",   // string or number — id of the parent node (or root identifier)
  text: "Node Label",    // string — the visible text for this row
  nodes: [ ... ]         // array — optional child nodes; omit or leave empty for a leaf
}
```

### Leaf node (no children)

```js
{ id: "n3", rootId: "n1", text: "Invoice #1042" }
```

### Branch node (has children)

```js
{
  id: "n1",
  rootId: "root",
  text: "Client A",
  nodes: [
    { id: "n2", rootId: "n1", text: "Project Alpha" },
    { id: "n3", rootId: "n1", text: "Project Beta" }
  ]
}
```

Nesting can go arbitrarily deep by adding `nodes` at any level.

---

## 8. Data Modes

### Static mode

Pass data directly without an endpoint:

```js
$('#my-tree').treeview({
  treeHeader: 'Departments',
  data: [
    {
      id: 'eng', rootId: 'root', text: 'Engineering',
      nodes: [
        { id: 'fe', rootId: 'eng', text: 'Frontend' },
        { id: 'be', rootId: 'eng', text: 'Backend' }
      ]
    },
    { id: 'des', rootId: 'root', text: 'Design' }
  ]
});
```

If `data` is empty (`[]`), the empty state screen is shown.
If `data` is not an array, the 500 error state is shown and `onFailure` is called.

### AJAX mode (GET only)

```js
$('#my-tree').treeview({
  endpoint: '/api/accounts/tree',
  type: 'GET',
  params: { companyId: 42 },
  treeHeader: 'Chart of Accounts',
  onSuccess: function(response) {
    console.log('Tree loaded');
  },
  onFailure: function(msg) {
    console.error('Tree error:', msg);
  }
});
```

The params are serialized as a query string: `/api/accounts/tree?companyId=42`

> **Note:** Only `GET` is supported. Using any other `type` value will render the 500 error state and call `onFailure("Unsupported call type")`.

The API response must be a **JSON array** of node objects. A non-array 200 response is treated as a 500 error.

---

## 9. Action Buttons

The `actions` array attaches buttons to every node row. Each action is an object with three fields:

| Field | Type | Description |
|---|---|---|
| `buttonSelector` | `string` | CSS selector used to delegate the click handler (e.g. `".btn-edit"`). |
| `button` | `string \| function(id, rootId, text)` | The button HTML, or a function that returns it per node. |
| `onClick` | `function` | Click handler. Receives `(id, container, text)` if 3 params, or `({ id, parentId, description, self }, event)` if 2 params. |

### Single action (always visible)

```js
actions: [
  {
    buttonSelector: '.btn-edit',
    button: '<button class="btn btn-sm btn-outline-primary btn-edit" type="button">Edit</button>',
    onClick: function(id, container, text) {
      console.log('Edit node:', id, text);
    }
  }
]
```

### Multiple actions — function per node

When `button` is a function, it receives the current node's `id`, `rootId`, and `text` and should return an HTML string:

```js
actions: [
  {
    buttonSelector: '.btn-edit',
    button: function(id, rootId, text) {
      return `<button class="btn btn-sm btn-outline-primary btn-edit" type="button"
                data-id="${id}">Edit</button>`;
    },
    onClick: function({ id, parentId, description, self }, event) {
      console.log('Edit', id, description);
    }
  },
  {
    buttonSelector: '.btn-delete',
    button: function(id, rootId, text) {
      return `<button class="btn btn-sm btn-outline-danger btn-delete" type="button"
                data-id="${id}">Delete</button>`;
    },
    onClick: function(id, container, text) {
      if (confirm(`Delete "${text}"?`)) deleteNode(id);
    }
  }
]
```

### Mobile collapse behavior

On viewports ≤ 992px wide, when there are **2 or more** actions on a node, all buttons are collapsed into a single "more" toggle button:

```html
<button class="btn-open-tree-action-button btn" type="button"
  data-id="..."
  data-root-id="..."
  data-text="..."
  data-actions-html="%3Cbutton...%3E">
  <span class="vi-solid vi-more-vertical"></span>
</button>
```

The individual button HTML is URL-encoded into `data-actions-html`. Your application is responsible for reading and rendering this attribute (e.g., in a dropdown or offcanvas panel). On desktop, all buttons render inline regardless of count.

---

## 10. Commands Reference

### Initialize

```js
$('#my-tree').treeview({ ...options });
```

Re-initializing the same element will reuse existing options (merging with stored state) rather than creating a duplicate instance.

### `refresh`

Reload data — fetches from `endpoint` again (or re-renders static data), optionally with new params:

```js
// Refresh with existing params
$('#my-tree').treeview('refresh');

// Refresh with updated params
$('#my-tree').treeview('refresh', { companyId: 99, year: 2026 });
```

---

## 11. Callbacks

### `onSuccess(data)`

Called after a successful render. For AJAX, `data` is the raw jQuery `complete` response object. For static mode, it is the `data` array.

```js
onSuccess: function(data) {
  console.log('Tree rendered successfully');
}
```

### `onFailure(message)`

Called when the AJAX type is unsupported, or when static `data` is not an array.

```js
onFailure: function(message) {
  console.error('Treeview error:', message);
}
```

> HTTP 404 and 500 responses do **not** call `onFailure` — they render their own state screens automatically.

---

## 12. State Screens

The plugin automatically replaces the container content with a state screen during loading and on errors. All error/empty images are resolved against `#voyadores-cdn-url`.

| State | Trigger | Image |
|---|---|---|
| **Loading** | Before any fetch/render begins | Inline base64 animated GIF (32×32) |
| **Empty** | `data` is an empty array `[]` | Configurable via `imageEmpty` (default 160px) |
| **404** | AJAX returns 404 | `/content/images/states/error/voyadores-404.svg` |
| **500** | AJAX returns 500, non-array response, or unsupported method | `/content/images/states/error/voyadores-500.svg` |

State screen containers use `.tree-loader` (loading) or `.tree-empty` / `.tree-error` (empty/error), and are styled with `text-center` and the CDN-relative image.

Use `cssClassNoResult` on the Repeater but note the Treeview does **not** expose this option — state styling is fixed by the CSS.

---

## 13. CSS Classes Reference

### Container

| Class | Description |
|---|---|
| `.root` | Apply to the host `<div>`. Sets background, border, padding, and border-radius. |
| `.root:has(.tree-loader, .tree-empty, .tree-error)` | Auto-reduces padding during state screens. |
| `.tree-header` | Absolutely-positioned header label above the tree lines. |

### Tree structure

| Class | Description |
|---|---|
| `.treeview-root-ul` | Root `<ul>` rendered by the plugin. |
| `.treeview-container` | `<li>` that has children (a branch). Removes bottom border. |
| `.tree-branch` | The row `<span>` — flex row with text and action buttons. |
| `.tree-item` | The text `<div>` inside a branch. `0.875rem`, `font-weight: 500`, nowrap. |
| `.treeview-dropdown` | Branch `<span>` that is clickable to expand/collapse. |
| `.treeview-nested` | Child `<ul>`. Hidden by default (`display: none`). |
| `.treeview-active` | Added to `.treeview-nested` to show it (`display: block`). |
| `.treeview-caret` | Expand/collapse arrow `<i>` inside a branch label. |
| `.treeview-caret-down` | Rotates the caret 180° (expanded state). |

### State screens

| Class | Description |
|---|---|
| `.tree-loader` | Loading state — uses CSS Grid `place-items: center`. |
| `.tree-empty` | Empty state — `text-align: center`. |
| `.tree-error` | Error state (404/500) — `text-align: center`. |

---

## 14. Dark Theme

The treeview respects Bootstrap's `data-bs-theme` attribute. The background color token switches automatically:

```css
/* Light (default) */
:root, [data-bs-theme="light"] {
  --tree-background-color: #f6f6f6;
}

/* Dark */
[data-bs-theme="dark"] {
  --tree-background-color: #1b1b1b;
}
```

The caret SVG icon also inverts in dark mode via `filter: invert(1)`.

To enable dark mode on the whole page:

```html
<html data-bs-theme="dark">
```

Or scope it to the treeview container only:

```html
<div id="my-tree" class="root" data-bs-theme="dark"></div>
```

---

## 15. Usage Examples

### Basic static tree

```html
<input type="hidden" id="voyadores-cdn-url" value="https://cdn.voyadores.com" />
<div id="org-tree" class="root"></div>

<script>
$('#org-tree').treeview({
  treeHeader: 'Organization',
  data: [
    {
      id: 'ceo', rootId: 'root', text: 'Chief Executive Officer',
      nodes: [
        {
          id: 'cto', rootId: 'ceo', text: 'Chief Technology Officer',
          nodes: [
            { id: 'fe-lead', rootId: 'cto', text: 'Frontend Lead' },
            { id: 'be-lead', rootId: 'cto', text: 'Backend Lead' }
          ]
        },
        { id: 'cfo', rootId: 'ceo', text: 'Chief Financial Officer' }
      ]
    }
  ]
});
</script>
```

### AJAX tree with refresh on filter change

```html
<select id="company-select">
  <option value="1">Company A</option>
  <option value="2">Company B</option>
</select>
<div id="account-tree" class="root"></div>

<script>
$('#account-tree').treeview({
  endpoint: '/api/accounts/tree',
  type: 'GET',
  params: { companyId: 1 },
  treeHeader: 'Chart of Accounts',
  collapseOnLoad: true,
  onSuccess: function() { console.log('Tree loaded'); },
  onFailure: function(msg) { console.error(msg); }
});

$('#company-select').on('change', function() {
  $('#account-tree').treeview('refresh', { companyId: $(this).val() });
});
</script>
```

### Tree with action buttons

```html
<div id="file-tree" class="root"></div>

<script>
$('#file-tree').treeview({
  treeHeader: 'File System',
  data: [
    {
      id: 'docs', rootId: 'root', text: 'Documents',
      nodes: [
        { id: 'rep1', rootId: 'docs', text: 'Q1 Report.pdf' },
        { id: 'rep2', rootId: 'docs', text: 'Q2 Report.pdf' }
      ]
    }
  ],
  actions: [
    {
      buttonSelector: '.btn-download',
      button: function(id, rootId, text) {
        return `<button class="btn btn-sm btn-outline-secondary btn-download" type="button"
                  data-id="${id}" data-text="${text}">
                  <span class="vi-solid vi-download"></span>
                </button>`;
      },
      onClick: function(id, container, text) {
        console.log('Download:', id, text);
      }
    },
    {
      buttonSelector: '.btn-rename',
      button: function(id, rootId, text) {
        return `<button class="btn btn-sm btn-outline-primary btn-rename" type="button"
                  data-id="${id}">Rename</button>`;
      },
      onClick: function({ id, description, self }) {
        const newName = prompt('Rename to:', description);
        if (newName) renameNode(id, newName);
      }
    }
  ]
});
</script>
```

### Collapsed on load with custom messages

```js
$('#my-tree').treeview({
  endpoint: '/api/tree',
  type: 'GET',
  collapseOnLoad: true,
  treeHeader: 'Ledger',
  messageNoResultHeader: 'Nothing here',
  messageNoResult: 'No accounts have been created yet.',
  messageErrorOccured: 'Unable to load the ledger. Try refreshing.',
  messageNotFound: 'Ledger data could not be found.'
});
```

---

## 16. Best Practices

- **Always include `.root` on the host element** — it provides the required background color, border, and padding that the tree lines rely on.
- **Set `#voyadores-cdn-url`** — state images (404, 500, empty) are resolved from this value; without it they will show broken image icons.
- **Use `collapseOnLoad: true` for large trees** — rendering all nodes expanded in a deep hierarchy can be slow and visually overwhelming.
- **Only GET is supported for AJAX** — if your API requires POST, load the data yourself and use static mode with `data`.
- **`buttonSelector` must match the class on your `button` HTML** — the plugin delegates click events via this selector; a mismatch means `onClick` will never fire.
- **On mobile (≤ 992px), 2+ actions collapse to a single toggle button** — your app must handle the `data-actions-html` attribute on `.btn-open-tree-action-button` to show them (e.g. in an offcanvas or dropdown).
- **Do not call `refresh` before the tree is initialized** — the plugin looks up state by element `id`; if not yet initialized there is nothing to refresh.
- **Sanitize node `text` values server-side** — the plugin renders `text` directly into HTML without escaping; XSS is your responsibility if the data originates from user input.
