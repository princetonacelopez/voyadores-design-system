---
title: "File Template Editor"
version: "1.0.0"
files: "file-template-editor.js · json-template-editor.js"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

This directory contains two independent editor components:

| File | Export | Purpose |
|---|---|---|
| `file-template-editor.js` | `export default FileTemplateEditor` | WYSIWYG/code editor for HTML and CSHTML/Razor templates |
| `json-template-editor.js` | `export default JSONEditor` + named `JSONFormatter`, `JSONHighlighter` | JSON editor with live syntax-highlighted preview |

---

---

# 1. FileTemplateEditor

## Overview

`FileTemplateEditor` is a browser-based WYSIWYG and code editor for HTML and ASP.NET Core Razor (CSHTML) template files. It renders content inside a sandboxed `<iframe>` in **Preview mode** and exposes the raw source in a `<textarea>` in **Code mode**. The key feature is full Razor syntax preservation — `@model`, `@foreach`, `@{ }` blocks, `@Model.Property` expressions, and all other Razor constructs are extracted before preview rendering and faithfully restored when retrieving content.

### Key Capabilities

- WYSIWYG rich text editing inside an iframe (contenteditable)
- Code view with raw CSHTML/HTML display
- Razor/CSHTML syntax round-trip preservation (extract → placeholder → restore)
- Image insertion from local file with click-to-select and drag-to-resize
- Toolbar: bold, italic, underline, lists, alignment, font size, image
- Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)
- Style injection from template `<head>` into the preview iframe
- Full document structure preserved (DOCTYPE, `<html>`, `<head>`, `<body>`)
- Base64 image data truncated in code view for readability

---

## CDN Setup

```html
<script type="module">
  import FileTemplateEditor from 'https://cdn.voyadores.com/content/js/file-template-editor/file-template-editor.js';

  const editor = new FileTemplateEditor('editorContainer');
</script>
```

> The file uses `export default`. It must be loaded with `<script type="module">` or a module bundler. It cannot be used as a classic script.

No additional CSS file is required — all editor styles are injected at runtime by the class itself.

---

## Required HTML

The only requirement is a container element with a unique `id`.

```html
<div id="editorContainer"></div>
```

The class generates all internal HTML structure (toolbar, iframe, textarea) inside the container automatically.

---

## Constructor & Options

