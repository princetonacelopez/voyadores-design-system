---
title: "Theme Picker"
version: "1.0.0"
files: "`content/js/application/application.theme.picker.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

`ApplicationThemePicker` is an ES module class that manages the application's visual theme (Light, Dark, or System). It reads and persists the user's theme preference as a cookie, resolves the system-level `prefers-color-scheme` media query for the System option, and updates the browser's `<meta name="theme-color">` on load.

An instance is created and the meta color is applied automatically when the module is imported.

---

## 2. Features

| Feature | Description |
|---|---|
| Four theme values | Light, Dark, System Light, System Dark encoded as numeric strings |
| Cookie persistence | Theme stored in a `theme` cookie with a 1-year expiry on the root domain |
| System theme resolution | Reads `prefers-color-scheme` media query to distinguish system light from system dark |
| Meta theme-color update | Updates `<meta name="theme-color">` to match the active theme on load |
| Auto-init | Module-level initialization applies the meta color without any manual call |

---

## 3. Dependencies

| Library | Required | Description |
|---|---|---|
| jQuery | **Yes** | Used by `changeThemeColor` to query `$('meta[name="theme-color"]')` |

---

## 4. Setup

```html
<!-- In <head> — must exist before the module runs -->
<meta name="theme-color" content="#F5F5F5" />

<!-- As an ES module -->
<script type="module" src="/js/application/application.theme.picker.js"></script>
```

The module creates `themePickerViewModel` and calls `changeThemeColor` automatically on import. To use the instance in other modules, import and re-instantiate:

```javascript
import ApplicationThemePicker from '/js/application/application.theme.picker.js';

const themePicker = new ApplicationThemePicker();
```

> The auto-initialized `themePickerViewModel` is module-scoped and not exported. Create a new instance if you need programmatic access elsewhere.

---

## 5. Theme Constants

Theme values are numeric strings stored in `this.THEMES`. The comments in source describe them as 3-bit flags:

| Constant | Value | Bit pattern | Meaning |
|---|---|---|---|
| `THEMES.Light` | `'0'` | `000` | Explicit light mode |
| `THEMES.Dark` | `'1'` | `001` | Explicit dark mode |
| `THEMES.SystemLight` | `'4'` | `100` | System preference resolved to light |
| `THEMES.SystemDark` | `'6'` | `110` | System preference resolved to dark |

These values are written to and read from the `theme` cookie.

---

## 6. Auto-Initialization

At the bottom of the module, outside the class, the following runs on every import:

```javascript
const themePickerViewModel = new ApplicationThemePicker();
const theme = themePickerViewModel.getCurrentTheme();
themePickerViewModel.changeThemeColor(theme.value);
```

This ensures the `<meta name="theme-color">` content reflects the saved preference immediately when the page loads, before any user interaction.

---

## 7. Public Methods

### `loadTheme()`

Reads the saved theme cookie and writes it back (re-affirming the cookie expiry). Falls back to `THEMES.Light` (`'0'`) if no cookie exists.

```javascript
themePicker.loadTheme();
```

> The `location.reload()` call is commented out in source. Callers are responsible for triggering any re-render needed after calling this method.

---

### `getCurrentTheme()`

Returns the current theme as a `{ label, value }` object.

```javascript
const theme = themePicker.getCurrentTheme();
// → { label: 'light', value: '0' }
// → { label: 'dark',  value: '1' }
// → { label: 'system', value: '4' }  (or '6')
```

| Return key | Type | Possible values |
|---|---|---|
| `label` | `string` | `'light'` · `'dark'` · `'system'` |
| `value` | `string` | `'0'` · `'1'` · `'4'` · `'6'` |


| Saved cookie value | `label` returned |
|---|---|
| `'0'` (Light) | `'light'` |
| `'1'` (Dark) | `'dark'` |
| `'4'` (SystemLight) | `'system'` |
| `'6'` (SystemDark) | `'system'` |
| _(no cookie)_ | `'light'` (default) |

---

### `setTheme(theme)`

Accepts a human-readable theme string, resolves it to the corresponding constant, and writes the cookie.

```javascript
themePicker.setTheme('dark');    // writes '1'
themePicker.setTheme('light');   // writes '0'
themePicker.setTheme('system');  // writes '4' or '6' based on system preference
```

| Parameter | Type | Accepted values |
|---|---|---|
| `theme` | `string` | `'light'` · `'dark'` · `'system'` |

Any unrecognized string falls back to `THEMES.Light` (`'0'`).

When `'system'` is passed, `getCurrentSystemTheme()` is called to resolve the current OS preference to `SystemLight` (`'4'`) or `SystemDark` (`'6'`).

