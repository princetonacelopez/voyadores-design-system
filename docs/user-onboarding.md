---
title: "User Onboarding"
version: "1.0.0"
files: "`content/js/application/application.user-onboarding.js` · `public/js/application/application.user-onboarding.update.js` · `content/css/application/application.user-onboarding.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The User Onboarding module shows a multi-step **Bootstrap modal carousel** to first-time users, followed by an optional **Driver.js guided tour** of the application's key UI areas. After completing or skipping the onboarding flow, it marks the user as activated via an API call, ensuring the modal is not shown again on subsequent visits.

---

## 2. Features

| Feature | Description |
|---|---|
| First-time modal | Bootstrap modal with a carousel presented to new users |
| Theme-aware logo | Voyadores logo swaps between light and dark variants based on `data-bs-theme` |
| Personalized greeting | User's full name injected into the welcome step |
| Carousel step management | Next, Previous, and Start Tour buttons toggle automatically as the user navigates |
| Guided tour | 6–7 Driver.js steps highlighting key UI elements |
| Conditional tour step | Announcement or Help Tips step shown based on which container is visible |
| Skip option | User can dismiss the modal without taking the tour |
| Activation on completion | User is activated via API when the tour finishes or is skipped |
| CDN-aware images | All image URLs resolved using the `#voyadores-cdn-url` hidden input |

---

## 3. Dependencies

| Library / Global | Required | Description |
|---|---|---|
| jQuery | **Yes** | DOM ready, event binding, modal control |
| Bootstrap 5 | **Yes** | Modal (`modal('show')`, `modal('hide')`) and Carousel (`slid.bs.carousel`) |
| Driver.js | **Yes** | Guided tour highlighting engine (`window.driver.js.driver`) |
| `globalRequest` | **Yes** | Application-level HTTP client |
| `globalURI` | **Yes** | Application-level URI builder |
| `notify` | **Yes** | Application-level notification function used on API error |

---

## 4. Files

| File | Description |
|---|---|
| `application.user-onboarding.js` | Main controller. Fetches user data, renders the modal, manages the carousel and tour. |
| `application.user-onboarding.update.js` | `UserOnboardingUpdateViewModel` constructor. Provides `getUser()` and `activate()`. |
| `application.user-onboarding.css` | Styles for the modal, carousel indicators, Driver.js overrides, and onboarding images. |

---

## 5. Setup

### 1. Include files

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/application/application.user-onboarding.css" />

<!-- Before closing </body> -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/bootstrap/bootstrap.bundle.min.js"></script>
<script src="/js/driver/driver.js.iife.js"></script>
<script src="/js/application/application.user-onboarding.update.js"></script>
<script src="/js/application/application.user-onboarding.js"></script>
```

### 2. Add the CDN URL input

```html
<input type="hidden" id="voyadores-cdn-url" value="https://your-cdn.com" />
```

### 3. Add the onboarding modal

See [Required DOM Elements](#6-required-dom-elements) for the full modal structure.

No further initialization is required. The script runs on `$(document).ready` and shows the modal automatically if `getUser()` returns a user record.

---

## 6. Required DOM Elements

| Element | Description |
|---|---|
| `#voyadores-cdn-url` | Hidden input whose `value` is the base CDN URL for images. |
| `#dv-onboarding-modal` | Bootstrap modal container. |
| `#dv-onboarding-carousel` | Bootstrap carousel inside the modal. |
| `#spn-user-name` | Receives the user's full name (`user.Fullname`). |
| `#img-voyadores-logo` | Logo `<img>` whose `src` is updated based on the active theme. |
| `#dv-onboarding-welcome-step` | First carousel item (welcome step). |
| `#dv-onboarding-tour-step` | Last carousel item. Triggers the tour button swap. |
| `#btn-onboarding-next` | Advance carousel button. Hidden on the tour step. |
| `#btn-onboarding-previous` | Go back carousel button. Disabled on the welcome step. Hidden on the tour step. Hidden on mobile (CSS). |
| `#btn-start-tour` | Hidden until the tour step is reached. Starts Driver.js on click. |
| `#btn-skip-onboarding` | Skips the entire onboarding flow and activates the user. |
| `#dv-announcement-container` | Shown in the tour if `#dv-help-tips-container` has `.d-none`. |
| `#dv-help-tips-container` | Shown in the tour if it does **not** have `.d-none`. |
| `#module-menu` | Tour target — Modules Menu. |
| `#btn-open-notification` | Tour target — Notifications button. |
| `#btn-open-account` | Tour target — Profile button. |
| `#dv-quick-links` | Tour target — Quick Links section. |
| `#dv-user-tasks` | Tour target — User Tasks section. |