```js
new FileTemplateEditor(containerId, options)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `containerId` | `string` | Yes | `id` of the container element. Throws `Error` if not found. |
| `options` | `object` | No | Optional configuration (see below). |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `height` | `string` | `'100%'` | CSS height applied to both the iframe and code textarea. Accepts any CSS unit: `'500px'`, `'80vh'`, etc. |
| `placeholder` | `string` | `'Start typing here...'` | Placeholder text shown when the editor body is empty (rendered via CSS `::before`). |

```js
const editor = new FileTemplateEditor('editorContainer', {
  height: '600px',
  placeholder: 'Start editing your template…'
});
```

---

## View Modes

The editor has two modes, toggled by the toolbar buttons or via `switchMode()`.

### Preview Mode (default)

- The iframe is visible; the textarea is hidden.
- Content is rendered in a live WYSIWYG iframe with `designMode = 'on'`.
- Razor expressions (`@Model.Name`, `@Html.Method()`, etc.) appear as gray inline badges.
- Razor blocks (`@{ }`, `@foreach`, etc.) are stored as hidden HTML comments — invisible in the editor.
- CSS `<style>` and `<link>` tags from the template `<head>` are injected into the iframe so the template renders with its own styles.
- Images are clickable (select) and resizable (drag handle).
- All formatting toolbar buttons and keyboard shortcuts are active.

### Code Mode

- The textarea is visible; the iframe is hidden.
- Displays the full CSHTML source with proper indentation.
- Base64 image `src` values are truncated to the first 30 characters followed by `...` to keep the code view readable. The full data is preserved internally.
- The user can hand-edit any HTML or Razor syntax.
- Font size select adjusts the textarea's font size, not the content.
- Formatting toolbar buttons are disabled (irrelevant in code view).

### Switching Modes

1. Current iframe content is serialized to full CSHTML (Razor restored).
2. Full CSHTML with complete base64 is stored internally.
3. Base64 truncated version is formatted and shown in textarea.

1. Textarea content is read.
2. Any truncated base64 is restored from internal storage.
3. Content is processed (Razor extracted) and rendered to the iframe.

---

## Toolbar Reference

The toolbar is generated automatically. All buttons target the iframe when in Preview mode.

### Formatting Group

| Button | Action | Keyboard |
|---|---|---|
| **B** — Bold | `document.execCommand('bold')` | Ctrl/Cmd + B |
| *I* — Italic | `document.execCommand('italic')` | Ctrl/Cmd + I |
| U — Underline | `document.execCommand('underline')` | Ctrl/Cmd + U |

Buttons show an `.active` state when the cursor is inside bold/italic/underlined content.

### List Group

| Button | Action |
|---|---|
| Bullet List | `document.execCommand('insertUnorderedList')` |
| Numbered List | `document.execCommand('insertOrderedList')` |

### Alignment Group

| Button | Action | Keyboard |
|---|---|---|
| Align Left | `document.execCommand('justifyLeft')` | Ctrl/Cmd + Shift + L |
| Align Center | `document.execCommand('justifyCenter')` | Ctrl/Cmd + Shift + E |
| Align Right | `document.execCommand('justifyRight')` | Ctrl/Cmd + Shift + R |
| Justify | `document.execCommand('justifyFull')` | Ctrl/Cmd + Shift + J |

### Font Size

A `<select>` with sizes: 10–16px (each), 20, 24, 32, 36, 40, 48, 56, 64, 72, 80px.

- In **Preview mode:** wraps selected text in `<span style="font-size: Xpx">`.
- In **Code mode:** changes the textarea's own font size for readability.

### Image

Clicking the image button opens a file picker (accepts `.png`, `.jpg`, `.jpeg`, `.svg`).

- If no image is selected in the editor: inserts a new image at the cursor.
- If an image is selected: replaces that image's `src`, preserving its current width.

### Mode Toggle

| Button | data-mode | Default state |
|---|---|---|
| Preview (eye icon) | `preview` | Active |
| Code (brackets icon) | `code` | Inactive |

---

## Keyboard Shortcuts

All shortcuts are captured inside the editor iframe.

| Shortcut | Action |
|---|---|
| Ctrl/Cmd + B | Bold |
| Ctrl/Cmd + I | Italic |
| Ctrl/Cmd + U | Underline |
| Ctrl/Cmd + Shift + L | Align Left |
| Ctrl/Cmd + Shift + E | Align Center |
| Ctrl/Cmd + Shift + R | Align Right |
| Ctrl/Cmd + Shift + J | Justify |

---

## Razor / CSHTML Support

`FileTemplateEditor` fully preserves server-side Razor syntax through a round-trip extraction and restoration system. Content is never permanently modified — Razor blocks are hidden for the preview and restored on save.

### How It Works

When `loadCshtml()` is called, the editor:

1. Normalizes the DOCTYPE (deduplicates).
2. Parses and stores the full document structure: DOCTYPE, `<html>` attributes, `<head>`, pre/post body content.
3. Passes the body through `processRazorForPreview()`, which:
   - Extracts each Razor construct, stores it in an internal `Map` under a unique ID.
   - Replaces block-level constructs (code blocks, control structures) with HTML comments: `<!-- razor-block-0 -->`.
   - Replaces inline expressions with visible `<span class="razor-placeholder" data-razor-id="ID">` elements.

When `getCshtml()` is called, the editor:

1. Reads the iframe body HTML.
2. Restores all inline `<span class="razor-placeholder">` back to their original syntax using the stored Map.
3. Replaces all `<!-- razor-block-0 -->` comments with the original Razor blocks.
4. Reconstructs the full document: DOCTYPE + `<html>` + `<head>` + `<body>` + closing tags.

### Supported Razor Constructs

| Construct | Example | Handling |
|---|---|---|
| Comments | `@* this is a comment *@` | Stored in Map → HTML comment |
| Code blocks | `@{ var x = 5; }` | Stored in Map → HTML comment |
| Directives | `@model MyModel` | Wrapped directly as HTML comment |
| `@using` | `@using MyNamespace` | Wrapped directly as HTML comment |
| `@page` | `@page "/route"` | Wrapped directly as HTML comment |
| `@addTagHelper` | `@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers` | Wrapped directly as HTML comment |
| `@inject` | `@inject IService service` | Wrapped directly as HTML comment |
| `@foreach` | `@foreach (var item in list) { ... }` | Stored (start+end) → HTML comments |
| `@if` | `@if (condition) { ... }` | Stored (start+end) → HTML comments |
| `@for` | `@for (var i = 0; ...) { ... }` | Stored (start+end) → HTML comments |
| `@while` | `@while (condition) { ... }` | Stored (start+end) → HTML comments |
| `@switch` | `@switch (value) { ... }` | Stored (start+end) → HTML comments |
| `@section` | `@section Scripts { ... }` | Stored (start+end) → HTML comments |
| Inline expression | `@(expression)` | Stored in Map → `<span class="razor-placeholder">` |
| Model property | `@Model.Name` | Stored in Map → `<span class="razor-placeholder">` |
| ViewBag / ViewData | `@ViewBag.Title` / `@ViewData["key"]` | Stored in Map → `<span class="razor-placeholder">` |
| Html helper | `@Html.DisplayFor(m => m.Name)` | Stored in Map → `<span class="razor-placeholder">` |
| Variable | `@myVariable` | Stored in Map → `<span class="razor-placeholder">` |

> **Note:** Razor placeholders (inline expressions) appear visually in the editor as small gray badges. They are non-editable (`contenteditable="false"`). Pressing any key while the cursor is inside a placeholder does nothing.

### Document Structure Preservation

When loading a full CSHTML document, the editor extracts and stores:

| Part | Stored in | Restored by |
|---|---|---|
| `<!DOCTYPE html>` | `this.documentDoctype` | `reconstructFullDocument()` |
| `<html lang="...">` attributes | `this.documentAttributes` | `reconstructFullDocument()` |
| Full `<head>...</head>` | `this.documentHead` | `reconstructFullDocument()` |
| Content before `<body>` | `this.preBodyContent` | `reconstructFullDocument()` |
| Content after `</body>` | `this.postBodyContent` | `reconstructFullDocument()` |
| Content before `<html>` | `this.preHtmlContent` | `reconstructFullDocument()` |
| Content after `</html>` | `this.postHtmlContent` | `reconstructFullDocument()` |

---

## Image Handling

### Inserting Images

1. Click the image button in the toolbar.
2. Select a `.png`, `.jpg`, `.jpeg`, or `.svg` file.
3. The image is read as a base64 Data URL and inserted at the cursor position.

### Image Container Structure

Every image is wrapped in a container div:

```html
<div class="image-container" contenteditable="false">
  <img src="data:image/png;base64,..." style="width: 300px; height: 200px;" />
  <div class="resize-handle"></div>
