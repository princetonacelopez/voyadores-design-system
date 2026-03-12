---
title: "Table Plugin"
version: "2.2.1"
files: "`table-2-2-1.min.js` + `table-2-2-1.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-02-27"
---

## 1. Overview

The Voyadores Custom Table Plugin is a jQuery plugin that enhances standard HTML `<table>` elements with data loading, sorting, column resizing, column reordering, and animated row operations — all styled with the Voyadores Bootstrap theme.

It supports two data modes:
- **Static:** Pass a pre-built `data` array directly.
- **AJAX:** Point it at an API `endpoint` and it handles fetching, pagination, and error states automatically.

---

## 2. Features

| Feature | Desktop | Mobile (< 992px) |
|---|---|---|
| AJAX or static data loading | ✓ | ✓ |
| Loading / empty / error states | ✓ | ✓ |
| Column sorting (asc / desc) | ✓ | ✓ |
| Column resize (drag handle) | ✓ | ✗ (hidden) |
| Column drag-and-drop reorder | ✓ | ✗ (disabled) |
| Row counter (`#`) column | ✓ | ✓ |
| Load more / pagination | ✓ | ✓ |
| Animated add row | ✓ | ✓ |
| Animated update row | ✓ | ✓ |
| Animated remove row | ✓ | ✓ |
| View Transition API support | ✓ | ✓ |
| Dark theme | ✓ | ✓ |
| `prefers-reduced-motion` | ✓ | ✓ |

---

## 3. Dependencies

| Library | Version | Required |
|---|---|---|
| jQuery | 3.x recommended | **Yes** |
| Bootstrap 5 | 5.3.x (Voyadores theme) | **Yes** (for base table styles) |
| Voyadores Bootstrap theme CSS | latest | **Yes** |

Both jQuery and Bootstrap must be loaded **before** the plugin files.

---

## 4. Setup

### 1. Include files

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/bootstrap/bootstrap.voyadores.theme.min.css" />
<link rel="stylesheet" href="/css/table/table-2-2-1.css" />

<!-- Before closing </body> -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/bootstrap/bootstrap.bundle.min.js"></script>
<script src="/js/table/table-2-2-1.min.js"></script>
```

### 2. Add the CDN URL input

The plugin reads the base domain URL from a hidden input with `id="voyadores-cdn-url"`. This drives the paths for all state images (loader, error, empty). Add it once per page, anywhere in the `<body>`:

```html
<input type="hidden" id="voyadores-cdn-url" value="https://your-cdn-or-domain.com" />
```

Leave `value` empty (`""`) to use relative paths (works for same-origin apps).

### 3. Initialize

```javascript
$('#myTable').table({ /* options */ });
```

---

## 5. Required HTML Structure

The plugin requires a `<table>` with a unique `id`, a `<thead>` row with `<th>` elements, and an empty `<tbody>`.

```html
<table id="myTable" class="table table-hover table-bordered">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <!-- Plugin populates this -->
  </tbody>
</table>
```

> **Important:** The `id` attribute on `<table>` is **required**. The plugin will silently do nothing if it is missing.

---

## 6. Configuration Options

Pass these as a plain object to initialize the plugin.

### Data & Endpoint

| Option | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `""` | API URL to fetch data from. If empty, uses the `data` array instead. |
| `data` | `Array` | `[]` | Static data array. Used when `endpoint` is empty. |
| `params` | `function` | `() => ({})` | Function that returns an object of query parameters appended to the endpoint URL. |
| `transformData` | `function \| null` | `null` | Optional function to transform the raw API response before rendering. Receives the raw data, must return a transformed array. |
| `async` | `boolean` | `true` | Whether the AJAX call is asynchronous. |

### Rendering

| Option | Type | Default | Description |
|---|---|---|---|
| `mappingFunction` | `function` | `() => ""` | **Required for data display.** Receives the data array, must return an HTML string of `<tr>` elements. |
| `success` | `function` | `() => ""` | Callback fired after data is successfully rendered. Receives the data array. |
| `fail` | `function` | `() => ""` | Reserved for future failure handling. |
| `rowCounter` | `boolean` | `true` | Whether to prepend a `#` counter column to each row. |

