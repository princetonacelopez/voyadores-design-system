---
title: "Menu Web"
version: "1.0.0"
files: "`content/js/application/application.menu.web.js` · `content/css/application/application.menu.web.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Web Menu module is the main application shell controller. It runs on every page load and is responsible for:

- Rendering the navbar module icons and per-module nav sheet dropdowns from a server-supplied menu data set.
- Loading the current user's account info, profile picture, and name into the navbar.
- Managing theme selection and persisting it as a cookie.
- Hiding/showing the navbar on scroll (mobile).
- Coordinating the loading overlay that keeps content hidden until everything is ready.
- Broadcasting logout events to other tabs.
- Applying scroll indicator state for the mobile carousel menu.

The companion CSS file controls all navigation layout, dialog animations, notification styles, and a wide set of utility overrides used throughout the application.

---

## 2. Features

| Feature | Description |
|---|---|
| Dynamic menu rendering | Modules and pages fetched from API, rendered as navbar icons + nav sheet dialogs |
| Responsive layout | Mobile bottom-sheet dialogs with carousel; desktop hover-triggered dropdowns |
| Profile & avatar | User's name, roles, initials, and profile picture loaded from API |
| Company logo | Loaded from CDN; replaced with account-specific logo if available |
| Theme management | Radio-based theme switcher (light / dark / system) with cookie persistence |
| Navbar scroll hide | Navbar fades out on mobile when scrolling down past threshold |
| Scroll indicators | IntersectionObserver syncs dot indicators with the active mobile carousel slide |
| Loading overlay | Shown during init; hidden only after all async setup completes |
| Logout broadcast | `BroadcastChannel("user-session-channel")` notifies other tabs on logout |
| Storage clear | `localStorage` and `sessionStorage` cleared on logout |
| Page transitions | CSS `@view-transition` enables browser-native page transitions |
| PWA support | Extra padding for fullscreen and window-controls-overlay display modes |

---

## 3. Dependencies

| Library / Import | Required | Description |
|---|---|---|
| jQuery | **Yes** | DOM queries, events, `.on`, `.off`, `.toggleClass`, `$(document).ready` |
| `ApplicationHomeUserViewModel` | **Yes** | Fetches account info and menu items |
| `ApplicationThemePicker` | **Yes** | Reads/writes theme cookie |
| `loadIndicators` | **Yes** | Visual indicator system (imported from `application.visual-indicator.js`) |
| `globalRequest` | **Yes** | HTTP client passed to the ViewModel |

---

## 4. Setup

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/application/application.menu.web.css" />
<meta name="theme-color" content="#F5F5F5" />

<!-- CDN base URL for images -->
<input type="hidden" id="voyadores-cdn-url" value="https://cdn.voyadores.com" />

<!-- Before closing </body> -->
<script src="/js/jquery/jquery.min.js"></script>
<script type="module" src="/js/application/application.menu.web.js"></script>
```

The module calls `initialize()` on `$(document).ready` automatically.

---

## 5. Initialization Sequence

`initialize()` runs the following steps in order:

```
1. Show #loading-overlay
2. initializeAccountInfo()
   ├── getCurrentUser()       (validates current user identity)
   ├── getAccount()           (fetches name, roles, profile picture)
   ├── loadCompanyLogo()      (CDN logo → account logo override)
   ├── setupUserAvatar()
   ├── setupUserInfo()
   ├── setupThemeSelector()
   └── setupThemeChangeHandler()
3. renderNavigation()
   ├── getProcessedMenu()     (API fetch + processMenuData)
   ├── renderModules()        → inject into #module-menu
   ├── renderSubmodules()     → inject <dialog> nav sheets after <nav>
   └── renderMobileNavigation()  (if viewport < 1024px)