</div>
```

The container is `contenteditable="false"` to prevent accidental text editing inside it.

### Selecting Images

- Click an image → the container gains `.selected`, showing a blue outline and revealing the resize handle.
- Click anywhere outside all image containers → deselects.
- Only one image can be selected at a time.

### Replacing Images

When an image is selected and you click the image button, the new image replaces the selected image's `src` while preserving its current width.

### Resizing Images

- Drag the resize handle (bottom-right blue square) to resize.
- Width is bounded: minimum 50px, maximum container width − 40px.
- Aspect ratio is maintained automatically.

### Base64 in Code View

In code mode, base64 image `src` values are truncated for readability:

```html
<!-- Code view shows: -->
<img src="data:image/png;base64,iVBORw0KGgo..." />

<!-- Internally stored as full base64: -->
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA..." />
```

When switching back to preview, the full base64 is restored from internal storage.

---

## Public API

### Content Methods

#### `loadCshtml(cshtml)` / `loadHTML(html)`

Loads a full CSHTML or HTML document string into the editor.

```js
editor.loadCshtml(`<!DOCTYPE html>
<html>
  <head><title>Invoice</title></head>
  <body>
    @model InvoiceViewModel
    <h1>@Model.Title</h1>
    @foreach (var item in Model.Items) {
      <p>@item.Name - @item.Price</p>
    }
  </body>
</html>`);
```

#### `getCshtml()` / `getHTML()`

Returns the full CSHTML document string with all Razor blocks restored.

```js
const cshtml = editor.getCshtml();
// Returns full <!DOCTYPE html>...<body>@model ... @foreach...</body></html>
```

#### `getFormattedCshtml()` / `getFormattedHTML()`

Returns the full CSHTML formatted with proper indentation.

```js
const formatted = editor.getFormattedCshtml();
```

#### `getPreviewHTML()`

Returns the raw iframe body HTML — including Razor placeholder `<span>` elements. Useful for diagnostics, not for saving.

```js
const previewHtml = editor.getPreviewHTML();
```

### Utility Methods

#### `clear()`

Clears all content from the editor and resets internal state.

```js
editor.clear();
```

#### `focus()`

Focuses the editor. In preview mode, focuses the iframe window. In code mode, focuses the textarea.

```js
editor.focus();
```

#### `destroy()`

Clears all content, removes the generated HTML from the container, and nullifies internal references. Call when removing the editor from the page.

```js
editor.destroy();
```

---

## CSS Classes Reference

### Editor Structure

| Class | Element | Description |
|---|---|---|
| `.file-template-editor` | `<div>` | Root wrapper for the entire component |
| `.file-template-toolbar` | `<div>` | Toolbar container |
| `.file-template-toolbar-group` | `<div>` | Group of related toolbar buttons |
| `.file-template-toolbar-separator` | `<div>` | Visual vertical divider between groups |
| `.file-template-mode-toggle` | `<div>` | Container for the preview/code toggle |
| `.file-template-editor-area` | `<div>` | Wrapper for iframe and textarea |
| `.file-template-iframe` | `<iframe>` | WYSIWYG editing surface |
| `.file-template-code-view` | `<textarea>` | Code editing surface |

### Toolbar Buttons

| Class | Element | Description |
|---|---|---|
| `.file-template-format-btn` | `<button>` | Bold, italic, underline, list, alignment buttons |
| `.file-template-image-btn` | `<button>` | Image insert/replace button |
| `.file-template-mode-btn` | `<button>` | Preview / Code toggle buttons |
| `.file-template-font-size` | `<select>` | Font size dropdown |
| `.file-template-image-input` | `<input[type=file]>` | Hidden file picker (programmatically triggered) |

### State Classes

| Class | Applied to | When |
|---|---|---|
| `.active` | `.file-template-format-btn` | Formatting command is active at cursor |
| `.active` | `.file-template-mode-btn` | This mode is currently selected |
| `.selected` | `.image-container` | Image is clicked/selected |

### Content Classes (inside iframe)

| Class | Element | Description |
|---|---|---|
| `.image-container` | `<div>` | Wrapper for every inserted image |
| `.resize-handle` | `<div>` | Drag handle for resizing images |
| `.razor-placeholder` | `<span>` | Visual badge for inline Razor expressions |

### Data Attributes

| Attribute | On | Value |
|---|---|---|
| `data-command` | Format/alignment buttons | `'bold'`, `'italic'`, `'justifyLeft'`, etc. |
| `data-mode` | Mode toggle buttons | `'preview'` or `'code'` |
| `data-tooltip` | All buttons | Tooltip string |
| `data-razor-id` | `.razor-placeholder` spans | Map key for restoring the original Razor syntax |
| `data-template-style` | Injected `<style>` / `<link>` | `'true'` — marks styles from template head for cleanup |

---

## FileTemplateEditor Usage Examples

### Basic initialization

```html
<div id="myEditor"></div>

