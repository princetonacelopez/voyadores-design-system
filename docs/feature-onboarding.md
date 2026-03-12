---
title: "Feature Onboarding"
version: "1.0.0"
files: "`content/js/application/application.feature-onboarding.js` · `content/css/application/application.feature-onboarding.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Feature Onboarding module provides a `TourManager` class that orchestrates step-by-step guided tours built on top of [Driver.js](https://driverjs.com/). It adds:

- A pre-tour **intro dialog** (`<dialog>`) that lets the user choose to start or skip the tour.
- **Gate checks** before showing any tour — completion state, show count, time window, page path, feature flags, and DOM readiness.
- **localStorage persistence** to track completion and show counts per tour ID.
- A companion CSS file that styles the intro dialog and normalizes Driver.js popover appearance.

---

## 2. Features

| Feature | Description |
|---|---|
| Pre-tour intro dialog | Native `<dialog>` element with Start, Skip, and Close actions |
| Completion tracking | Tour marked complete in `localStorage` after finishing or skipping |
| Show count limiting | Configurable `maxShows` cap (default 1) |
| Time window | Optional `releaseAt` + `ttlDays` to auto-expire tours |
| Page restriction | Tours only shown on a specific pathname via `page` |
| Feature flag check | Tours gated by a flag key looked up in a context object |
| Custom validation | `validate(context)` function for arbitrary conditions |
| DOM target check | All step elements must be present before the tour starts |
| Force start | `forceTour()` bypasses all gate checks |
| Debug info | `getDebugInfo(id)` returns storage and runtime state |
| Reset | `resetTour(id)` clears all localStorage entries for a tour |
| UMD export | Works as CommonJS, AMD, or `window.TourManager` |

---

## 3. Dependencies

| Library | Required | Description |
|---|---|---|
| Driver.js | **Yes** | Step-based highlighting engine. Must be available at `window.driver.js.driver`. |

No jQuery dependency. The class uses vanilla DOM APIs.

---

## 4. Setup

### 1. Include files

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/application/application.feature-onboarding.css" />

<!-- Before closing </body> -->
<script src="/js/driver/driver.js.iife.js"></script>
<script src="/js/application/application.feature-onboarding.js"></script>
```

### 2. Add the intro dialog

```html
<dialog id="dlg-feature-onboarding" class="feature-onboarding-dialog">
    <div class="feature-onboarding-dialog-header">
        <button id="btn-feature-onboarding-close" class="feature-onboarding-dialog-close">
            &times;
        </button>
    </div>
    <div class="feature-onboarding-dialog-body">
        <!-- Content injected by tourDef.dialogContent or written statically -->
    </div>
    <div class="feature-onboarding-dialog-footer">
        <button id="btn-feature-onboarding-skip" class="btn btn-outline-secondary">
            Skip Tour
        </button>
        <button id="btn-feature-onboarding-start" class="btn btn-primary">
            Start Tour
        </button>
    </div>
</dialog>
```

### 3. Instantiate and register a tour

```javascript
const tourManager = new TourManager();