### Empty / Error States

| Option | Type | Default | Description |
|---|---|---|---|
| `messageNoResultHeader` | `string` | `"No data found"` | Heading shown when data is empty (200 but no rows). |
| `messageNoResult` | `string` | `"There's nothing to display here at the moment."` | Body text for the empty state. |
| `messageNoPermission` | `string` | `"You don't have permission to view this content."` | Body text for 403 responses. |
| `messageErrorOccured` | `string` | `"There's a problem loading this content. Please try again later."` | Body text for 500 responses. |
| `messageNotFound` | `string` | `"The content you're looking for isn't available. It might have been moved or deleted."` | Body text for 404 responses. |
| `cssClassNoResult` | `string` | `""` | Additional CSS class applied to the state `<td>` wrapper. |
| `imageEmpty` | `string` | `"/content/images/states/empty/voyadores.default.empty.svg"` | Path (relative to the CDN URL) for the empty state image. |
| `messageLoading` | `string` | `"Loading data..."` | Accessible label for the loading state (used in `sr-only` span). |

### Headers

Nested under `headers`:

| Option | Type | Default | Description |
|---|---|---|---|
| `headers.columns` | `Array` | `[]` | Array of column configuration objects. See [Column Configuration](#7-column-configuration). |
| `headers.hideOnEmpty` | `boolean` | `false` | Hides the `<thead>` row when there is no data. |
| `headers.columnReorder` | `boolean` | `true` | Enables drag-and-drop column reordering globally. Individual columns can be excluded (see restrictions below). |

### Load More

Nested under `loadMore`:

| Option | Type | Default | Description |
|---|---|---|---|
| `loadMore.id` | `string` | `""` | The `id` of the "Load more" button element. Required to activate pagination. |
| `loadMore.hideOnEmpty` | `boolean` | `true` | Hides the button when a page returns fewer results than `showOnPageSize`. |
| `loadMore.showOnPageSize` | `number` | `20` | Minimum result count from a page to keep the "Load more" button visible. |
| `loadMore.onEmpty` | `function` | `() => ""` | Callback fired when a loaded page returns zero results. Receives the button element. |

---

## 7. Column Configuration

Each object in `headers.columns` configures one column. The plugin matches columns by the `column` property.

```javascript
headers: {
  columns: [
    {
      column: 1,           // Match by 1-based column index (or exact header text string)
      context: 'name',     // Data key used for sorting
      sortable: true,
      resizable: true,
      width: '200px',
      minWidth: '100px',
      maxWidth: '400px',
      defaultSort: 'asc',  // 'asc' | 'desc'
      customText: 'Full Name', // Override header label
    },
  ]
}
```

### Column Properties

| Property | Type | Description |
|---|---|---|
| `column` | `number \| string` | **Required.** Column index (1-based) or exact header text string to match against. |
| `context` | `string` | Data object key to sort by. Required when `sortable: true`. |
| `sortable` | `boolean` | Enables click-to-sort on this column header. Only works with `string` or `number` data types — columns with object/array values are automatically demoted. |
| `resizable` | `boolean` | Adds a drag handle to the right edge of the header for width adjustment. Disabled on touch screens. |
| `width` | `string` | Explicit CSS width (e.g. `"150px"`). Applied as an inline style. Persisted when the user resizes. |
| `minWidth` | `string` | Minimum column width during resize (e.g. `"80px"`). |
| `maxWidth` | `string` | Maximum column width during resize (e.g. `"500px"`). |
| `defaultSort` | `string` | Initial sort direction when the column is first clicked: `'asc'` (default) or `'desc'`. |
| `customText` | `string` | Overrides the rendered header label text. Does not affect sorting context. |
| `originalIndex` | `number` | Override the auto-assigned original column index. Only needed in edge cases. |

### Columns excluded from reordering

The following column types cannot be dragged regardless of `columnReorder`:
- Columns with class `row-counter`
- Columns with class `col-icon`
- Columns with class `visually-hidden` or containing a `.visually-hidden` child
- Columns containing a checkbox or radio input

---

## 8. Usage Examples

### 8.1 Static Data

```html
<table id="employeeTable" class="table table-hover table-bordered">
  <thead>
    <tr>
      <th>Name</th>
      <th>Department</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody></tbody>
</table>
```

```javascript
const employees = [
  { name: 'Maria Santos',  department: 'Finance',    status: 'Active'   },
  { name: 'Juan dela Cruz', department: 'Operations', status: 'Inactive' },
];

$('#employeeTable').table({
  data: employees,
  mappingFunction(data) {
    return data.map(row => `
      <tr>
        <td>${row.name}</td>
        <td>${row.department}</td>
        <td>${row.status}</td>
      </tr>
    `).join('');
  },
  success(data) {
    console.log(`Rendered ${data.length} rows.`);
  },
});
```

### 8.2 AJAX Endpoint

```javascript
$('#invoiceTable').table({
  endpoint: '/api/invoices',
  params() {
    return {
      startDate: $('#date-from').val(),
      endDate:   $('#date-to').val(),
      status:    'unpaid',
    };
  },
  mappingFunction(data) {
    return data.map(row => `
      <tr>
        <td>${row.invoiceNo}</td>
        <td>${row.client}</td>
        <td>${row.amount}</td>
        <td>${row.dueDate}</td>
      </tr>
    `).join('');
  },
  messageNoResult: 'No unpaid invoices found.',
});
```

### 8.3 With Sortable and Resizable Columns

The `column` value is the **1-based** column index in the `<thead>` row. If you also have a row counter (`rowCounter: true`, the default), the counter column becomes index 1 and your first data column becomes index 2 in the DOM — but the plugin adjusts for this automatically when `rowCounter` is `true`.

```javascript
$('#productTable').table({
  endpoint: '/api/products',
  mappingFunction(data) {
    return data.map(row => `
      <tr>
        <td>${row.sku}</td>
        <td>${row.name}</td>
        <td>${row.price}</td>
        <td>${row.stock}</td>
      </tr>
    `).join('');
  },
  headers: {
    columns: [
      { column: 1, context: 'sku',   sortable: true, resizable: true, width: '120px', minWidth: '80px'  },
      { column: 2, context: 'name',  sortable: true, resizable: true, width: '240px', minWidth: '120px' },
      { column: 3, context: 'price', sortable: true, resizable: true, width: '100px', minWidth: '80px'  },
      { column: 4, context: 'stock', sortable: true, resizable: true, width: '100px', minWidth: '60px'  },
    ],
  },
});
```

### 8.4 AJAX with Transform

Use `transformData` when the API wraps data in a container object:

```javascript
$('#orderTable').table({
  endpoint: '/api/orders',
  transformData(response) {
    // API returns { data: [...], meta: {...} }
    return response?.data ?? [];
  },
  mappingFunction(data) {
    return data.map(row => `<tr><td>${row.orderId}</td><td>${row.total}</td></tr>`).join('');
  },
});
```

### 8.5 Disabling Row Counter

```javascript
$('#simpleTable').table({
  data: myData,
  rowCounter: false,
  mappingFunction(data) { /* ... */ },
});
```

### 8.6 Custom Empty State

```javascript
$('#reportTable').table({
  endpoint: '/api/reports',
  imageEmpty: '/images/states/empty/no-reports.svg',
  messageNoResultHeader: 'No reports yet',
  messageNoResult: 'Generate your first report to see it here.',
  mappingFunction(data) { /* ... */ },
});
```

---

## 9. Commands Reference

After initialization, use the same `$('#table').table(command, params)` syntax to control the table.

### `refresh`

Reloads the table. Resets the page counter to 1.

```javascript
// Re-fetch from endpoint (no change to params)
$('#myTable').table('refresh');

// Re-fetch with a new static data array
$('#myTable').table('refresh', newDataArray);

// Re-fetch with updated params object
$('#myTable').table('refresh', { startDate: '2026-01-01' });

// Re-fetch with a new params function
$('#myTable').table('refresh', () => ({ status: 'active' }));
```

### `clear`

Empties the `<tbody>` immediately, without rendering any state.

```javascript
$('#myTable').table('clear');
```

### `add`

Inserts a single row without a full re-render. If the table is in an empty or error state, it triggers a full rebuild instead.

```javascript
$('#myTable').table('add', {
  item: { name: 'Ana Reyes', department: 'HR', status: 'Active' },
  insertAt: 'first',  // 'first' | 'last' | 0-based index | negative index
});
```

| `insertAt` value | Behavior |
|---|---|
| `'last'` (default) | Appends after the last row |
| `'first'` | Prepends before the first row |
| `2` (positive number) | Inserts at the given 0-based position |
| `-1` (negative number) | Inserts relative to the end (`data.length - 1`) |

The new row plays the **row-added** orange glow animation (or a View Transition if the browser supports it).

### `update`

Replaces a single row in-place. Matches by a key property (preferred) or by numeric index fallback.

```javascript
// Match by key property
$('#myTable').table('update', {
  key:  'employeeId',              // Property name to match
  item: { employeeId: 42, name: 'Ana Reyes', status: 'Inactive' },
});

// Fallback: match by 0-based row index
$('#myTable').table('update', {
  at:   3,
  item: { name: 'Updated Name', status: 'Active' },
});
```

Update supports **partial updates** — only the properties included in `item` are merged with the existing row data. Unspecified properties retain their current values.

The updated row plays the **row-updated** heartbeat glow animation.

### `remove`

Removes a single row by matching a key/value pair.

```javascript
$('#myTable').table('remove', {
  key:   'invoiceId',   // Property name to match
  value: 1024,          // Value to match against
});
```

If the last row is removed, the table transitions to the empty state automatically. The removed row plays the **row-removing** fade-out + collapse animation before being detached from the DOM.

---

## 10. Row Animation Events

The plugin uses the **View Transition API** when available (Chrome 111+, Edge 111+). In unsupported browsers, CSS keyframe animations are used as a fallback.

### Add animation

| Phase | VT (modern browsers) | Fallback (CSS) |
|---|---|---|
| Row insertion | Slot opens via VT repositioning | Height expands from 0 to natural height |
| After insert | Orange glow fades over 10s (`row-added`) | Same orange glow |

### Update animation

| Phase | VT | Fallback |
|---|---|---|
| Row swap | Old row cross-fades to new row via VT | Direct `replaceWith` |
| After swap | Heartbeat glow over 10s (`row-updated`) | Same heartbeat glow |

### Remove animation

| Phase | VT | Fallback |
|---|---|---|
| Row removal | Row cross-fades out via VT, others slide up | Fade-out (0.2s) + height-collapse (0.25s) |
| Duration | ~350ms | ~620ms |

### `prefers-reduced-motion`

All glow animations and row animations are disabled when the user has enabled reduced motion in their OS settings. View Transition API animation duration is reduced to `0.01ms`.

---

## 11. Load More / Pagination

The plugin adds `?page=N` to every AJAX call automatically. To enable "load more" behavior:

1. Add a button to your page with a unique `id`.
2. Configure `loadMore.id` with that `id`.

```html
<button id="loadMoreBtn" class="btn btn-outline-secondary mt-3">Load more</button>
```

```javascript
$('#myTable').table({
  endpoint: '/api/transactions',
  loadMore: {
    id: 'loadMoreBtn',
    showOnPageSize: 20,  // Hide button if fewer than 20 results returned
    hideOnEmpty: true,
    onEmpty(btn) {
      $(btn).text('All records loaded').prop('disabled', true);
    },
  },
  mappingFunction(data) { /* ... */ },
});
```

- First load: `GET /api/transactions?page=1`
- User clicks "Load more": `GET /api/transactions?page=2`
- New rows are **appended** to existing rows (not replacing them)
- If the active sort is applied, newly loaded rows are sorted in-place before appending
- The button hides automatically when a page returns fewer results than `showOnPageSize`
- Calling `table('refresh')` resets the page counter to 1 and replaces all rows


---

## 12. Dark Theme

Bootstrap dark theme is supported out of the box. Apply `data-bs-theme="dark"` to the `<html>` element or any parent container:

```html
<html data-bs-theme="dark">
```

The plugin reverses the sort arrow icons using `filter: invert(1) grayscale(1)` so they remain visible in dark mode.

---

## 13. Mobile & Responsive Behavior

At viewport widths **≤ 991.98px** (tablets and phones):

- Column **resize handles** are hidden (`display: none !important`)
- Column resize **cursors** revert to default
- Drag-and-drop column **reorder** is not initialized (resize/reorder are desktop-only UX patterns)
- All other features (sorting, load more, row animations) continue to work normally

No additional configuration is required — this behavior is built into the CSS.

---

## 14. CSS Classes Reference

### Applied by the plugin to the `<table>`

| Class | When applied |
|---|---|
| `table-custom` | Always — added on initialization |
| `fixed-layout` | After first data render when at least one resizable column is configured |
| `col-table-resizing` | While the user is actively dragging a column resize handle |

### Applied by the plugin to `<th>` elements

| Class | When applied |
|---|---|
| `sortable` | Column is configured as sortable |
| `col-resizable` | Column is configured as resizable |
| `col-resize-active` | Column header being actively resized |
| `is-dragging` | Column header being dragged for reorder |
| `drag-over` | Column header being dragged over as a drop target |
| `row-counter` | Auto-prepended row counter `<th>` |

### Applied by the plugin to `<td>` elements

| Class | When applied |
|---|---|
| `row-counter` | Auto-prepended row counter `<td>` |
| `sort-active` | All cells in the currently sorted column |
| `status-text` | The `<td>` inside a loading / empty / error state row |

### Applied by the plugin to `<tr>` elements

| Class | When applied | Duration |
|---|---|---|
| `row-added` | After a row is added via `add` command | Removed after 10.2s |
| `row-updated` | After a row is updated via `update` command | Removed after 10.1s |
| `row-removing` | While a row is being removed (fallback animation only) | Removed after 620ms |

### Sort link classes (on `<a class="sort">`)

| Class | Meaning |
|---|---|
| `sort-asc` | Currently sorted ascending |
| `sort-desc` | Currently sorted descending |
| `active` | This column is the currently active sort |

### Utility classes (usable in your markup)

| Class | Effect |
|---|---|
| `col-icon` | 56px fixed-width column; excluded from reordering |
| `row-counter` | 56px fixed-width column; excluded from reordering |
| `sr-only` | Visually hidden but accessible to screen readers |

---

## 15. State Images

The plugin displays state images for loading, empty, and error conditions. Image URLs are constructed as:

```
{voyadores-cdn-url} + {image path}
```

Where `{voyadores-cdn-url}` is the `value` of `<input id="voyadores-cdn-url">`.

| State | HTTP Status | Default Path |
|---|---|---|
| Loading | — | `/content/images/states/loader/voyadores-loader.gif` |
| No permission | 403 | `/content/images/states/error/voyadores-403.svg` |
| Not found | 404 | `/content/images/states/error/voyadores-404.svg` |
| Server error | 500 | `/content/images/states/error/voyadores-500.svg` |
| Empty data | 200 | `/content/images/states/empty/voyadores.default.empty.svg` |

To use a custom empty state image, pass `imageEmpty` in the options:

```javascript
$('#myTable').table({
  imageEmpty: '/content/images/states/empty/my-custom-empty.svg',
  // ...
});
```

Only the empty state image is configurable. Error state images are fixed.

---

## 16. Debugging & Troubleshooting

### Table renders nothing after initialization

The plugin calls `return` silently if `id` is missing.

```html
<!-- Wrong -->
<table class="table">

<!-- Correct -->
<table id="myTable" class="table">
```

---

### `Unable to trigger 'refresh'. No existing instance found`

This error means you are calling a command on a table that has not been initialized yet, or the `id` doesn't match.

```javascript
// Must initialize first
$('#myTable').table({ data: [], mappingFunction() { return ''; } });

// Then use commands
$('#myTable').table('refresh', newData);
```

---

### `The option 'params' for #myTable must be a function`

`params` must always be a **function** that returns an object, not a plain object.

```javascript
// Wrong
params: { status: 'active' }

// Correct
params: () => ({ status: 'active' })

// Also correct (dynamic)
params() {
  return {
    status: $('#statusFilter').val(),
    search: $('#searchInput').val(),
  };
},
```

---

### Sort does not work on a column

The plugin validates data types before enabling sort. It will log a warning and disable sorting if the column's values are not all `string` or `number`.

```
Unable to set column 'X' as sortable. The context 'Y' is not of type string or number.
```


---

### Columns are not matching in `headers.columns`

The `column` property matches against the **1-based column index** (counting from left) or the **exact header text** of the `<th>`. If `rowCounter: true` (default), the `#` counter column becomes the first `<th>` in the DOM, shifting subsequent columns.

Example — with row counter enabled:

```html
<thead>
  <tr>
    <!-- #  (row-counter, index 0 in DOM) -->
    <th>Name</th>       <!-- index 1 in column config -->
    <th>Email</th>      <!-- index 2 in column config -->
  </tr>
</thead>
```

```javascript
headers: {
  columns: [
    { column: 1, context: 'name',  sortable: true },
    { column: 2, context: 'email', sortable: true },
  ]
}
```

Alternatively, match by header text string:

```javascript
{ column: 'Name',  context: 'name',  sortable: true },
{ column: 'Email', context: 'email', sortable: true },
```

---

### Data is not an array / Object structure mismatch

The plugin validates data on every fetch. Both conditions will cause the table to render as empty (`[]`):

1. **`The data is not an array.`** — Your API returned an object, null, or non-array. Use `transformData` to extract the array.
2. **`Object structure mismatch.`** — Not all objects in the array have the same keys. Normalize your data server-side or with `transformData`.

---

### Resize / reorder not working on mobile

This is expected behavior. Both features are disabled at `≤ 991.98px` viewport width. Test on a desktop browser.

---

### Row animations not playing

Check if `prefers-reduced-motion: reduce` is enabled in the OS accessibility settings. All animations are intentionally disabled in that mode per WCAG guidelines.

For the modern add/update/remove animations (VT path), the browser must support the **View Transition API** (Chrome 111+, Edge 111+). On Firefox or Safari, the CSS fallback animations are used instead.

---

## 17. Best Practices

### Keep `mappingFunction` pure

The mapping function receives the data array and returns HTML. Do not mutate the array inside it — use `transformData` for that.

```javascript
// Bad
mappingFunction(data) {
  data.sort((a, b) => a.name.localeCompare(b.name)); // mutates!
  return data.map(row => `<tr>...</tr>`).join('');
},

// Good — sort in transformData
transformData(data) {
  return [...data].sort((a, b) => a.name.localeCompare(b.name));
},
mappingFunction(data) {
  return data.map(row => `<tr>...</tr>`).join('');
},
```

### Use `key` for add / update / remove when possible

Matching by `key` property is safer than matching by index (`at`). Index-based matching is fragile if rows are sorted or reordered.

```javascript
// Preferred
$('#myTable').table('update', { key: 'employeeId', item: updatedEmployee });

// Avoid when key is available
$('#myTable').table('update', { at: 3, item: updatedEmployee });
```

### Escape HTML in `mappingFunction`

Never insert raw user data directly into HTML strings. Escape values to prevent XSS:

```javascript
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

mappingFunction(data) {
  return data.map(row => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.email)}</td>
    </tr>
  `).join('');
},
```

### Set `voyadores-cdn-url` once at the layout level

Put the hidden input in your base layout template so every page that uses the table plugin will automatically have it available:

```html
<!-- In base layout -->
<input type="hidden" id="voyadores-cdn-url" value="{{ config('app.cdn_url') }}" />
```

### Namespace your refresh calls

When multiple filters control a table, use a single coordinated refresh rather than calling refresh from each filter's change handler independently:

```javascript
function refreshTable() {
  $('#myTable').table('refresh');
}

$('#statusFilter, #dateRange, #searchInput').on('change input', debounce(refreshTable, 300));
```

### Pair `loadMore` with a reasonable `showOnPageSize`

Set `showOnPageSize` to match your API's page size exactly. If your API returns 20 items per page, set `showOnPageSize: 20`. This ensures the button hides correctly on the last page without an extra empty request.

---

*Documentation maintained by the Voyadores Design System team. For plugin issues or feature requests, contact the frontend platform team.*