4. loadIndicators()
5. setScrollIndicatorState()
6. setupFileViewerModal()
7. setupEventHandlers()
8. cleanupWhitespace()
9. isContentLoaded = true    (on root URL only)
10. Hide #loading-overlay
11. Set nav, header, main, footer → visibility: visible
```

Pages are hidden via `visibility: hidden` in CSS until step 11 completes, preventing a flash of unstyled content.

---

## 6. Constants & Configuration

| Constant | Value | Description |
|---|---|---|
| `VIEWPORT_BREAKPOINT` | `1024` | Pixel threshold between mobile and desktop layout |
| `NAVBAR_HIDE_THRESHOLD` | `32` | Minimum scroll position before navbar auto-hide activates |
| `SCROLL_DEBOUNCE_MS` | `100` | Debounce delay for scroll handler |
| `RESIZE_DEBOUNCE_MS` | `300` | Debounce delay for resize handler |
| `NAVIGATION_DELAY_MS` | `500` | Delay (ms) before navigating after closing a mobile dialog |
| `PAGES_PER_SLIDE.LANDSCAPE_MOBILE` | `6` | Pages per carousel slide in landscape mobile |
| `PAGES_PER_SLIDE.DEFAULT` | `16` | Pages per carousel slide otherwise |
| `THEME_VALUES.LIGHT` | `0` | Explicit light theme |
| `THEME_VALUES.DARK` | `1` | Explicit dark theme |
| `THEME_VALUES.SYSTEM_LIGHT` | `4` | System preference resolved to light |
| `THEME_VALUES.SYSTEM_DARK` | `6` | System preference resolved to dark |

---

## 7. State & DOM Cache

### State object

| Property | Initial value | Description |
|---|---|---|
| `state.prevScrollPos` | `$(window).scrollTop()` | Last recorded scroll position |
| `state.viewportWidth` | `$(window).width()` | Last recorded viewport width |
| `state.isScrolling` | `null` | Timeout handle for scroll debounce |
| `state.resizeTimeout` | `null` | Timeout handle for resize debounce |
| `state.isContentLoaded` | `false` | Set to `true` on root URL after init |

`state.isContentLoaded` is also exposed as `window.isContentLoaded`.

### DOM elements cache (`elements`)

| Key | Selector | Description |
|---|---|---|
| `navbar` | `.navbar` | Main navbar element |
| `navbarMenu` | `.navbar-menu` | Navbar bottom bar (mobile) |
| `moduleMenu` | `#module-menu` | `<ul>` for module icon buttons |
| `imgLogoPath` | `#img-logo-path` | Company/Voyadores logo `<img>` |
| `accountAvatar` | `#dv-account-avatar` | Container for user avatar `<img>` |
| `navProfilePicture` | `#img-nav-profile-picture` | Secondary profile picture `<img>` |
| `accountName` | `#spn-account-name` | User full name (primary) |
| `accountRoles` | `#spn-account-roles` | User role names (primary) |
| `userFullname` | `#inp-hdn-user-fullname` | Hidden input holding user full name |
| `accountName2` | `#spn-account-name-2` | User full name (secondary) |
| `accountRoles2` | `#spn-account-roles-2` | User role names (secondary) |
| `accountInitial2` | `#spn-account-name-initial-2` | User initials (secondary) |
| `loadingOverlay` | `#loading-overlay` | Loading overlay `<div>` |
| `fileViewerModal` | `#dv-file-viewer-modal` | File viewer Bootstrap modal |

---

## 8. Menu Data & Rendering

### `processMenuData(filteredMenuData)`

Transforms the raw API response into a structured array of modules with nested submodules and sorted pages.

Input items have:

| Property | Type | Description |
|---|---|---|
| `Type` | `string` | `'module'` · `'page'` · `'custom-page'` |
| `Module` | `string` | Module name |
| `Submodule` | `string` | Submodule name (defaults to `'Uncategorized'`) |
| `submodulePosition` | `number` | Sort order within the module |
| `Name` | `string` | Display name |
| `Url` | `string` | Navigation URL |
| `Icon` | `string` | Voyadores icon class (e.g. `vi-chart-bar`) |

Output per module:

```javascript
{
    ...module,
    submodules: [{ name, pages, position }]  // sorted by position
}
```

### `renderModules(modules)`

Generates `<li>` HTML for `#module-menu`. The **Home** module is rendered as an `<a>` link; all other modules as `<button>` elements with a caret icon on desktop.

### `renderSubmodules(module)`

Generates a `<dialog class="nav-sheet">` for each module. The dialog ID follows the pattern `dv-{module-name-kebab}-menu`.

- **Mobile:** Pages split into carousel slides (`scroll-view` / `scroll-container`).
- **Desktop:** Pages grouped into columns by submodule (`<div class="columns">`).

### `renderDesktopPage(page)` / `renderMobilePage(page)`

Render individual page links:

| | Desktop | Mobile |
|---|---|---|
| Element | `<a class="nav-menu-link nav-desktop-menu-page">` | `<a class="nav-link nav-sub-link nav-mobile-menu-page">` |
| Icon | Text only | `<span class="nav-sub-icon">` |
| Custom page indicator | `<span class="vi-solid vi-file">` + tooltip | — |
| Active state | `active` class when pathname matches | `active` class when pathname matches |

---

## 9. Mobile Navigation

`renderMobileNavigation()` is called after navigation is rendered when `innerWidth < 1024`.

### Button → dialog mapping

Button IDs follow the pattern `btn-open-{module}`. The corresponding dialog ID is `dv-{module}-menu`.

```
#btn-open-accounting  →  #dv-accounting-menu
#btn-open-notification  →  #dv-notification-menu
```

### Interaction behavior

| Action | Result |
|---|---|
| Click a module button | Close all open dialogs → `dialog.show()` on target |
| Click the same button again | Close all dialogs (toggle off) |
| Click `.nav-sub-link` | `e.preventDefault()` → close dialog → navigate after 500ms |
| Click `.dialog-backdrop` | Close the open dialog |
| Click `.btn-close` | Close the open dialog |

### Carousel slides

Pages are batched into slides:
- **Landscape mobile** (`innerWidth > 600 && innerHeight < 500`): 6 pages per slide
- **Default**: 16 pages per slide

Single-page groups render as a plain `.nav-grid`. Multi-slide groups use `.scroll-view` > `.scroll-container` with `.scroll-indicators` dots.

---

## 10. Desktop Navigation

On desktop (≥ 1024px), navigation menus open on **hover** entirely via CSS — no JavaScript click handling is needed. The CSS uses sibling `:has()` selectors to keep both the trigger button and the nav sheet visible when either is hovered.