---

## 7. Onboarding Flow

```
$(document).ready
        │
        ▼
viewModel.getUser()
        │
  ┌─────┴─────┐
 fail        success
  │               │
notify('error')  Set user name, theme logo
                  │
                  ▼
            modal.modal('show')
                  │
          User navigates carousel
                  │
            ┌─────┴───────┐
          Skip           Reach tour step (#dv-onboarding-tour-step)
            │               │
            ▼               ▼
    updateUserStatus()  User clicks Start Tour
    (activate API)          │
                        modal.modal('hide')
                            │
                        Driver.js tour starts
                            │
                    Tour finishes (last step or closed)
                            │
                        updateUserStatus()
                        (activate API)
```

1. The user clicks `#btn-skip-onboarding`.
2. The Driver.js tour's `onDestroyStarted` fires and `userTour.hasNextStep()` returns `false`.

---

## 8. Carousel Navigation

The `slid.bs.carousel` event fires after each slide transition and updates button visibility.

| Active step | `#btn-start-tour` | `#btn-onboarding-next` | `#btn-onboarding-previous` |
|---|---|---|---|
| `#dv-onboarding-welcome-step` | Hidden | Visible | Visible, **disabled** |
| Any middle step | Hidden | Visible | Visible, enabled |
| `#dv-onboarding-tour-step` | Visible | Hidden | Hidden |

> `#btn-onboarding-previous` is also hidden on mobile (< 768px) via CSS regardless of carousel state.

---

## 9. Guided Tour Steps

The tour launches using `window.driver.js.driver` and runs 6 or 7 steps depending on which container is visible on the page.

| # | Element | Title | Side | Align |
|---|---|---|---|---|
| 1 | `#module-menu` | Modules Menu | `bottom` | `center` (mobile ≤ 768px) / `end` (desktop) |
| 2 | `#btn-open-notification` | Notifications | `bottom` | `end` |
| 3 | `#btn-open-account` | Profile | `bottom` | `end` |
| 4 | `#dv-announcement-container` *(if help tips hidden)* | Announcements | `left` | `start` |
| 4 | `#dv-help-tips-container` *(if visible)* | Help Tips | `left` | `start` |
| 5 | `#dv-quick-links` | Quick Links | `right` | `start` |
| 6 | `#dv-user-tasks` | User Tasks | `top` | `center` |
| 7 | *(no element)* | — | — | — |


**Step 7 (finish card)** has no `element` anchor. It renders an inline HTML popover with:
- An illustration image from the CDN (`/content/images/illustrations/home.start.onboarding.finish.svg`)
- Heading: `"You're all set!"`
- Body: `"That's a wrap on the tour..."`

The tour instance is stored globally as `window.userTour`.

---

## 10. Driver.js Configuration

```javascript
{
    showProgress        : true,
    allowClose          : false,
    smoothScroll        : true,
    allowKeyboardControl: true,
    doneBtnText         : 'Finish',
    steps               : steps,
    onDestroyStarted    : () => {
        if (!userTour.hasNextStep()) {
            updateUserStatus();
            userTour.destroy();
        }
    }
}
```

| Option | Value | Effect |
|---|---|---|
| `showProgress` | `true` | Shows step counter (e.g. "3 / 7") in the popover |
| `allowClose` | `false` | Prevents closing the tour by clicking the overlay |
| `smoothScroll` | `true` | Scrolls smoothly to each highlighted element |
| `allowKeyboardControl` | `true` | Arrow keys navigate the tour |
| `doneBtnText` | `'Finish'` | Label for the button on the last step |
| `onDestroyStarted` | Guard + activate | Only activates the user when there is no next step (prevents premature activation on mid-tour close attempts) |

---

## 11. User Activation

`updateUserStatus()` is the private function called on both skip and tour completion:

```javascript
function updateUserStatus() {
    if (user && user.Id) {
        return viewModel.activate(user.Id);
    }
}
```

It guards against calling `activate` before the user data is loaded. The returned Promise is not awaited in skip/close flows.

---

## 12. ViewModel API

`UserOnboardingUpdateViewModel` is a plain constructor function (not a class). It sets `globalURI.baseURI = '/start'` on instantiation, scoping all subsequent `buildURI` calls to the `/start` scope.

### `getUser()`

Fetches the onboarding user record for the current session.

```javascript
const viewModel = new UserOnboardingUpdateViewModel();
const response  = await viewModel.getUser();
// response.data = { Id: 42, Fullname: 'Juan dela Cruz', ... }
```



---

### `activate(id)`

Marks the user as activated (onboarding complete), preventing the modal from showing again.

```javascript
await viewModel.activate(user.Id);
```

| Parameter | Type | Description |
|---|---|---|
| `id` | `number` | The user's ID from `getUser()` response. |



---

## 13. CSS — Modal

### `#dv-onboarding-modal .modal-body`

Fixed height of `34rem` to maintain a consistent modal size across all carousel steps.

### `#dv-onboarding-modal .modal-header` / `.modal-footer`

Both borders are removed (`border-bottom: none`, `border-top: none`) for a cleaner full-bleed look.

### `.carousel-item`

`height: 100%` ensures each slide fills the full modal body height.

### `#btn-onboarding-previous` (mobile)

Hidden with `display: none` on viewports narrower than `768px`.

---

## 14. CSS — Carousel Indicators

Custom dot-style indicators replace Bootstrap's default bar indicators:

| Property | Value |
|---|---|
| `width` / `height` | `10px` (circular) |
| `border-radius` | `50%` |
| `background-color` (inactive) | `var(--vds-tertiary-color)` |
| `transition` | `background-color 0.3s ease` |


| Theme | Active color |
|---|---|
| `html[data-bs-theme="light"]` | `#272727` (near black) |
| `html[data-bs-theme="dark"]` | `white` |

Indicators switch from `position: absolute` (Bootstrap default) to `position: relative` with `margin-top: 24px` to prevent overlap with carousel content.

---

## 15. CSS — Driver.js Overrides

Same overrides as in `application.feature-onboarding.css`:

| Rule | Effect |
|---|---|
| `.driver-popover :is(header, footer)` | Forces `visibility: visible` |
| `.driver-popover *` | `font-family: inherit` |
| `.driver-popover .vi-solid` | `font-family: voyadores-icon-solid` |
| `.driver-popover` (≥ 768px) | Fixed `min-width` / `max-width: 30rem` |
| `.btn-primary:active` | `background-color: var(--vds-btn-active-bg) !important` |

### Carousel desktop navigation hide

```css
#dv-onboarding-modal .carousel-item:nth-child(3):has(.active) #dv-desktop-navigation {
    display: none;
}
```

Hides `#dv-desktop-navigation` when the third carousel slide is active.

---

## 16. CSS — Onboarding Images

Images inside `#dv-onboarding-welcome-step` and `#dv-onboarding-tour-step` are sized based on viewport height:

| Selector | Default width | Width at viewport height ≥ 600px |
|---|---|---|
| `#dv-onboarding-welcome-step img` | `260px` | `360px` |
| `#dv-onboarding-tour-step img` | `260px` | `330px` |

---

## 17. Required DOM Elements

