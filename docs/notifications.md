---
title: "Notifications"
version: "1.0.0"
files: "`dist/js/application/application.notifications.js` · `dist/js/application/application.notifications.get.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Notifications module manages the in-app notification dropdown and badge count. It polls the server every 60 seconds for the latest notifications, renders them in a Repeater list, handles mark-as-read and mark-all-as-read actions, and syncs the badge count with a service worker via `BroadcastChannel`.

The module does **not** run on the dedicated notifications page (`/user/notifications`) — it is intended for the global navbar dropdown only.

---

## 2. Features

| Feature | Description |
|---|---|
| Polling | Fetches notifications every 60 seconds; runs immediately on first load |
| In-memory cache | Up to 5 most recent notifications kept in the `notifications` array |
| Repeater integration | Uses the `Repeater` jQuery plugin to render and refresh the notification list |
| Mark as read | Individual notification click marks as read and redirects |
| Mark all as read | Bulk action marks all unread notifications read and updates UI state |
| Badge count | Shows/hides unread count (capped at `99+`) on the notification button |
| Service worker sync | Sends `updateBadge` messages via `BroadcastChannel("service-worker")` |
| Browser notification permission | Requests `Notification` permission on hover (desktop) or click (mobile) |
| Avatar rendering | Shows initials by default; replaces with avatar image when loaded |
| Relative timestamps | Notification times displayed as relative strings via Moment.js |

---

## 3. Dependencies

| Library / Global | Required | Description |
|---|---|---|
| jQuery | **Yes** | DOM queries, event binding, `$.callAsync`, `.clickAsync`, `.repeater` |
| Moment.js | **Yes** | Relative time formatting (`moment().from()`) |
| `globalRequest` | **Yes** | Passed as the `httpClient` to the ViewModel |
| Repeater plugin | **Yes** | `$.fn.repeater` used to render and refresh the notification list |
| `$.callAsync` | **Yes** | Async wrapper for ViewModel calls |
| `$.fn.clickAsync` | **Yes** | Async click handler with built-in loader/reset helpers |

---

## 4. Files

| File | Description |
|---|---|
| `application.notifications.js` | Main controller — polling, event binding, UI rendering, service worker messaging |
| `application.notifications.get.js` | `UserNotificationGetViewModel` — wraps API calls via `ViewModelBase` |

---

## 5. Setup

```html
<!-- Before closing </body> -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/moment/moment.min.js"></script>
<script type="module" src="/js/application/application.notifications.js"></script>
```

The module uses top-level `await` and runs automatically on import. No initialization call is needed.

---

## 6. Required DOM Elements

| Element | Description |
|---|---|
| `#ul-notification-menu` | Container for the notification list. Initialized as a Repeater. |
| `#btn-open-notification` | Notification trigger button. Used to request browser notification permission. |
| `#btn-notification-mark-all-as-read` | "Mark all as read" button. Shown/hidden based on unread count. |
| `#dv-notification-menu-badge-count` | Badge element showing the unread count. Shown/hidden based on unread count. |

### Dynamically generated elements

Each notification item renders inside `#ul-notification-menu` as a `<li>`. The notification's sender container uses the notification `Id` as the element `id` and is updated asynchronously if an avatar image loads successfully.

---

## 7. In-App Notification States

| Constant | Value | Meaning |
|---|---|---|
| `InAppState.Unread` | `7` | Notification has not been read |
| `InAppState.Read` | `6` | Notification has been read |

These values are read from each notification's `State` property and are also set as `data-status` attributes on `.btn-read` elements.

---

## 8. Polling Behavior

On pages **other than** `/user/notifications`, the module:

1. Calls `notificationInterval()` immediately (top-level `await`).
2. Sets a `setInterval` to repeat every **60 seconds**.

On the `/user/notifications` page, no polling runs — the dedicated page manages its own data.

### `notificationInterval()` flow

```
1. Clear notifications[] array
2. GET /user/get-all-notifications
3. Count unread (State === 7)
4. Push first 5 notifications into notifications[]
5. refreshNotification(notifications)
6. handleHasUnreadNotifications(unreadCount)
7. BroadcastChannel → { action: "updateBadge", count: unreadCount }
```

---

## 9. Mark as Read

Clicking any `.btn-read` element inside `#ul-notification-menu`:

```
Click .btn-read
    │
    ├── State === InAppState.Read (6)?
    │       └── YES → location.href = data-redirect-to
    │
    └── NO (Unread)
            │
            ▼
    POST /user/read  { id }
            │
    response truthy? → location.href = data-redirect-to
```