<script type="module">
import FileTemplateEditor from 'https://cdn.voyadores.com/content/js/file-template-editor/file-template-editor.js';

const editor = new FileTemplateEditor('myEditor', { height: '500px' });
</script>
```

### Load a template from the server

```js
fetch('/api/templates/invoice')
  .then(r => r.text())
  .then(cshtml => editor.loadCshtml(cshtml));
```

### Save template content back to the server

```js
document.getElementById('saveBtn').addEventListener('click', () => {
  const cshtml = editor.getCshtml();

  fetch('/api/templates/invoice', {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: cshtml
  }).then(() => alert('Saved!'));
});
```

### Get formatted output before saving

```js
const formatted = editor.getFormattedCshtml();
console.log(formatted);
```

### Destroy the editor when navigating away

```js
window.addEventListener('beforeunload', () => editor.destroy());
// Or in a SPA:
router.on('navigate', () => editor.destroy());
```

### Embed in a Bootstrap modal

```html
<div class="modal fade" id="templateModal">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-body p-0">
        <div id="templateEditor" style="height: 600px;"></div>
      </div>
      <div class="modal-footer">
        <button id="saveTemplate" class="btn btn-primary">Save</button>
      </div>
    </div>
  </div>
</div>

<script type="module">
import FileTemplateEditor from '.../file-template-editor.js';

let editor;
const modal = document.getElementById('templateModal');

modal.addEventListener('shown.bs.modal', () => {
  editor = new FileTemplateEditor('templateEditor', { height: '560px' });
  fetch('/api/template').then(r => r.text()).then(html => editor.loadCshtml(html));
});

modal.addEventListener('hidden.bs.modal', () => {
  editor.destroy();
  editor = null;
});