tourManager.registerTour({
    id: 'dashboard-intro',
    steps: [
        { element: '#nav-reports',  popover: { title: 'Reports', description: 'Access all reports here.' } },
        { element: '#btn-new-entry', popover: { title: 'New Entry', description: 'Create a new record.' } }
    ]
});
```

---

## 5. Tour Definition

A tour definition is a plain object passed to `registerTour()` or `forceTour()`.

### Required properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the tour. Used as the localStorage key prefix. |
| `steps` | `Array` | Array of Driver.js step objects. Each step may have `element` (CSS selector) and `popover` (`title`, `description`). |

### Gate condition properties

| Property | Type | Default | Description |
|---|---|---|---|
| `maxShows` | `number` | `1` | Maximum number of times the tour will be shown. Set to `0` to disable the cap. |
| `releaseAt` | `string` | — | ISO 8601 date string. Tour is only shown on or after this date. |
| `ttlDays` | `number` | — | Number of days after `releaseAt` during which the tour is shown. Requires `releaseAt`. |
| `page` | `string` | — | Pathname (e.g. `"/dashboard"`) the user must be on. Trailing slashes are normalized. |
| `flag` | `string` | — | Key looked up in `context.flags`. Tour is skipped if `context.flags[flag]` is falsy. |
| `validate` | `function` | — | `(context) => boolean`. Custom gate check. Returning `false` prevents the tour. |

### Behavior properties

| Property | Type | Default | Description |
|---|---|---|---|
| `useDialog` | `boolean` | `true` | When `true`, shows the intro `<dialog>` before starting. When `false`, starts immediately. |
| `dialogContent` | `string \| HTMLElement` | — | Content injected into `.feature-onboarding-dialog-body`. Replaces existing body content. |
| `driverConfig` | `object` | — | Driver.js config overrides merged on top of `TourManager` defaults. |

### Lifecycle callbacks

| Property | Signature | Fires when |
|---|---|---|
| `onStarted` | `(tourDef)` | Driver tour begins |
| `onCompleted` | `(tourDef)` | Driver tour finishes (last step or closed) |
| `onSkipped` | `(tourDef)` | User clicks Skip in the intro dialog |
| `onStepHighlighted` | `(element, step, options)` | Driver.js highlights each step |

---

## 6. TourManager Class

### Constructor

```javascript
const tourManager = new TourManager(options);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultDriverConfig` | `object` | See below | Base Driver.js config merged with every tour's `driverConfig`. |
| `dialogId` | `string` | `'dlg-feature-onboarding'` | ID of the native `<dialog>` element. |
| `skipButtonId` | `string` | `'btn-feature-onboarding-skip'` | ID of the Skip button inside the dialog. |
| `startButtonId` | `string` | `'btn-feature-onboarding-start'` | ID of the Start button inside the dialog. |
| `closeButtonId` | `string` | `'btn-feature-onboarding-close'` | ID of the Close (×) button inside the dialog. |

### Default Driver.js config

```javascript
{
    allowClose: false,
    showProgress: true,
    showButtons: ['next', 'previous'],
    overlayClickNext: false,
    animate: true,
    opacity: 0.75
}
```

These defaults are merged with each tour's `driverConfig`. Tour-level `driverConfig` takes precedence.

---

## 7. Public API

### `registerTour(tourDef, context?)`

Runs all gate checks (see [section 8](#8-registertour--gate-checks)). If all checks pass, shows the intro dialog or starts the tour directly.

```javascript
tourManager.registerTour(
    {
        id: 'payroll-intro',
        steps: [...],
        page: '/payroll',
        maxShows: 2
    },
    { flags: { payrollEnabled: true } }
);
```

Returns `true` if the tour was started or the dialog was shown, `false` if any gate check failed.

---

### `forceTour(tourDef)`

Bypasses completion, show count, time window, page, flag, and DOM checks. Starts the Driver.js tour immediately without the intro dialog.

```javascript
tourManager.forceTour({
    id: 'dev-preview',
    steps: [...]
});
```

Returns `true` on success, `false` if Driver.js is unavailable or the tour definition is invalid.

---

### `resetTour(id)`

Clears all localStorage entries for the given tour ID, allowing it to be shown again.

```javascript
tourManager.resetTour('dashboard-intro');
```

Removes three keys: `tour:{id}`, `tourshows:{id}`, `tourlast:{id}`.

---

### `destroyCurrentTour()`

Destroys the active Driver.js instance if one is running.

```javascript
tourManager.destroyCurrentTour();
```

---

### `getDebugInfo(id)`

Returns a diagnostic object for the given tour ID.

```javascript
tourManager.getDebugInfo('dashboard-intro');
// → {
//     completed: false,
//     shows: 1,
//     driverAvailable: true,
//     currentPath: '/dashboard',
//     hasActiveInstance: false
// }
```

---

## 8. `registerTour` — Gate Checks

`registerTour` evaluates the following checks in order. If any check fails, the tour is silently skipped and `false` is returned.

| # | Check | Fails when |
|---|---|---|
| 1 | Valid definition | `tourDef.id` is missing or `tourDef.steps` is not an array |
| 2 | Driver.js available | `window.driver.js.driver` is not a function |
| 3 | Within time window | `releaseAt` is set and `Date.now()` is past `releaseAt + ttlDays` days |
| 4 | Not completed | `localStorage` contains `tour:{id}` with `completed: true` |
| 5 | Max shows | `tourshows:{id}` count ≥ `maxShows` (when `maxShows > 0`) |
| 6 | Page match | `tourDef.page` is set and does not match `location.pathname` |
| 7 | Feature flag | `tourDef.flag` is set and `context.flags[flag]` is falsy |
| 8 | Custom validate | `tourDef.validate(context)` returns `false` |
| 9 | DOM targets | Any step with an `element` selector matches no element in the document |

If all checks pass:
- `useDialog !== false` → `showDialog(tourDef)` (opens `<dialog>`)
- `useDialog === false` → `startTourDirectly(tourDef)` (starts Driver.js immediately)

---

## 9. Dialog Flow

```
registerTour() passes all checks
        │
        ▼
   useDialog?
   ├── true  → showDialog() → <dialog>.showModal()
   │               │
   │          User action:
   │          ├── Start  → dialog.close() → startTour() → Driver.js begins
   │          ├── Skip   → dialog.close() → markComplete(id) → onSkipped()
   │          └── Close  → dialog.close()  (no completion recorded)
   │
   └── false → startTourDirectly() → Driver.js begins
