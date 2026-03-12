---
title: "Visual Indicator"
version: "1.0.0"
files: "`visual-indicator.js` · `visual-indicator.css` · `application.visual-indicator.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Visual Indicator system appends small **NEW**, **BETA**, or **dot badge** labels onto existing DOM elements — typically navigation items — to surface feature announcements or status markers to the user.

It consists of three files:

| File | Role |
|---|---|
| `visual-indicator.js` | `Indicator` class — creates and injects indicator elements |
| `visual-indicator.css` | Default styles for all indicator types and menu contexts |
| `application.visual-indicator.js` | App-level loader — fetches indicator config from an API with localStorage caching |

---

## 2. Features

| Feature | Description |
|---|---|
| Three indicator types | `new`, `beta`, and `badge` (dot) |
| Six positions | Absolute positioning presets (top/bottom × left/center/right) |
| Per-element URL filtering | Indicators only render on matching page URLs |
| Duplicate guard | Will not append a second indicator to an element that already has one |
| Mobile menu support | Appends to `.nav-sub-icon` when the target is a `.nav-mobile-menu-page` item |
| `position-relative` automation | Automatically adds `position-relative` to target elements that use positioned indicators |
| API-driven config | Indicator definitions fetched from a JSON endpoint |
| LocalStorage caching | API response cached for 3 days to reduce network requests |

---

## 3. Dependencies

| Library | Version | Required |
|---|---|---|
| jQuery | 3.x recommended | **Yes** (used in `appendToTarget`, `setRelativePosition`) |

jQuery must be available on `window.jQuery` before `visual-indicator.js` is used.

---

## 4. Setup

### 1. Include files

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/visual-indicator/visual-indicator.css" />

<!-- Before closing </body>, after jQuery -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/visual-indicator/visual-indicator.js"></script>
```

### 2. Instantiate manually (static config)

```javascript
const indicator = new Indicator({
    name: 'my-indicators',
    features: [
        {
            elements: [
                {
                    selector: '#nav-reports',
                    type: 'new',
                    position: 'top-right'
                }
            ]
        }
    ]
});
```

### 3. Use the application loader (API-driven)

Import and call `loadIndicators()` in your app entry point:

```javascript
import loadIndicators from '/js/application/application.visual-indicator.js';

loadIndicators();
```

See [Application Loader](#9-application-loader) for the expected API response shape.

---

## 5. Indicator Types

| Type | Rendered text | CSS class | Description |
|---|---|---|---|
| `new` | `NEW` | `.visual-indicator-new` | Pill label styled with the primary color, used to announce new features. |
| `beta` | `BETA` | `.visual-indicator-beta` | Same pill style as `new`, used for beta/preview features. |
| `badge` | _(empty)_ | `.visual-indicator-badge` | Small filled circle dot, typically red, used for notification-style indicators. |

Type matching is **case-insensitive** (`"New"`, `"NEW"`, `"new"` all work).

---

## 6. Positions

Six absolute-position presets are available. The `badge` type uses slightly different inset values to sit inside the target element rather than overlapping the edge.

| Value | Description |
|---|---|
| `top-center` | Centered above the element |
| `top-right` | Top right corner |
| `top-left` | Top left corner |
| `bottom-center` | Centered below the element |
| `bottom-right` | Bottom right corner |
| `bottom-left` | Bottom left corner |

When a position is specified, `position-relative` is automatically added to the target element via jQuery.

> If `position` is omitted or invalid, no inline position style is applied — the indicator renders inline in document flow.

---

## 7. Configuration Structure

The `features` array passed to the constructor (or returned by the API) has the following shape:

```javascript
{
    features: [
        {
            elements: [
                {
                    selector: string,       // Required. jQuery-compatible CSS selector.
                    type: string,           // Required. "new" | "beta" | "badge"
                    position: string,       // Optional. One of the six position presets.
                    customClass: string,    // Optional. Extra CSS class(es) on the <span>.
                    url: string             // Optional. Only render on this pathname.
                }
            ]
        }
    ]
}
```

### Element properties

| Property | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | **Yes** | jQuery selector targeting the element(s) to attach the indicator to. |
| `type` | `string` | **Yes** | Indicator type: `"new"`, `"beta"`, or `"badge"`. |
| `position` | `string` | No | Position preset. See [Positions](#6-positions). |
| `customClass` | `string` | No | Additional CSS class(es) appended to the indicator `<span>`. |
| `url` | `string` | No | Pathname (e.g. `"/dashboard"`) that the current page must match for the indicator to render. Trailing slashes are ignored. |

---

## 8. Indicator Class API

### Constructor

```javascript
const indicator = new Indicator(options);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `undefined` | Identifier for this indicator instance (informational). |
| `features` | `Array` | `[]` | Array of feature objects. Indicators are rendered immediately on construction if this is non-empty. |

