---
title: "Browser Detection"
version: "1.0.0"
files: "`content/js/application/application.detection.js` · `content/css/application/application.detection.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Detection module runs on every page load and performs two checks:

1. **Browser compatibility** — Detects the user's browser and version against a minimum supported list. Marks explicitly unsupported browsers (Opera, Samsung Browser, etc.) as incompatible regardless of version.
2. **Timezone compliance** — Checks whether the user's device is set to Philippine Time (UTC+8), which is the only supported timezone.

Based on the results, it:
- Sets two cookies (`timezone`, `timezoneDate`) used by the server for time-aware operations.
- Optionally prepends a **fixed warning banner** to `<body>` describing the detected issue.
- Adds a **CSS class** to `<body>` identifying the exact alert condition.
- Populates a **modal** (on mobile) with the full alert message when the user taps the info button.

---

## 2. Features

| Feature | Description |
|---|---|
| Browser name + version detection | Parses `navigator.userAgent` for 8 supported browser tokens |
| Explicit unsupported browser list | Immediately marks Opera, Samsung Browser, and others as incompatible |
| Timezone detection | Reads the device UTC offset and IANA timezone name |
| Cookie setting | Writes `timezone` and `timezoneDate` cookies on the app domain |
| Auto-refresh | `timezoneDate` cookie is refreshed every 60 seconds |
| Responsive alert banner | Desktop and mobile messages are rendered separately in the same banner |
| Outside-modal info button | Mobile users can tap `#btn-open-alert` to see the full alert in a Bootstrap modal |
| "See Supported Browsers" CTA | Shown on certain alerts; links to the Voyadores help docs |

---

## 3. Dependencies

| Library | Required | Description |
|---|---|---|
| jQuery | **Yes** | DOM ready wrapper, event binding, `body` prepend |
| Bootstrap 5 | **Yes** | `modal('show')` used for the mobile alert modal |

Both must be loaded before `application.detection.js`.

---

## 4. Setup

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/application/application.detection.css" />

<!-- Before closing </body>, after jQuery and Bootstrap -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/bootstrap/bootstrap.bundle.min.js"></script>
<script src="/js/application/application.detection.js"></script>
```

No configuration is required. The script runs automatically on `$(document).ready`. The stylesheet handles all layout offsets via CSS `:has()` selectors — no additional setup needed.

---

## 5. Supported Browsers

A browser is **supported** if it appears in the list below and its detected version meets the minimum.

| Browser token | Display name | Minimum version |
|---|---|---|
| `Chrome` | Google Chrome | 126 |
| `CriOS` | Chrome for iOS | 126 |
| `Safari` | Apple Safari | 16 |
| `Firefox` | Mozilla Firefox | 128 |
| `FxiOS` | Firefox for iOS | 128 |
| `Edge` | Microsoft Edge | 126 |
| `EdgA` | Edge for Android | 126 |
| `EdgiOS` | Edge for iOS | 126 |

Version comparison uses `>=` (greater than or equal to).

---

## 6. Unsupported Browsers

The following browsers are **always** treated as unsupported, regardless of version. Their presence in the user agent string causes the browser name to be set to `"Unsupported Browser"` with version `0`.

| User agent token | Browser |
|---|---|
| `OPR` | Opera (desktop) |
| `SamsungBrowser` | Samsung Internet |
| `OPiOS` | Opera for iOS |
| `OPX` | Opera X |
| `Presto` | Legacy Opera (Presto engine) |
| `OPT` | Opera Touch |

---

## 7. Timezone Detection

The script checks the UTC offset of the user's device:

```javascript
new Date().getTimezoneOffset()  // Returns offset in minutes
```

The **only supported offset** is `-480`, which corresponds to **Philippine Standard Time (UTC+8)**.

| Condition | Meaning |
|---|---|
| `getTimezoneOffset() === -480` | Supported (Philippine Time) |
| Any other value | Unsupported |

Three timezone-related values are also computed for cookie storage:

| Function | Returns | Example |
|---|---|---|
| `getTimezoneName()` | IANA timezone name | `"Asia/Manila"` |
| `getTimezoneNameUTC()` | IANA name + UTC offset string | `"Asia/Manila (UTC+8)"` |
| `getTimezoneDate()` | Current locale date/time string in the user's timezone | `"3/10/2026, 10:30:00 AM"` |

---

## 8. Alert Scenarios

The module evaluates four boolean flags:

| Flag | Meaning |
|---|---|
| `hasSupportedTimezone` | Device is on UTC+8 |
| `hasCompatibleBrowser` | Browser is in the supported list |
| `hasSupportedBrowserVersion` | Browser version meets the minimum |

These produce five possible alert states, checked in priority order:

| # | Condition | Message | Has CTA | Body class |
|---|---|---|---|---|
| 1 | Unsupported timezone **and** unsupported browser | Adjust timezone to Philippine time and switch to a supported browser | Yes | `unsupported-timezone-browser` |
| 2 | Unsupported timezone **and** outdated browser version | Adjust timezone to Philippine time and update to a supported browser version | Yes | `unsupported-timezone-browser-version` |
| 3 | Unsupported timezone only | Adjust time settings to the Philippine time zone | No | `unsupported-timezone` |
| 4 | Unsupported browser only | Switch to a Voyadores-supported browser | Yes | `unsupported-browser` |
| 5 | Outdated browser version only | Update to a supported browser version | Yes | `unsupported-browser-version` |
| 6 | All supported | _(No banner shown)_ | — | _(none)_ |

**Has CTA** — when `true`, a "See Supported Browsers" button is shown on desktop and in the modal that opens `https://help.voyadores.com/get-started/system-requirements#web-browser` in a new tab.