---

### `getCurrentSystemTheme()`

Reads the OS-level color scheme preference via the `prefers-color-scheme` CSS media query.

```javascript
const systemTheme = themePicker.getCurrentSystemTheme();
// → '4'  (SystemLight, when OS is light)
// → '6'  (SystemDark, when OS is dark)
```


| OS preference | Returns |
|---|---|
| Dark (`prefers-color-scheme: dark`) | `'6'` (SystemDark) |
| Light or no preference | `'4'` (SystemLight) |

---

### `changeThemeColor(theme)`

Updates the `content` attribute of `<meta name="theme-color">` to match the given theme.

```javascript
themePicker.changeThemeColor('1');       // → #272727  (dark)
themePicker.changeThemeColor('6');       // → #272727  (system dark)
themePicker.changeThemeColor('dark');    // → #272727  (string also accepted)
themePicker.changeThemeColor('0');       // → #F5F5F5  (light)
```

| Condition | `content` value |
|---|---|
| `theme === '1'` (Dark) | `#272727` |
| `theme === '6'` (SystemDark) | `#272727` |
| `theme === 'dark'` (string) | `#272727` |
| All other values | `#F5F5F5` |

Accepts both numeric string constants (`'1'`, `'6'`) and the human-readable `'dark'` string.

---

## 8. Private Methods

| Method | Returns | Description |
|---|---|---|
| `#getTheme(theme)` | `string` | Maps `'light'`/`'dark'`/`'system'` to the numeric theme constant. Calls `getCurrentSystemTheme()` for `'system'`. Falls back to `THEMES.Light`. |
| `#getPreferredTheme()` | `string` | Reads the `theme` cookie from `document.cookie`. Returns empty string if not found. |
| `#setCookie(theme)` | `void` | Writes `theme={value}` cookie with 1-year expiry, `path=/`, on the root domain. |
| `#getAppDomain()` | `string` | Strips subdomain from `window.location.hostname`. Returns root domain (e.g. `"voyadores.com"`). |

---

## 9. Theme Cookie

| Property | Value |
|---|---|
| Name | `theme` |
| Value | Numeric string: `'0'`, `'1'`, `'4'`, or `'6'` |
| Expires | 1 year from time of write |
| Path | `/` |
| Domain | Root domain (subdomain stripped — see `#getAppDomain()`) |

The cookie is read on every call to `getCurrentTheme()`, `loadTheme()`, or any method that calls `#getPreferredTheme()`. There is no in-memory cache — each read parses `document.cookie` directly.

---

## 10. Required DOM Elements

| Element | Required | Description |
|---|---|---|
| `<meta name="theme-color">` | **Yes** | Updated by `changeThemeColor()`. Must exist before the module loads. |

---

## 11. Full Example

### Basic page setup

```html
<html>
<head>
    <meta name="theme-color" content="#F5F5F5" />
    <link rel="stylesheet" href="/css/bootstrap/bootstrap.voyadores.theme.min.css" />
</head>
<body>
    <script src="/js/jquery/jquery.min.js"></script>
    <script type="module" src="/js/application/application.theme.picker.js"></script>
</body>
</html>
```

The meta color is updated automatically on import. No further code is needed for the initial load.

### Changing the theme from a settings menu

```javascript
import ApplicationThemePicker from '/js/application/application.theme.picker.js';

const themePicker = new ApplicationThemePicker();

document.getElementById('btn-theme-light').addEventListener('click', () => {
    themePicker.setTheme('light');
    themePicker.changeThemeColor('0');
    location.reload(); // re-apply server-rendered theme
});

document.getElementById('btn-theme-dark').addEventListener('click', () => {
    themePicker.setTheme('dark');
    themePicker.changeThemeColor('1');
    location.reload();
});

document.getElementById('btn-theme-system').addEventListener('click', () => {
    themePicker.setTheme('system');
    const systemValue = themePicker.getCurrentSystemTheme();
    themePicker.changeThemeColor(systemValue);
    location.reload();
});
```

### Reading the current theme

```javascript
const themePicker = new ApplicationThemePicker();
const { label, value } = themePicker.getCurrentTheme();

console.log(label);   // → "dark"
console.log(value);   // → "1"

// Applying theme class to <html> element
document.documentElement.setAttribute('data-bs-theme', label === 'system' ? 'light' : label);
```

### Checking system preference

```javascript
const themePicker = new ApplicationThemePicker();
const systemTheme = themePicker.getCurrentSystemTheme();

if (systemTheme === themePicker.THEMES.SystemDark) {
    console.log('OS is using dark mode');
}
```