See [section 6](#6-required-dom-elements) for the full table. Summary of elements the CSS targets directly:

| Selector | CSS concern |
|---|---|
| `#dv-onboarding-modal .modal-body` | Fixed `34rem` height |
| `#dv-onboarding-modal .modal-header` | No bottom border |
| `#dv-onboarding-modal .modal-footer` | No top border |
| `#btn-onboarding-previous` | Hidden on mobile |
| `#dv-onboarding-carousel .carousel-indicators` | Short-viewport repositioning |
| `#dv-onboarding-welcome-step img` | Responsive width |
| `#dv-onboarding-tour-step img` | Responsive width |

---

## 18. Global Dependencies

| Global | Used in | Description |
|---|---|---|
| `globalRequest.get(url, params?)` | `getUser`, `activate` | Performs GET requests and returns Promises |
| `globalURI.baseURI` | `UserOnboardingUpdateViewModel` | Set to `'/start'` on instantiation |
| `globalURI.buildURI(action)` | `getUser`, `activate` | Constructs scoped API URLs |
| `window.driver.js.driver` | `application.user-onboarding.js` | Driver.js factory function |
| `notify(message, type)` | `application.user-onboarding.js` | Application notification utility |
| `window.userTour` | `application.user-onboarding.js` | Tour instance stored globally for external access |

---

## 19. Full Example

### Minimal page structure

```html
<!DOCTYPE html>
<html data-bs-theme="light">
<head>
    <link rel="stylesheet" href="/css/bootstrap/bootstrap.voyadores.theme.min.css" />
    <link rel="stylesheet" href="/css/application/application.user-onboarding.css" />
</head>
<body>

    <!-- CDN base URL -->
    <input type="hidden" id="voyadores-cdn-url" value="https://cdn.voyadores.com" />

    <!-- Tour targets (must be present in DOM) -->
    <nav id="module-menu">...</nav>
    <button id="btn-open-notification">...</button>
    <button id="btn-open-account">...</button>
    <div id="dv-help-tips-container">...</div>
    <div id="dv-announcement-container" class="d-none">...</div>
    <div id="dv-quick-links">...</div>
    <div id="dv-user-tasks">...</div>

    <!-- Onboarding modal -->
    <div id="dv-onboarding-modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">

                <div class="modal-header">
                    <img id="img-voyadores-logo" src="" alt="Voyadores" />
                </div>

                <div class="modal-body p-0">
                    <div id="dv-onboarding-carousel" class="carousel slide" data-bs-interval="false">

                        <div class="carousel-inner">

                            <!-- Step 1: Welcome -->
                            <div id="dv-onboarding-welcome-step" class="carousel-item active">
                                <div class="text-center p-5">
                                    <img src="..." alt="Welcome" />
                                    <h4>Welcome, <span id="spn-user-name"></span>!</h4>
                                    <p>Let's get you started with a quick tour.</p>
                                </div>
                            </div>

                            <!-- Step 2: Features overview -->
                            <div class="carousel-item">
                                <div class="p-5">
                                    <p>Explore your dashboard and tools.</p>
                                </div>
                            </div>

                            <!-- Step 3: Tour prompt -->
                            <div id="dv-onboarding-tour-step" class="carousel-item">
                                <div class="text-center p-5">
                                    <img src="..." alt="Take the tour" />
                                    <p>Want a guided walkthrough?</p>
                                </div>
                            </div>

                        </div>

                        <!-- Carousel indicators -->
                        <div class="carousel-indicators" id="dv-onboarding-carousel-indicators">
                            <button type="button" data-bs-target="#dv-onboarding-carousel" data-bs-slide-to="0" class="active"></button>
                            <button type="button" data-bs-target="#dv-onboarding-carousel" data-bs-slide-to="1"></button>
                            <button type="button" data-bs-target="#dv-onboarding-carousel" data-bs-slide-to="2"></button>
                        </div>

                    </div>
                </div>

                <div class="modal-footer justify-content-between">
                    <button id="btn-skip-onboarding" class="btn btn-link text-secondary">Skip</button>
                    <div class="d-flex gap-3">
                        <button id="btn-onboarding-previous"
                                class="btn btn-outline-secondary"
                                data-bs-target="#dv-onboarding-carousel"
                                data-bs-slide="prev">Previous</button>
                        <button id="btn-onboarding-next"
                                class="btn btn-primary"
                                data-bs-target="#dv-onboarding-carousel"
                                data-bs-slide="next">Next</button>
                        <button id="btn-start-tour" class="btn btn-primary d-none">Start Tour</button>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <script src="/js/jquery/jquery.min.js"></script>
    <script src="/js/bootstrap/bootstrap.bundle.min.js"></script>
    <script src="/js/driver/driver.js.iife.js"></script>
    <script src="/js/application/application.user-onboarding.update.js"></script>
    <script src="/js/application/application.user-onboarding.js"></script>

</body>
</html>
```

### Accessing the tour instance externally

After the tour starts, the Driver.js instance is available globally:

```javascript
// Programmatically advance to the next step
window.userTour.moveNext();

// Destroy the tour early
window.userTour.destroy();
```