See [CSS — Desktop Nav Sheet](#19-css--desktop-nav-sheet) for the full hover rules.

---

## 11. Account & Theme Setup

### `setupUserAvatar(userProfile, userFullname, domainURL)`

- Renders `<img id="img-user-avatar-menu">` inside `#dv-account-avatar`.
- Falls back to the placeholder image on load error.
- Also sets `#img-nav-profile-picture` with the same URL, including error fallback.

### `setupUserInfo(userFullname, accountRoles)`

Fills `#spn-account-name`, `#spn-account-roles`, `#inp-hdn-user-fullname`, `#spn-account-name-2`, `#spn-account-roles-2`, and `#spn-account-name-initial-2`.

### `setupThemeSelector(currentTheme)`

Pre-checks the radio input matching the current theme label (`input[name='themes'][value=light/dark/system]`). If `system` and the stored value doesn't match the actual system preference, re-saves the theme.

### `setupThemeChangeHandler(domainURL)`

On `change` of `input:radio[name="themes"]`:
1. Calls `themePickerViewModel.setTheme(theme)`.
2. Resolves logo path (light/dark SVG from CDN).
3. Updates `html[data-bs-theme]` attribute.
4. Calls `changeThemeColor()` and `loadCompanyLogo()`.

### `loadCompanyLogo($imgElement, defaultLogoPath)`

Sets the logo to `defaultLogoPath` immediately, then attempts to load `/files/get-account-logo?logoName=account_logo_32x32.png`. If the image loads successfully, it replaces the default logo.

---

## 12. Scroll & Resize Behavior

### Navbar auto-hide on scroll (mobile)

`updateNavbarVisibility()` runs on `scroll` and `touchmove`, debounced by 100ms.

The navbar is hidden (`.invisible` class) when all three conditions are true:
1. Viewport width < 1007px (`VIEWPORT_BREAKPOINT - 17`)
2. Scrolling down (current position > previous position)
3. Past the threshold (`prevScrollPos > 32`)

The navbar is always shown on resize (`updateViewportWidth`).

### Resize handler (debounced 300ms)

When the viewport width changes, calls `loadIndicators()` to re-evaluate visual indicators for the new layout.

### Orientation change

Calls `updateViewportWidth()` → removes `.invisible`, re-renders navigation, resets scroll indicator state.

### Scroll indicators

`setScrollIndicatorState()` polls every 100ms for `.scroll-container`. Once found, an `IntersectionObserver` (threshold `0.5`) watches each `.scroll-item`. When a slide intersects, its corresponding `.indicator` dot gains the `.active` class.

---

## 13. Event Handlers

| Event | Element | Action |
|---|---|---|
| `beforeunload` | `window` | Show loading overlay; clear storage if navigating to `/logout` |
| `resize` (debounced) | `window` | `loadIndicators()` when width changes |
| `resize` | `window` | `setScrollIndicatorState()` |
| `scroll`, `touchmove` | `window` | `updateNavbarVisibility()` (debounced 100ms) |
| `orientationchange` | `window` | `updateViewportWidth()` |
| `click` | `a[href="/logout"]` | Logout flow (see §14) |
| `show.bs.modal`, `hidden.bs.modal` | `#dv-file-viewer-modal` | Update `<meta name="theme-color">` |

---

## 14. Logout Flow

When any `a[href="/logout"]` is clicked:

```
1. e.preventDefault() + e.stopImmediatePropagation()
2. BroadcastChannel("user-session-channel").postMessage({ type: 'USER_LOGOUT', timestamp })
3. localStorage.clear()
4. sessionStorage.clear()
5. setTimeout(() => window.location.replace('/logout'), 100)
```

`location.replace` prevents the page from being added to browser history, ensuring no back navigation to the authenticated session.

---

## 15. CSS — Global & Base

### Page transition

```css
@view-transition {
    navigation: auto;
}
```

Enables browser-native cross-page view transitions (Chrome 111+).

### Initial visibility

```css
body > :is(nav, header, main, footer) {
    visibility: hidden;
}
```

All major layout elements start hidden. `initialize()` sets them to `visibility: visible` after setup completes, preventing flash of unstyled content.

### Body

`touch-action: manipulation` — disables double-tap zoom on touch devices.

### Back navigation (`#a-nav-back`)

Hidden by default. Shown only when `data-current` contains `"files"`. When shown, hides `.navbar-brand` and adjusts the parent's padding from `ps-5` to `.5rem`.

---

## 16. CSS — Navbar

| Rule | Value | Description |
|---|---|---|
| `.navbar` | `transition: all 0.3s ease-in-out` | Smooth show/hide |
| `.navbar.invisible` | `opacity: 0` | Fade out (JS adds this class on scroll down) |
| `.navbar-menu.invisible` | `opacity: 0` | Same fade for bottom mobile bar |
| `.navbar.fixed-top` (≥ 1024px) | `z-index: 1046` | Above nav sheets |
| `.nav-link:has(> .vi-regular)` (≥ 1024px) | `z-index: 1047; border-radius: .5rem` | Icon nav links layer above |
| `#dv-user-account` | `width: 160px` | Fixed width for user account dropdown |
| `main` | `flex: 1` | Fill remaining vertical space |

### Theme switcher

| Breakpoint | Label size |
|---|---|
| Default (mobile) | `3rem × 3rem` |
| ≥ 1024px | `2.5rem × 2.5rem` |

The switcher uses Bootstrap `.btn-check` with CSS custom properties for inactive and active states.

### Active module icon

`.vi-regular` inside the active module's button turns `var(--vds-primary-text-emphasis)`. This is determined entirely via CSS `:has()` — no JavaScript class is added.

---

## 17. CSS — Notifications

| Element | Style | Description |
|---|---|---|
| `#dv-notification-menu-badge-count` | `top: 1.25rem; padding: 0 6px; border-radius: 12px; font-size: .75rem` | Pill-style badge |
| `.notification-unread` | `background: var(--vds-primary-bg-subtle); font-weight: 500` | Unread row highlight (generic) |
| `.notification-unread` (light theme) | `background: var(--vds-luminous-orange-200)` | Orange tint in light mode |
| `.notification-unread` (light, hover) | `background: var(--vds-luminous-orange-300)` | Darker on hover |
| `.notification-unread` (dark theme) | `background: var(--vds-luminous-orange-800)` | Orange tint in dark mode |
| `.notification-unread` (dark, hover) | `background: var(--vds-luminous-orange-900)` | Darker on hover |
| `.spn-notification-message` | `2-line clamp` | Message truncated to 2 lines |
| `.notification-time-unread` | `color: var(--vds-secondary-rgb)` | Muted color for read notification timestamps |

---

## 18. CSS — Mobile Nav Sheet & Dialogs

Applies at `max-width: 1023px`.

### `dialog` (nav sheet base animation)

| Property | Default | When `[open]` |
|---|---|---|
| `opacity` | `0` | `1` |
| `transform` | `translateY(100%)` | `translateY(0)` |
| `transition` | `opacity + transform 500ms cubic-bezier(0.4,0,0.2,1)` | — |

Uses `@supports (transition: display allow-discrete)` for enhanced discrete transitions and `@starting-style` for entry animations.

### `.dialog-backdrop`

A fixed overlay that appears behind open dialogs:

| Property | Value |
|---|---|
| `position` | `fixed` |
| `inset` | `2.5rem 0 0` |
| `background-color` | `#161616` |
| `backdrop-filter` | `blur(100px)` |
| `opacity` | `0` → `0.72` when `dialog[open] ~ .dialog-backdrop` |
| `z-index` | `1028` |

### `.nav-sheet` (mobile)

Bottom sheet anchored above the navbar:

| Property | Value |
|---|---|
| `position` | `fixed` |
| `bottom` | `56px` |
| `border-top-left/right-radius` | `.75rem` |
| `z-index` | `1029` |

### `.nav-sheet-end`

Full-height side panel (e.g. notification menu on mobile):

| Property | Value |
|---|---|
| `height` | `100%` |
| `width` | `calc(100vw - 2rem)` |
| `max-width` | `600px` |
| `transform` | `translateX(100%)` → `translateX(0)` |
| `z-index` | `1031` |

### `#dv-notification-menu`, `#dv-account-menu` (mobile)

Full-screen overlay dialogs:

| Property | Value |
|---|---|
| `display` | Hidden by default; `block` when `[open]` |
| `block-size` | `calc(100dvh - 4rem - 3.5rem)` |
| `bottom` | `3.5rem` |
| Animation | `dialogAppear 200ms linear` |
| Grid rows | `56px 1fr 56px` |

### Scroll prevent

`body:has(> dialog[open].nav-sheet)` → `overflow: hidden; height: 100vh`

### Scroll view (carousel)

| Class | Description |
|---|---|
| `.scroll-container` | `overflow-x: scroll; scroll-snap-type: x mandatory` |
| `.scroll-container > div` | `flex: 0 0 100%; scroll-snap-align: start` |
| `.indicator` | 10px dot, `var(--vds-tertiary-color)` |
| `.indicator.active` | `var(--vds-body-color)` |

### Nav icons

| Class | Description |
|---|---|
| `.nav-sub-icon`, `.nav-app` | `3rem × 3rem` grid; `var(--vds-primary)` background |
| `.nav-sub-text` | `0.6875rem`, centered, truncated |
| `.nav-grid` | `grid-template-columns: repeat(4, 1fr)` |

---

## 19. CSS — Desktop Nav Sheet

Applies at `min-width: 1024px`.

### Nav sheet positioning

| Property | Value |
|---|---|
| `position` | `fixed` |
| `top` | `56px` |
| `right` | `56px` |
| `z-index` | `1045` |
| `max-height` | `calc(100% - 4rem)` |
| `overflow-y` | `auto` |

### Hover behavior (CSS-only, no JS)

Nav sheets open when hovering either the trigger button **or** the nav sheet itself, via sibling `:has()` selectors:

```css
.navbar:has(~ #dv-accounting-menu:hover) #btn-open-accounting,
.navbar:has(~ #dv-accounting-menu) #btn-open-accounting:hover,
.navbar:has(#btn-open-accounting:hover) ~ #dv-accounting-menu,
.nav-sheet:hover { display: block; }
```

This pattern applies to all module menus, notification, and account menus.

### Hover button style

Active/hovered module buttons gain:
- `background-color: var(--vds-body-bg)` (light) / `var(--vds-tertiary-bg)` (dark)
- `border-bottom-left-radius: 0; border-bottom-right-radius: 0` — visually merges with the nav sheet below

### Caret

`.vi-caret-down` inside hovered module buttons rotates `−180deg` via `transform: rotate(-180deg)`.

### `.columns` layout

```css
.columns {
    columns: 200px;  /* CSS multi-column layout */
}
.columns > * { break-inside: avoid; }
```

Used for desktop submodule groups within nav sheets.

---

## 20. CSS — Nav Sheet Width Rules

Desktop nav sheet widths are set dynamically based on the number of submodule columns and the total number of modules in `#module-menu`:

| Condition | Width |
|---|---|
| Notification / Account menus | `300px` |
| Module menus with 1–2 column groups | `300px` |
| `#dv-manage-menu` with 2 groups | `440px` |
| Module menus with 3–5 column groups | `500px` |
| Accounting, Inventory, Fleet | `650px` |
| Human Resources | `730px` |
| `#dv-account-menu` | `border-top-right-radius: 0` |

### Right position adjustments (module count–sensitive)

For multi-column menus that would overflow the right edge, the `right` offset is adjusted based on how many modules are in `#module-menu`:

| Modules | 1–2 columns | 3–4 columns |
|---|---|---|
| 6 | `18rem` | `6rem` |
| 5 | `13rem` | — |
| 4 | `8rem` | — |

---

## 21. CSS — PWA Display Modes

### Fullscreen (max-width 992px)

| Element | Adjustment |
|---|---|
| `.navbar-menu` | `padding-bottom: 2rem` (extra safe area) |
| `.nav-sheet` | `bottom: calc(56px + 2rem)` |
| `#dv-notification-menu`, `#dv-account-menu` | Reduced `block-size` |

### Fullscreen (min-width 768px)

```css
nav + * + main.mt-10 {
    margin-top: 100px !important;
}
```

### Window Controls Overlay

| Element | Adjustment |
|---|---|
| `.navbar` | `padding-top: 44px; height: 100px` |
| `header` | `margin-top: 100px` |
| `.nav-sheet` | `top: calc(56px + 44px)` |
| `main.mt-9` | `margin-top: 92px` |

### Short landscape (max-height 430px, min-width 600px)

Nav sheet capped at `200px` height with a two-row CSS grid for the carousel.

---

## 22. CSS — Utility Classes & Components

### Quick links toggle

Controls the visible/solid icon swap for `#btn-set-quick-link` and `#btn-set-default-url`:

```css
/* Unchecked: show vi-regular, hide vi-solid */
:where(#btn-set-quick-link, #btn-set-default-url) + label > :first-child { display: block }
:where(#btn-set-quick-link, #btn-set-default-url) + label > :last-child  { display: none  }

/* Checked: swap */
:where(#btn-set-quick-link, #btn-set-default-url):checked + label > :first-child { display: none  }
:where(#btn-set-quick-link, #btn-set-default-url):checked + label > :last-child  { display: block }
```

### Loading overlays

Both `#loading-overlay` and `.modal-loading-overlay` use `z-index: calc(infinity)`.

`body:has(> #loading-overlay)` → `overflow: hidden` (scroll locked while loading).

### Action button offcanvas (`#dv-actions-offcanvas`, `#dv-dismiss-tasks-offcanvas`)

`z-index: 1552` / backdrop `1551`. Top corners rounded (`border-top-left/right-radius: .75rem`).

### Small icon buttons

`.btn-sm:has(> :is(.vi-regular, .vi-solid))` → `1.75rem × 1.75rem` square, no padding.

### Standard icon buttons

`.btn:is(.btn-primary, .btn-secondary, ...):has(> :is(.vi-regular, .vi-solid))` → `2.5rem × 2.5rem`.

### Table column widths (`.table-custom`)

| Breakpoint | `td` min-width | `td` max-width |
|---|---|---|
| All | `4rem` | `8rem` |
| ≥ 1280px | `6rem` | `12rem` |
| ≥ 1440px | `8rem` | `16rem` |

Counter cells (`td.row-counter`) and centered non-status cells are fixed at `56px`.

### Header `h1`

Single-line truncated with `text-overflow: ellipsis`. Font size scales:

| Viewport | Font size |
|---|---|
| 0–600px | `22px` |
| 600–1024px | `26px` |
| 600–768px | `max-width: 24rem` |

### Action button (`.vi-more-vertical`)

`table button:has(.vi-more-vertical)` → `2.5rem × 2.5rem`, no border.

### Confirmation dialog

`#dv-confirmation-modal .modal-header` → `padding-bottom: 0`.

### Data list (`.view-data-list`)

Styled `<dl>` with border, radius, and responsive padding:

| Part | Mobile | ≥ 768px |
|---|---|---|
| `dt` | No bottom border | Border bottom |
| `dd` | `padding: .25rem 1rem .75rem` | `padding: .75rem 1rem` |

### Driver.js file viewer popover

```css
.driver-popover:has(#dv-file-viewer-on-dialog) {
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
}
```

Centers the Driver.js popover when it contains the file viewer step. At ≤ 992px, `min-width: 320px` is applied.

---

## 23. Required DOM Elements

| Element | Description |
|---|---|
| `#module-menu` | `<ul>` populated with module buttons by `renderModules()` |
| `#img-logo-path` | Company/Voyadores logo `<img>` |
| `#dv-account-avatar` | Container for user avatar `<img>` |
| `#img-nav-profile-picture` | Secondary profile picture element |
| `#spn-account-name` | User full name (primary display) |
| `#spn-account-roles` | User role names (primary display) |
| `#inp-hdn-user-fullname` | Hidden input holding user full name |
| `#spn-account-name-2` | User full name (secondary, e.g. account menu) |
| `#spn-account-roles-2` | User role names (secondary) |
| `#spn-account-name-initial-2` | User initials (secondary) |
| `#loading-overlay` | Loading overlay element |
| `#dv-file-viewer-modal` | Bootstrap modal for file viewer |
| `#voyadores-cdn-url` | Hidden input with CDN base URL |
| `meta[name="theme-color"]` | Browser theme color meta tag |
| `input:radio[name="themes"]` | Theme switcher radio inputs |
| `.dialog-backdrop` | Backdrop overlay element for mobile dialogs |

---

## 24. Internal Functions Reference

| Function | Returns | Description |
|---|---|---|
| `getViewportWidth()` | `number` | `$(window).width()` |
| `getFirstLetters(str)` | `string` | First character of each word, joined (e.g. `"Juan dela Cruz"` → `"JdC"`) |
| `getDomainURL()` | `string` | Value of `#voyadores-cdn-url` input |
| `toggleVisibility(selector, isHidden)` | `void` | Toggles `d-none` class |
| `setElementsVisibility(selectors, visibility)` | `void` | Sets `visibility` CSS property on multiple selectors |
| `isLandscapeMobile()` | `boolean` | `innerWidth > 600 && innerHeight < 500` |
| `changeThemeColor(theme)` | `void` | Updates `<meta name="theme-color">` |
| `getThemeBasedLogo(theme, domainURL)` | `string` | Returns CDN path to the light/dark logo SVG |
| `loadCompanyLogo($imgElement, defaultLogoPath)` | `void` | Sets logo `src`; replaces with account logo on load |
| `updateNavbarVisibility()` | `void` | Debounced scroll handler; adds/removes `.invisible` |
| `updateViewportWidth()` | `void` | Updates state, removes `.invisible`, re-renders navigation |
| `processMenuData(data)` | `Array` | Groups pages by module/submodule; returns sorted module tree |
| `getProcessedMenu()` | `Promise<Array>` | Fetches menu from API and runs `processMenuData` |
| `renderModules(modules)` | `string` | HTML string for `#module-menu` `<li>` items |
| `renderDesktopPage(page)` | `string` | HTML string for a desktop nav menu link |
| `renderMobilePage(page)` | `string` | HTML string for a mobile nav grid item |
| `renderSubmodules(module)` | `string` | HTML string for a `<dialog class="nav-sheet">` |
| `renderNavigation()` | `Promise<void>` | Orchestrates full navigation render |
| `renderMobileNavigation()` | `void` | Binds all mobile dialog event handlers |
| `setupUserAvatar(profile, name, domainURL)` | `void` | Renders avatar `<img>` with error fallback |
| `setupUserInfo(fullname, roles)` | `void` | Fills all name/role/initial DOM elements |
| `setupThemeSelector(theme)` | `void` | Pre-checks the correct theme radio |
| `setupThemeChangeHandler(domainURL)` | `void` | Binds theme radio `change` event |
| `initializeAccountInfo()` | `Promise<void>` | Orchestrates full account setup |
| `setScrollIndicatorState()` | `void` | Polls for `.scroll-container`; starts `IntersectionObserver` |
| `setupFileViewerModal()` | `void` | Binds `show/hidden.bs.modal` on `#dv-file-viewer-modal` |
| `setupEventHandlers()` | `void` | Binds all window/document event listeners |
| `cleanupWhitespace()` | `void` | Removes text nodes from `<body>` |
| `initialize()` | `Promise<void>` | Main entry point — runs full initialization sequence |