document.getElementById('saveTemplate').addEventListener('click', () => {
  fetch('/api/template', {
    method: 'PUT',
    body: editor.getCshtml()
  });
});
</script>
```

---

## FileTemplateEditor Debugging

### Images are missing the resize handle after loading content



---

### Razor expressions are not showing as gray badges in preview



---

### `getCshtml()` returns HTML without Razor blocks



---

### Base64 images are truncated in the saved output



---

### Toolbar formatting buttons don't do anything



---

### Styles from the template head are not applied in preview



---

### Switching from code mode corrupts Razor syntax



---

---

# 2. JSONEditor

## Overview

`json-template-editor.js` exports three classes:

- **`JSONEditor`** (default) — a dual-panel editor: left side is a raw JSON `<textarea>`, right side is a live syntax-highlighted, formatted preview that updates on every keystroke.
- **`JSONFormatter`** (named) — static utility for formatting and validating JSON strings.
- **`JSONHighlighter`** (named) — static utility for wrapping JSON tokens in `<span>` tags for syntax highlighting.

---

## CDN Setup

```html
<script type="module">
// Import the full editor
import JSONEditor from 'https://cdn.voyadores.com/content/js/file-template-editor/json-template-editor.js';

// Or import utilities only
import { JSONFormatter, JSONHighlighter } from 'https://cdn.voyadores.com/content/js/file-template-editor/json-template-editor.js';
</script>
```

---

## Required HTML

Just a container element with a unique `id`:

```html
<div id="jsonEditorContainer"></div>
```

All internal HTML is generated by the class.

---

## Constructor & Options

```js
new JSONEditor(containerID, options)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `containerID` | `string` | Yes | `id` of the container element. Throws `Error` if not found. |
| `options` | `object` | No | Optional configuration. |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `height` | `string` | `'600px'` | CSS `min-height` of the editor container. |
| `placeholder` | `string` | `'Enter your JSON here...'` | Textarea placeholder text. |
| `showLineNumbers` | `boolean` | `false` | Reserved option — not implemented in current version. |
| `editorTitle` | `string` | `'JSON Editor'` | Title shown above the left (input) panel. |
| `previewTitle` | `string` | `'Formatted Preview'` | Title shown above the right (preview) panel. |

```js
const jsonEditor = new JSONEditor('jsonContainer', {
  height: '400px',
  editorTitle: 'Paste JSON',
  previewTitle: 'Preview'
});
```

---

## Public API

### `getJSON()`

Returns the parsed JavaScript object/array from the current editor content. Returns `null` if the content is empty or invalid JSON.

```js
const data = jsonEditor.getJSON();
// Returns: { name: "Test", items: [...] }  or null
```

### `setJSON(jsonData)`

Sets the editor content from a JavaScript object or array. Stringifies with 2-space indentation and updates the preview.

```js
jsonEditor.setJSON({ name: 'Invoice', items: [{ id: 1, price: 500 }] });
```

### `getValue()`

Returns the raw string currently in the textarea (unformatted, as typed).

```js
const raw = jsonEditor.getValue();
```

### `setValue(value)`

Sets the textarea to a raw string and updates the preview. No formatting or validation is applied.

```js
jsonEditor.setValue('{"name":"Test"}');
```

### `isValid()`

Returns `true` if the current textarea content is valid JSON, `false` otherwise.

```js
if (!jsonEditor.isValid()) {
  alert('Please fix the JSON errors before saving.');
}
```

### `getValidationError()`

Returns the JSON parse error message string if the current content is invalid, or `null` if valid.

```js
const error = jsonEditor.getValidationError();
if (error) console.error('JSON Error:', error);
```

### `clear()`

Clears the textarea and resets the preview to the empty state.

```js
jsonEditor.clear();
```

### `destroy()`

Removes all generated HTML from the container.

```js
jsonEditor.destroy();
```

---

## Utility Classes: JSONFormatter & JSONHighlighter

These are standalone static utilities that can be used independently without `JSONEditor`.

### `JSONFormatter`

#### `JSONFormatter.validate(jsonString)`

Validates a JSON string and returns a result object.

```js
const result = JSONFormatter.validate('{"name":"test"}');
// Returns: { isValid: true, data: { name: "test" }, error: null }

const result2 = JSONFormatter.validate('{"name":}');
// Returns: { isValid: false, data: null, error: "Unexpected token }" }
```

Handles edge case: if `jsonString` is a quoted JSON string (a JSON-encoded JSON string), it double-parses.

#### `JSONFormatter.format(jsonString, indent = 2)`