Calling the constructor automatically calls `init()`, which calls `render(features)` if features are provided.

---

### `render(features)`

Iterates all features and their elements and appends indicators to matching DOM targets. Applies URL filtering — elements with a `url` property are skipped unless the current `window.location.pathname` matches.

```javascript
indicator.render(features);
```

---

### `createElement({ type, position, customClass })`

Creates and returns a `<span>` DOM element for an indicator. Returns `null` if `type` is missing or invalid.

```javascript
const el = indicator.createElement({ type: 'new', position: 'top-right', customClass: 'ms-2' });
```

The returned `<span>` has:
- `className`: `visual-indicator visual-indicator-{type} {customClass}`
- `style.cssText`: Inline position style from the position preset.
- `textContent`: `"NEW"` / `"BETA"` for label types; empty string for `badge`.

---

### `appendToTarget(selector, element)`

Appends a clone of `element` to every DOM element matched by `selector`. Skips elements that already contain a `.visual-indicator` child. Returns `true` if at least one element was appended, `false` otherwise.

---

### `setRelativePosition(selector, position)`

Adds `position-relative` class to matched elements when `position` is a valid preset.

---

### `validateType(type)`

Returns `true` if `type` is one of `"new"`, `"beta"`, `"badge"`. Logs a warning and returns `false` otherwise.

---

### `validatePosition(position)`

Returns `true` if `position` matches a known preset key. Does not log a warning — used as a silent boolean check.

---

### `getCurrentUrl()`

Returns `window.location.pathname` with trailing slashes stripped.

---

## 9. Application Loader

`application.visual-indicator.js` exports a default `loadIndicators()` function that wires up the `Indicator` class to a backend API with a localStorage cache.

### How it works

1. Reads the `"visualIndicators"` key from `localStorage`.
2. If a cached entry exists and is **less than 3 days old**, calls `indicator.render(cached.features)` immediately and returns.
3. Otherwise, fetches from `/home/user/get-visual-indicators` using `$.getJSON`.
4. On success, stores the response as `{ time: Date.now(), value: data }` in `localStorage`, then calls `indicator.render(data.features)`.
5. On fetch failure or parse error, logs an error and renders nothing.

### Cache format

```json
{
    "time": 1741564800000,
    "value": {
        "features": [...]
    }
}
```

### Expected API response

```json
{
    "features": [
        {
            "elements": [
                {
                    "selector": "#nav-reports",
                    "type": "new",
                    "position": "top-right",
                    "url": "/dashboard"
                }
            ]
        }
    ]
}
```

### Cache expiry

| Setting | Value |
|---|---|
| Cache key | `"visualIndicators"` |
| Max age | 3 days (259,200,000 ms) |

If `localStorage` throws (e.g. in private mode or when storage is full), the cached entry is silently removed and the API is fetched fresh.

---

## 10. URL Filtering

When an element config includes a `url` property, the indicator is only rendered if the current page pathname matches — trailing slashes on both sides are stripped before comparison.

```javascript
// Only renders this indicator on /reports
{
    selector: '#nav-reports',
    type: 'new',
    position: 'top-right',
    url: '/reports'
}
```

Elements without a `url` property render on **every page**.

---

## 11. Mobile Menu Behavior

When the target element matched by `selector` has the class `nav-mobile-menu-page`, the indicator is appended inside `.nav-sub-icon` (if present) rather than directly on the target element.