---

## 9. Alert Banner

When an alert condition is detected, the following HTML is **prepended to `<body>`**:

```html
<div id="dv-banner-alert" class="position-fixed top-0 left-0 bg-warning text-black p-5 w-100">
    <div class="d-flex flex-column flex-md-row justify-content-center align-items-center gap-5 h-100">

        <!-- Desktop message (hidden on mobile) -->
        <div id="dv-desktop-message" class="d-none d-lg-flex d-flex-row gap-4 align-items-center justify-content-start">
            <div class="mt-1 icon-container">
                <!-- SVG or <span> icon -->
            </div>
            <div class="hstack gap-8">
                <span id="spn-desktop-message">Full alert message here.</span>
                <!-- Optional CTA button -->
                <button class="btn-supported-browser btn border-black bg-black text-white flex-shrink-0 d-none d-lg-block">
                    See Supported Browsers
                </button>
            </div>
        </div>

        <!-- Mobile message (hidden on desktop) -->
        <div id="dv-mobile-message" class="d-flex d-flex-row gap-4 align-items-center justify-content-start d-lg-none">
            <div class="mt-1 align-self-start align-self-lg-center">
                <!-- SVG or <span> icon -->
            </div>
            <div>
                <span id="spn-mobile-message">First sentence of alert message only.</span>
                <button id="btn-open-alert" class="btn bg-transparent text-black p-1">
                    <span class="vi-regular vi-info-circle fs-4"></span>
                </button>
            </div>
        </div>

    </div>
</div>
```

### Message truncation on mobile

The mobile message (`#spn-mobile-message`) shows only the **first sentence** of the full alert text (split on `.`). The full message is accessible via the modal triggered by `#btn-open-alert`.

---

## 10. Alert Modal

On mobile, tapping the `#btn-open-alert` info button triggers a Bootstrap modal (`#dv-alert-modal`). The script populates the modal's inner elements:

| Element | Content |
|---|---|
| `#h3-alert-header` | First sentence of the alert message |
| `#p-alert-body` | Remaining sentences joined together |
| `#img-alert-image` | `alt` attribute set to the first sentence |
| `#btn-dismissible` | Text set to `"Okay"` (no CTA) or `"Cancel"` (with CTA) |
| `#btn-see-supported-browsers` | Shown or hidden depending on whether the alert has a CTA |

> The modal HTML must exist in the page. The script only populates it — it does not create the modal structure.

### Required modal HTML skeleton

```html
<div id="dv-alert-modal" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-body">
                <img id="img-alert-image" src="..." alt="" />
                <h3 id="h3-alert-header"></h3>
                <p id="p-alert-body"></p>
                <button id="btn-dismissible" data-bs-dismiss="modal"></button>
                <button id="btn-see-supported-browsers"></button>
            </div>
        </div>
    </div>
</div>
```