```



- The user clicks **Start** and the Driver.js tour completes (last step or `onDestroyed`).
- The user clicks **Skip**.

Clicking **Close** or the backdrop does **not** mark the tour complete.

---

## 10. Storage

All data is stored in `localStorage` using string-prefixed keys.

### Keys

| Key pattern | Example | Value | Description |
|---|---|---|---|
| `tour:{id}` | `tour:dashboard-intro` | `{"completed":true,"completedAt":"2026-03-10T..."}` | Completion record |
| `tourshows:{id}` | `tourshows:dashboard-intro` | `"2"` | Number of times shown |
| `tourlast:{id}` | `tourlast:dashboard-intro` | `"2026-03-10T..."` | ISO timestamp of last show |

### Show count

`incShows(id)` is called at the start of `startTourDirectly()`. It increments `tourshows:{id}` and writes the current ISO timestamp to `tourlast:{id}`.

### Reset

`resetTour(id)` removes all three keys for a tour, allowing it to pass the completion and show count checks again.

---

## 11. Driver.js Integration

`TourManager` wraps Driver.js via `window.driver.js.driver`. Availability is checked before every operation via `isDriverAvailable()`.

### Config merging

```javascript
const finalConfig = {
    ...this.defaultDriverConfig,  // TourManager constructor defaults
    ...tourDef.driverConfig,      // Per-tour overrides
    steps: tourDef.steps,
    onHighlighted: ...,
    onDestroyed: ...,
    onDeselected: ...
}
```

### Completion detection

The tour is marked complete when either:
- `onDestroyed` fires (Driver.js was destroyed for any reason).
- `onDeselected` fires with `options.isLast === true` or `options.wasClosed === true`.

Both call `markComplete(id)` and `tourDef.onCompleted?.()`.

### Step element validation

`hasAllTargets(steps)` runs `document.querySelector(step.element)` for every step that has an `element` property. If any element is not found, `registerTour` returns `false` and the tour is not shown.

---

## 12. CSS — Dialog

The intro dialog uses the native HTML `<dialog>` element with the `.feature-onboarding-dialog` class.

### `.feature-onboarding-dialog`

| Property | Mobile (default) | Desktop (≥ 576px) |
|---|---|---|
| `min-inline-size` | `100%` | `auto` |
| `min-block-size` | `100dvh` | `auto` |
| `max-inline-size` | — | `30rem` |
| `max-block-size` | — | `fit-content` |
| `margin` | `0` | `auto` (centered) |
| `border` | `none` | `1px solid var(--vds-border-color)` |
| `border-radius` | — | `1.25rem` |

On mobile the dialog fills the full viewport. On `sm` and above it becomes a centered modal card.

### `.feature-onboarding-dialog[open]`

When the dialog is open (`showModal()` has been called), the element uses `display: flex; flex-direction: column`.

### `.feature-onboarding-dialog[open]::backdrop`

`pointer-events: none` — the backdrop does not intercept clicks (click-outside is handled via a JavaScript event listener on the `<dialog>` itself).

### Layout classes

| Class | Styles |
|---|---|
| `.feature-onboarding-dialog-header` | `display: flex` |
| `.feature-onboarding-dialog-close` | `color: var(--vds-tertiary-color)` |
| `.feature-onboarding-dialog-body` | `padding-inline: 1.5rem; flex: 1 0 0; align-content: center` |
| `.feature-onboarding-dialog-footer` | `display: flex; justify-content: space-evenly; align-items: center; gap: 1.5rem; padding: 1.5rem` |
| `.feature-onboarding-dialog-footer button` | `flex: 1 0 0` (equal-width buttons) |

---

## 13. CSS — Driver.js Overrides

The stylesheet normalizes Driver.js popover appearance to match the Voyadores design system.

| Rule | Effect |
|---|---|
| `.driver-popover :is(header, footer)` | Forces `visibility: visible` on popover header and footer (overrides Driver.js hiding behavior) |
| `.driver-popover *` | Sets `font-family: inherit` so the popover uses the page font |
| `.driver-popover .vi-solid` | Sets `font-family: voyadores-icon-solid` so Voyadores solid icons render correctly inside popovers |
| `.driver-popover` (≥ 768px) | Fixes `min-width` and `max-width` to `30rem` |

### Active button state fix

```css
.btn-primary:active {
    background-color: var(--vds-btn-active-bg) !important;
}
```

Restores the Bootstrap active state on the Driver.js "Next" button, which may be overridden by Driver.js default styles.

### Carousel desktop navigation hide

```css
#dv-onboarding-modal .carousel-item:nth-child(3):has(.active) #dv-desktop-navigation {
    display: none;
}
```

Hides the desktop navigation element when the third carousel item is active inside `#dv-onboarding-modal`.