This prevents the indicator from overflowing the mobile nav layout.

If `.nav-sub-icon` is not found inside a `.nav-mobile-menu-page` target, the standard append falls through and attaches directly to the element.

---

## 12. CSS Classes Reference

### Indicator elements

| Class | Element | Description |
|---|---|---|
| `.visual-indicator` | `<span>` | Base class on all indicator elements. |
| `.visual-indicator-new` | `<span>` | "NEW" pill label. |
| `.visual-indicator-beta` | `<span>` | "BETA" pill label. |
| `.visual-indicator-badge` | `<span>` | Dot badge (12×12px filled circle). |

### Context classes (applied by CSS selectors, not JS)

| Selector context | Behavior |
|---|---|
| `#module-menu .nav-item .visual-indicator` | Hidden by default; revealed via `:has()` selectors when a child module menu contains an active indicator. |
| `.nav-mobile-menu-page .visual-indicator` | Overrides position to `inset: -12px -16px auto auto` with danger color. |
| `.nav-desktop-menu-page .visual-indicator` | Resets to `position: static`. |
| `.nav-desktop-menu-page .visual-indicator-badge` | Reduced to 8×8px. |

---

## 13. CSS Customization

### Default badge styles

```css
.visual-indicator-badge {
    display: inline-block;
    background-color: var(--vds-danger);
    border-radius: 50%;
    block-size: 12px;
    inline-size: 12px;
}
```

### Default NEW / BETA styles

```css
.visual-indicator-new,
.visual-indicator-beta {
    background-color: var(--vds-primary-bg-subtle);
    color: var(--vds-primary-text-emphasis);
    display: inline-block !important;
    height: 20px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    padding: 5px 6px !important;
    border-radius: var(--vds-border-radius) !important;
    font-family: 'Lexend', sans-serif !important;
}
```

Override either block in your own stylesheet to change color, size, or typography. CSS custom properties (`--vds-danger`, `--vds-primary-bg-subtle`, etc.) are defined in the Voyadores Bootstrap theme.

---

## 14. Console Messages

| Level | Message |
|---|---|
| `warn` | `Indicator: {name} is required` — missing `type` or `selector` on an element config |
| `warn` | `Indicator: Invalid type "{type}". Allowed types: new, beta, badge` |
| `warn` | `Indicator: Target elements not found for selector: {selector}` |
| `warn` | `Indicator: Feature elements must be an array` |
| `warn` | `Indicator: Features must be an array` |
| `error` | `[Visual Indicator] Failed to parse response` — API returned unparseable JSON |
| `error` | `[Visual Indicator] Failed to load Visual Indicators JSON.` — network request failed |

---

## 15. Full Example

### Static usage

```html
<nav>
    <a id="nav-reports" class="nav-link position-relative">Reports</a>
    <a id="nav-payroll" class="nav-link position-relative">Payroll</a>
</nav>

<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/visual-indicator/visual-indicator.js"></script>
<script>
    const indicator = new Indicator({
        name: 'feature-launch',
        features: [
            {
                elements: [
                    {
                        selector: '#nav-reports',
                        type: 'new',
                        position: 'top-right'
                    },
                    {
                        selector: '#nav-payroll',
                        type: 'beta',
                        position: 'top-right',
                        url: '/dashboard'   // Only shown on /dashboard
                    }
                ]
            }
        ]
    });
</script>
```

### API-driven usage

```javascript
// application.js (ES module entry point)
import loadIndicators from '/js/application/application.visual-indicator.js';

$(document).ready(function () {
    loadIndicators();
});
```

Expected response from `/home/user/get-visual-indicators`:

```json
{
    "features": [
        {
            "elements": [
                {
                    "selector": "#nav-reports",
                    "type": "new",
                    "position": "top-right"
                },
                {
                    "selector": "#nav-payroll",
                    "type": "badge",
                    "position": "top-right",
                    "url": "/dashboard"
                }
            ]
        }
    ]
}
```

### Manually calling `render` after initialization

```javascript
const indicator = new Indicator(); // No features passed — nothing renders yet

// Later, after fetching your own config:
indicator.render(myConfig.features);
```