---

## 11. Timezone Cookies

Two cookies are written on every page load using `document.cookie`:

| Cookie name | Value | Refresh interval |
|---|---|---|
| `timezone` | IANA timezone + UTC offset, e.g. `Asia/Manila (UTC+8)` | Once on load |
| `timezoneDate` | Current locale date/time in the user's timezone, e.g. `3/10/2026, 10:30:00 AM` | Every 60 seconds |

### Cookie properties

| Property | Value |
|---|---|
| `expires` | 1 year from now |
| `path` | `/` |
| `domain` | Root domain (subdomain stripped — see `getAppDomain()`) |
| Encoding | Value is `encodeURIComponent`-encoded |

### `getAppDomain()`

Strips the subdomain from `window.location.hostname` and returns the root domain.

| Hostname | Returns |
|---|---|
| `app.voyadores.com` | `voyadores.com` |
| `voyadores.com` | `voyadores.com` |
| `localhost` | `localhost` |

---

## 12. Required DOM Elements

| Element | When needed | Description |
|---|---|---|
| `<body>` | Always | Banner is prepended here; alert CSS class is added here |
| `#dv-alert-modal` | Mobile alert tap | Bootstrap modal container |
| `#h3-alert-header` | Mobile alert tap | Modal heading |
| `#p-alert-body` | Mobile alert tap | Modal body text |
| `#img-alert-image` | Mobile alert tap | Modal image (`alt` is set) |
| `#btn-dismissible` | Mobile alert tap | Modal dismiss button |
| `#btn-see-supported-browsers` | Mobile alert tap | Modal CTA button (shown/hidden) |

---

## 13. Body CSS Classes

One of the following classes is added to `<body>` when an alert is active. No class is added when everything is supported.

| Class | Condition |
|---|---|
| `unsupported-timezone-browser` | Unsupported timezone and unsupported browser |
| `unsupported-timezone-browser-version` | Unsupported timezone and outdated browser version |
| `unsupported-timezone` | Unsupported timezone only |
| `unsupported-browser` | Unsupported browser only |
| `unsupported-browser-version` | Outdated browser version only |