---

## 14. CSS — Onboarding Images

Images inside `#dv-onboarding-welcome-step` and `#dv-onboarding-tour-step` are sized responsively based on viewport height.

| Selector | Default width | Width at viewport height ≥ 600px |
|---|---|---|
| `#dv-onboarding-welcome-step img` | `260px` | `360px` |
| `#dv-onboarding-tour-step img` | `260px` | `330px` |

---

## 15. Required DOM Elements

| Element | Required | Description |
|---|---|---|
| `<dialog id="dlg-feature-onboarding">` | **Yes** (for dialog flow) | The intro dialog. If missing, `registerTour` falls back to `startTourDirectly`. |
| `.feature-onboarding-dialog-body` | No | Target for `tourDef.dialogContent` injection. |
| `#btn-feature-onboarding-start` | No | Triggers `startTour()` on click. |
| `#btn-feature-onboarding-skip` | No | Triggers `skipTour()` on click (marks complete). |
| `#btn-feature-onboarding-close` | No | Closes the dialog without marking complete. |
| Step `element` selectors | **Yes** (per step) | Each step's `element` must resolve via `document.querySelector`. |

Button IDs can be changed via constructor options (`startButtonId`, `skipButtonId`, `closeButtonId`).

---

## 16. Console Messages

| Level | Message |
|---|---|
| `warn` | `TourManager: Feature onboarding dialog not found` |
| `warn` | `TourManager: No current tour definition` |
| `warn` | `TourManager: Invalid tour definition` |
| `warn` | `TourManager: Invalid tour definition for force start` |
| `warn` | `TourManager: Dialog not found, starting tour directly` |
| `warn` | `TourManager: Error reading JSON from localStorage:` |
| `warn` | `TourManager: Error writing JSON to localStorage:` |
| `warn` | `TourManager: Error in custom validation:` |
| `warn` | `TourManager: Error destroying driver instance:` |
| `error` | `TourManager: Driver.js not available` |
| `error` | `TourManager: Error creating driver instance:` |
| `error` | `TourManager: Failed to start driver instance` |