Formats a JSON string with the given indent width. Returns the formatted string. Throws `Error` if the JSON is invalid.

```js
const formatted = JSONFormatter.format('{"name":"test","items":[1,2,3]}', 4);
/*
{
    "name": "test",
    "items": [
        1,
        2,
        3
    ]
}
*/
```

### `JSONHighlighter`

#### `JSONHighlighter.highlight(text, theme = 'light')`

Wraps JSON tokens in `<span>` elements with semantic class names for CSS-based syntax highlighting. Escapes HTML before processing.

```js
const html = JSONHighlighter.highlight('{"active":true,"count":5}');
/*
{
  <span class="json-key">"active"</span><span class="json-punctuation">:</span><span class="json-boolean">true</span>
  ...
}
*/
```

Token class names:

| Class | Token type | Example |
|---|---|---|
| `.json-key` | Object key string | `"name"` |
| `.json-string` | Value string | `"hello"` |
| `.json-boolean` | `true` / `false` / `null` | `true` |
| `.json-number` | Numbers (int, float, scientific) | `3.14` |
| `.json-punctuation` | Structural chars + colons | `{`, `}`, `:`, `,` |

> The `theme` parameter is accepted but not used in the current implementation — the same spans are returned for both `'light'` and `'dark'`. Style the token classes in your own CSS to implement theming.

---

## CSS Classes Reference

### Editor Structure

| Class | Element | Description |
|---|---|---|
| `.json-editor-container` | `<div>` | Root flex container (two panels side by side) |
| `.json-editor-panel` | `<div>` | Individual panel (left = input, right = preview) |
| `.json-editor-panel-title` | `<div>` | Panel title bar |
| `.json-editor-content` | `<div>` | Wrapper for the textarea (left panel) |
| `.json-editor-textarea` | `<textarea>` | Raw JSON input |
| `.json-preview-content` | `<div>` | Preview output area (right panel) |

### Preview State Classes

| Class | Description |
|---|---|
| `.json-preview-empty` | Shown when textarea is empty |
| `.json-preview-error` | Shown when JSON is invalid — displays error message |

### Syntax Highlighting (applied to `<span>` elements in preview)

| Class | Token |
|---|---|
| `.json-key` | Object key |
| `.json-string` | String value |
| `.json-boolean` | `true` / `false` / `null` |
| `.json-number` | Numeric value |
| `.json-punctuation` | `{`, `}`, `[`, `]`, `:`, `,` |

---

## JSONEditor Usage Examples

### Basic

```html
<div id="jsonEditor"></div>

<script type="module">
import JSONEditor from 'https://cdn.voyadores.com/content/js/file-template-editor/json-template-editor.js';

const editor = new JSONEditor('jsonEditor', { height: '400px' });
</script>
```

### Pre-populate with data

```js
editor.setJSON({
  templateId: 'INVOICE-001',
  fields: ['name', 'address', 'amount'],
  active: true
});
```

### Validate before submitting a form

```js
document.getElementById('submitBtn').addEventListener('click', () => {
  if (!editor.isValid()) {
    alert(`Invalid JSON: ${editor.getValidationError()}`);
    return;
  }
  const data = editor.getJSON();
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
});
```

### Use JSONFormatter as a standalone utility

```js
import { JSONFormatter } from '.../json-template-editor.js';

const result = JSONFormatter.validate(userInput);
if (!result.isValid) {
  showError(result.error);
} else {
  const pretty = JSONFormatter.format(userInput, 4);
  codeBlock.textContent = pretty;
}
```

### Use JSONHighlighter for custom display

```js
import { JSONHighlighter, JSONFormatter } from '.../json-template-editor.js';

const raw = '{"name":"test","count":5,"active":false}';
const formatted = JSONFormatter.format(raw, 2);
const highlighted = JSONHighlighter.highlight(formatted);
document.getElementById('output').innerHTML = `<pre>${highlighted}</pre>`;
```

Apply your own CSS:

```css
.json-key        { color: #0550ae; }
.json-string     { color: #0a3069; }
.json-boolean    { color: #cf222e; }
.json-number     { color: #116329; }
.json-punctuation{ color: #6e7781; }
```

---

## JSONEditor Debugging

### Preview shows "Invalid JSON" immediately on load



---

### `getJSON()` returns `null` even though JSON looks valid



---

### Syntax highlighting doesn't apply colors



---

### `clear()` throws an error



```js
editor.setValue('');
```

---

### `JSONFormatter.format()` adds extra blank lines