The `.btn-read` element must carry three data attributes:

| Attribute | Description |
|---|---|
| `data-id` | Notification ID |
| `data-status` | Current state value (`6` or `7`) |
| `data-redirect-to` | URL to navigate to after marking read |

---

## 10. Mark All as Read

`#btn-notification-mark-all-as-read` uses `.clickAsync` which provides `loader` and `reset` callbacks:

```
1. loader()  — shows loading state on the button
2. POST /user/read-all
3. If response truthy:
   a. Update all Unread notifications in notifications[] → State = Read
   b. handleHasUnreadNotifications(0)
   c. refreshNotification(notifications)
4. Remove .notification-unread from all list items
5. Add .notification-time-unread to all .spn-notification-time elements
6. reset()  — restores button to default state
```

---

## 11. Badge & Service Worker Updates

`handleHasUnreadNotifications(count)` manages the badge and mark-all button visibility, and posts a message to the `BroadcastChannel("service-worker")` after every state change.

| Condition | Badge | Mark-all button | Service worker message |
|---|---|---|---|
| `count > 0` | Shown with count (max `"99+"`) | Shown (remove `d-none`) | `{ action: "updateBadge", count }` |
| `count === 0` | Hidden (add `d-none`) | Hidden (add `d-none`) | `{ action: "updateBadge", count: 0 }` |

The service worker channel also receives a `count: 0` message when the notification list is empty on first render.

---

## 12. Notification List Rendering

`buildNotificationMenuListHTML(notifications)` iterates the notifications array and generates `<li>` HTML for each item.

### Rendered HTML structure per notification

```html
<li class="nav-item">
    <a class="btn-read nav-link fs-3 fs-lg-5 p-3 d-flex gap-4 rounded [notification-unread]"
       href="javascript:void(0)"
       data-id="{id}"
       data-status="{state}"
       data-redirect-to="{metadata.RedirectPath}">

        <!-- Avatar container (id used by buildAvatarContainer) -->
        <div id="{notification.Id}">
            <div class="avatar-xl bg-white border rounded-circle d-grid place-items-center flex-shrink-0 position-relative">
                <span class="text-black">{initials}</span>
                <span class="position-absolute bottom-0 end-0 p-2 bg-primary rounded-circle">
                    <div class="vi-regular {metadata.PageIcon} text-black fs-6"></div>
                </span>
            </div>
        </div>

        <!-- Content -->
        <div class="vstack">
            <span class="spn-notification-message fs-6">{notification.Intent}</span>
            <span class="spn-notification-time small [notification-time-unread]">{relativeTime}</span>
        </div>
    </a>
</li>
```

- `.notification-unread` is added when `State === InAppState.Unread` (`7`).
- `.notification-time-unread` is added to the time span when `State === InAppState.Read` (`6`).
- Relative time is formatted as `moment(notification.CreatedAt).from(moment())`.

### Avatar image replacement

`buildAvatarContainer(id, pageIcon, filePath)` is called for each notification. If `filePath` is truthy (built from `notification.AccountFilePath + '/' + metadata.ImageFilename`), an `<img>` element is created. When the image loads successfully, the initials container (`#${id}`) is replaced with the avatar image HTML.

---

## 13. Notification Object Shape

Each notification in `response.data` is expected to have the following structure:

| Property | Type | Description |
|---|---|---|
| `Id` | `number \| string` | Unique notification ID. Also used as the DOM element ID for avatar replacement. |
| `State` | `number` | `7` = Unread, `6` = Read |
| `Intent` | `string` | The notification message text. |
| `Sender` | `string` | Full name of the sender. Used to generate initials. |
| `CreatedAt` | `string` | ISO timestamp. Formatted as relative time via Moment.js. |
| `AccountFilePath` | `string` | Base path for the sender's avatar image. |
| `UnserializedMetadata` | `object` | Deserialized metadata object. |
| `UnserializedMetadata.PageIcon` | `string` | Voyadores icon class name (e.g. `"vi-invoice"`). |
| `UnserializedMetadata.RedirectPath` | `string` | URL to navigate to when the notification is clicked. |
| `UnserializedMetadata.ImageFilename` | `string \| null` | Avatar image filename. Combined with `AccountFilePath` if present. |

---

## 14. Browser Notification Permission

`askNotificationPermission()` calls `Notification.requestPermission()` when the Web Notifications API is available. It is bound to `#btn-open-notification` based on screen width:

| Viewport | Event | Behavior |
|---|---|---|
| ≥ 992px (desktop) | `hover` | Permission prompt on hover |
| < 992px (mobile) | `click` | Permission prompt on click |

The binding is re-evaluated on every `$(window).resize` event. Previous listeners are removed with `.off('hover click')` before re-binding.

If the browser does not support `Notification`, a message is logged to the console.

---

## 15. ViewModel API

`UserNotificationGetViewModel` extends `ViewModelBase` with `basePath = '/user'`.

### `getAllNotifications()`

Fetches all notifications for the current user.

```javascript
const response = await $.callAsync(getViewModel.getAllNotifications);
// response.data = [{ Id, State, Intent, Sender, CreatedAt, ... }, ...]
```


---

### `readAll()`

Marks all notifications as read for the current user.

```javascript
const response = await $.callAsync(getViewModel.readAll);
```


---

### `read(id)`

Marks a single notification as read.

```javascript
const response = await $.callAsync(getViewModel.read, id);
```

| Parameter | Type | Description |
|---|---|---|
| `id` | `number \| string` | The notification ID to mark as read. |



---

## 16. API Endpoints

| Method | URL | Description |
|---|---|---|
| `GET` | `/user/get-all-notifications` | Returns all notifications for the current user |
| `POST` | `/user/read-all` | Marks all notifications as read |
| `POST` | `/user/read` | Marks one notification as read. Body: `{ id }` |

---

## 17. Internal Functions

| Function | Description |
|---|---|
| `askNotificationPermission()` | Calls `Notification.requestPermission()` if supported |
| `addNotificationEventListeners()` | Binds the permission request to `#btn-open-notification` based on viewport width |
| `notificationInterval()` | Fetches notifications, updates the in-memory array, refreshes the UI, and updates the service worker badge |
| `refreshNotification(data)` | Calls `ulNotificationMenu.repeater('refreshData', data)`. Adds custom empty state HTML on first empty load |
| `handleHasUnreadNotifications(count)` | Shows/hides `#dv-notification-menu-badge-count` and `#btn-notification-mark-all-as-read`; posts to service worker |
| `buildNotificationMenuListHTML(notifications)` | Returns HTML string of `<li>` elements for the notification list |
| `buildAvatarContainer(id, pageIcon, filePath)` | Replaces the initials `<div>` with an avatar `<img>` on successful image load |
| `getInitials(fullName)` | Returns two-letter uppercase initials from a full name (first + last word) |

---

## 18. Global Dependencies

| Global | Used for |
|---|---|
| `globalRequest` | Passed as `httpClient` to `UserNotificationGetViewModel` |
| `$.callAsync` | Wrapping async ViewModel calls |
| `$.fn.clickAsync` | Async click handler with loader/reset on the mark-all button |
| `$.fn.repeater` | Rendering and refreshing the notification list |

---

## 19. Full Example

### Required HTML

```html
<!-- Notification button in navbar -->
<button id="btn-open-notification" class="btn position-relative">
    <span class="vi-regular vi-bell"></span>
    <span id="dv-notification-menu-badge-count" class="badge d-none">0</span>
</button>

<!-- Notification dropdown -->
<div class="dropdown-menu">
    <div class="d-flex justify-content-between px-3 py-2">
        <span class="fw-semibold">Notifications</span>
        <button id="btn-notification-mark-all-as-read" class="btn btn-sm d-none">
            Mark all as read
        </button>
    </div>
    <ul id="ul-notification-menu" class="list-unstyled mb-0"></ul>
</div>

<!-- Scripts -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/moment/moment.min.js"></script>
<script type="module" src="/js/application/application.notifications.js"></script>
```

### Service worker badge handler

The module sends `BroadcastChannel` messages to a `"service-worker"` channel. In your service worker:

```javascript
// service-worker.js
const channel = new BroadcastChannel('service-worker');

channel.addEventListener('message', (event) => {
    if (event.data.action === 'updateBadge') {
        const count = event.data.count;
        if ('setAppBadge' in navigator) {
            count > 0
                ? navigator.setAppBadge(count)
                : navigator.clearAppBadge();
        }
    }
});
```

### Using the ViewModel directly

```javascript
import UserNotificationGetViewModel from '/js/application/application.notifications.get.js';

const vm = new UserNotificationGetViewModel('/user', globalRequest);

// Fetch all
const response = await $.callAsync(vm.getAllNotifications);
console.log(response.data);

// Mark one as read
await $.callAsync(vm.read, 42);

// Mark all as read
await $.callAsync(vm.readAll);
```