---

## 17. Full Example

### HTML

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/css/bootstrap/bootstrap.voyadores.theme.min.css" />
    <link rel="stylesheet" href="/css/application/application.feature-onboarding.css" />
</head>
<body>

    <!-- Page content the tour will highlight -->
    <nav>
        <a id="nav-reports" class="nav-link">Reports</a>
        <a id="nav-payroll" class="nav-link">Payroll</a>
    </nav>
    <button id="btn-new-entry" class="btn btn-primary">New Entry</button>

    <!-- Intro dialog -->
    <dialog id="dlg-feature-onboarding" class="feature-onboarding-dialog">
        <div class="feature-onboarding-dialog-header">
            <button id="btn-feature-onboarding-close" class="feature-onboarding-dialog-close btn btn-link ms-auto">
                &times;
            </button>
        </div>
        <div class="feature-onboarding-dialog-body">
            <!-- Populated via tourDef.dialogContent, or written statically -->
            <h4>Welcome to Reports</h4>
            <p>Let us show you around the new Reports module.</p>
        </div>
        <div class="feature-onboarding-dialog-footer">
            <button id="btn-feature-onboarding-skip" class="btn btn-outline-secondary">Skip</button>
            <button id="btn-feature-onboarding-start" class="btn btn-primary">Take the Tour</button>
        </div>
    </dialog>

    <script src="/js/driver/driver.js.iife.js"></script>
    <script src="/js/application/application.feature-onboarding.js"></script>
    <script>
        const tourManager = new TourManager();

        tourManager.registerTour({
            id: 'reports-intro',
            page: '/reports',
            releaseAt: '2026-03-01T00:00:00Z',
            ttlDays: 30,
            maxShows: 1,
            steps: [
                {
                    element: '#nav-reports',
                    popover: {
                        title: 'Reports',
                        description: 'Navigate to any report from here.'
                    }
                },
                {
                    element: '#btn-new-entry',
                    popover: {
                        title: 'New Entry',
                        description: 'Create a new record with this button.'
                    }
                }
            ],
            driverConfig: {
                showProgress: true,
                doneBtnText: 'Got it'
            },
            onCompleted: (tourDef) => console.log(`Tour "${tourDef.id}" completed`),
            onSkipped:   (tourDef) => console.log(`Tour "${tourDef.id}" skipped`)
        });
    </script>

</body>
</html>
```

### Force start (dev / demo mode)

```javascript
const tourManager = new TourManager();

tourManager.forceTour({
    id: 'dev-preview',
    steps: [
        { element: '#nav-reports', popover: { title: 'Step 1', description: 'Reports nav' } }
    ]
});
```

### Reset and re-run a completed tour

```javascript
tourManager.resetTour('reports-intro');
tourManager.registerTour({ id: 'reports-intro', steps: [...] });
```

### Debug a tour

```javascript
console.log(tourManager.getDebugInfo('reports-intro'));
// → { completed: true, shows: 1, driverAvailable: true, currentPath: '/reports', hasActiveInstance: false }
```

### Custom instance with different dialog IDs

```javascript
const tourManager = new TourManager({
    dialogId:      'my-custom-dialog',
    skipButtonId:  'my-skip-btn',
    startButtonId: 'my-start-btn',
    closeButtonId: 'my-close-btn',
    defaultDriverConfig: {
        showProgress: false,
        opacity: 0.5
    }
});
```