Use these classes in CSS to adjust page layout (e.g. offset `padding-top` to account for the fixed banner). The companion stylesheet `application.detection.css` handles all layout offsets automatically — see [CSS Layout](#14-css-layout).

---

## 14. CSS Layout

`application.detection.css` handles all layout adjustments needed when the alert banner is visible. It uses a CSS custom property and `:has()` selectors so no JavaScript class toggling is required for layout.

### CSS custom property

```css
:root {
    --detector-banner-height: 0px;
}
```

This property is set automatically when `#dv-banner-alert` is present in the DOM:

| Breakpoint | Value |
|---|---|
| Mobile (< 1024px) | `68px` |
| Desktop (≥ 1024px) | `72px` |
| Desktop + Window Controls Overlay | `122px` |

Use `--detector-banner-height` anywhere in your own CSS when you need to offset an element relative to the banner.

### Banner dimensions

| Breakpoint | Height | Additional |
|---|---|---|
| Mobile (< 1024px) | `68px` | — |
| Desktop (≥ 1024px) | `72px` | — |
| Window Controls Overlay | `122px` | `padding-top: 50px` |

The banner always has `z-index: 1030`.

### Navbar offset

When `#dv-banner-alert` is present, the direct-child `.navbar` of `<body>` is pushed down:

| Breakpoint | `top` | Notes |
|---|---|---|
| Mobile (< 1024px) | `68px` | — |
| Desktop (≥ 1024px) | `72px` | — |
| Window Controls Overlay + Desktop | `122px` | Also resets `height: 56px`, `padding-top: 0` |
| Window Controls Overlay + Mobile | `122px` | Also resets `height: 64px`, `padding-top: 0` |

### Nav sheet offset

When `#dv-banner-alert` is present, the direct-child `.nav-sheet` of `<body>` is offset:

| Breakpoint | `top` |
|---|---|
| Desktop (≥ 1024px) | `128px` (banner 72 + navbar 56) |
| Window Controls Overlay + Desktop | `178px` (banner 122 + navbar 56) |

### Header / main offset

`margin-top` is applied to direct-child `header`, `#main-home-start`, and `#main-home-user` of `<body>`:

| Breakpoint | `margin-top` |
|---|---|
| Mobile (< 1024px) | `132px` (banner 68 + navbar 64) |
| Desktop (≥ 1024px) | `128px` (banner 72 + navbar 56) |
| Window Controls Overlay + Mobile | `186px` |
| Window Controls Overlay + Desktop | `178px` |

Special overrides under Window Controls Overlay + Desktop:

| Selector | Override |
|---|---|
| `#main-home-user > div.mt-9` | `margin-top: 0` |
| `#art-self-help-card` | `top: 226px` (178 + 24 margin + 24 padding) |

### Icon alignment overrides

For multi-line banner messages the icon in `.icon-container` switches from `align-self: start` (top-aligned) to `align-self: center` at the breakpoint where the message fits on one line:

| Icon class | `start` below | `center` at |
|---|---|---|
| `.icon-browser-version` | 1024px | 1179px |
| `.icon-timezone-browser` | 1024px | 1392px |
| `.icon-timezone-browser-version` | 1024px | 1504px |

---

## 15. Internal Functions

All functions are private to the jQuery ready block.

| Function | Returns | Description |
|---|---|---|
| `getBrowserDetails()` | `{ browserName, browserVersion }` | Parses `navigator.userAgent` to detect browser name and version (float). |
| `getBrowserCompatibility()` | `{ hasCompatibleBrowser, hasSupportedBrowserVersion }` | Checks the detected browser against the minimum supported list. |
| `getTimezone()` | `number` | Returns `new Date().getTimezoneOffset()` (e.g. `-480` for UTC+8). |
| `getTimezoneName()` | `string` | Returns IANA timezone name via `Intl.DateTimeFormat`. |
| `getTimezoneNameUTC()` | `string` | Returns IANA timezone name with UTC offset, e.g. `"Asia/Manila (UTC+8)"`. |
| `getTimezoneDate()` | `string` | Returns the current locale date/time string in the user's timezone. |
| `getAppDomain()` | `string` | Strips the subdomain from `window.location.hostname`. |
| `setCookie(name, value)` | `void` | Writes a cookie with a 1-year expiry on the root domain. |
| `buildAlertDetails()` | `{ message, icon, hasCta, cssClass }` | Evaluates compatibility flags and returns the appropriate alert payload. |
| `buildAlertBanner(message, icon, hasCTA)` | `string` | Returns the HTML string for the fixed banner. |
| `buildAlertModalContent(message, icon, hasCTA)` | `void` | Populates the modal DOM elements with the alert content. |

---

## 16. Full Example

### Minimal page with all required elements

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/css/bootstrap/bootstrap.voyadores.theme.min.css" />
    <link rel="stylesheet" href="/css/application/application.detection.css" />
</head>
<body>

    <!-- Page content -->
    <main>...</main>

    <!-- Alert modal (required for mobile) -->
    <div id="dv-alert-modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body text-center p-5">
                    <img id="img-alert-image" src="" alt="" class="mb-4" />
                    <h3 id="h3-alert-header" class="mb-3"></h3>
                    <p id="p-alert-body" class="mb-4"></p>
                    <div class="d-flex gap-3 justify-content-center">
                        <button id="btn-dismissible" class="btn btn-outline-secondary" data-bs-dismiss="modal"></button>
                        <button id="btn-see-supported-browsers" class="btn btn-primary d-none">
                            See Supported Browsers
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="/js/jquery/jquery.min.js"></script>
    <script src="/js/bootstrap/bootstrap.bundle.min.js"></script>
    <script src="/js/application/application.detection.js"></script>

</body>
</html>
```

The stylesheet automatically handles all layout offsets. No additional CSS is needed — `application.detection.css` pushes the navbar, nav sheet, and page headers down by the exact banner height using `:has(#dv-banner-alert)` selectors.

### Using `--detector-banner-height` in custom CSS

If you have additional elements that need to account for the banner height, use the CSS custom property:

```css
/* Example: offset a custom sticky element below the banner */
.my-sticky-element {
    top: calc(var(--detector-banner-height) + 56px); /* banner + navbar */
}
```
