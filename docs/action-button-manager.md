---
title: "Action Button Manager"
version: "1.0.0"
files: "`action-button-manager.min.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-01-09"
---

## 1. Overview

`ActionButtonManager` is an ES6 class that manages the rendering of context-aware action buttons inside data tables. It solves the problem of showing the right buttons for the right row state (e.g., "active" vs. "pending") while automatically adapting the layout between desktop and mobile viewports.

On **desktop**, it renders an inline button group with an overflow dropdown for extra actions. On **mobile**, it renders a single button that opens a Bootstrap Offcanvas side menu listing all available actions.

---

## 2. Features

- Responsive rendering — automatically switches between desktop and mobile layouts at a configurable breakpoint
- State-based button visibility — show different buttons for different row states
- Per-button visibility conditions — fine-grained control via `visibilityCondition` callbacks
- Permission-based filtering — integrates with any permission manager
- Context passing — row data flows from the table cell through button click to handler
- Desktop overflow dropdown — excess buttons collapse into a `⋮` more-actions menu
- Mobile offcanvas — multiple actions presented in a Bootstrap Offcanvas side drawer
- XSS protection — all user-controlled values HTML-escaped before rendering
- Delegated event handling — works with dynamically rendered tables without re-attaching
- Chainable API — method calls can be chained
- Subclass-friendly — extend with `_initializeDefaultButtons()` for reusable managers
- Auto-closing — dropdown and offcanvas close automatically after action execution

---

## 3. Dependencies

| Library | Version | Required |
|---|---|---|
| jQuery | 3.x | **Yes** |
| Bootstrap | 5.3.x | **Yes** (Dropdown, Offcanvas, Tooltip) |

Both must be available as globals (`$`, `bootstrap`) before the module is imported.

---

## 4. Setup

The file uses an ES6 named export. Import it as a module:

```html
<!-- In <head> or as module script -->
<script type="module">
  import { ActionButtonManager } from '/js/action-button-manager/action-button-manager.min.js';

  const manager = new ActionButtonManager({ /* config */ });
</script>
```

Or bundle it with your project's build system (Webpack, Vite, Rollup, etc.):

```javascript
import { ActionButtonManager } from './action-button-manager.min.js';
```

---

## 5. Required HTML Structure

### Table cell (where buttons are injected)

Your `mappingFunction` in the table plugin should call `manager.render()` and inject the result into the actions cell:

```html
<td class="col-icon">
  <!-- manager.render() output goes here -->
</td>
```

### Offcanvas element (mobile)

Place this **once** per page (typically in the layout or page template). The selector must match `offcanvasSelector` in the config (default: `#dv-actions-offcanvas`).

```html
<div class="offcanvas offcanvas-bottom" tabindex="-1" id="dv-actions-offcanvas" aria-labelledby="dv-actions-offcanvas-label">
  <div class="offcanvas-header border-bottom">
    <h5 class="offcanvas-title" id="dv-actions-offcanvas-label">Actions</h5>
    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body">
    <!-- Populated dynamically by ActionButtonManager -->
  </div>
</div>
```

> **Required elements inside the offcanvas:**
> - `.offcanvas-title` — updated with the row title when the drawer opens
> - `.offcanvas-body` — replaced with button HTML when the drawer opens

---

## 6. Constructor & Configuration

```javascript
const manager = new ActionButtonManager(config);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `breakpoint` | `number` | `992` | Viewport width (px) below which mobile layout is used. Matches Bootstrap's `lg` breakpoint. |
| `offcanvasSelector` | `string` | `"#dv-actions-offcanvas"` | jQuery selector for the offcanvas element used in mobile view. |
| `permissionManager` | `object \| null` | `null` | Optional permission manager. Must implement `hasPermission(permission: string): boolean`. |

```javascript
const manager = new ActionButtonManager({
  breakpoint: 768,                          // Switch at md breakpoint instead
  offcanvasSelector: '#my-offcanvas',       // Custom offcanvas element
  permissionManager: myPermissionService,   // Optional permission integration
});
```

---

## 7. Registering Buttons

Register every possible action button before calling `render()`. Buttons must be registered first — they won't appear otherwise.

```javascript
manager.registerButton(id, config);
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the button. Used to reference it in states and in the click handler via `data-action`. |
| `config` | `object` | Button configuration (see properties below). |

### Button Configuration Properties

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `label` | `string` | **Yes** | — | Display text. Shown in tooltips (desktop), dropdown items, and offcanvas buttons. |
| `icon` | `string` | No | `""` | CSS icon class (e.g. `"vi-regular vi-pen"`) or raw SVG string starting with `<svg`. CSS classes render as `<span class="..."></span>`. Only use trusted SVG sources. |
| `cssClass` | `string` | No | `""` | Additional CSS classes added to the `<button>` element. |
| `handler` | `function` | No | — | Click handler. Receives `(context, $button)`. If omitted, the click event bubbles normally for external listeners. |
| `visibilityCondition` | `function` | No | `() => true` | Function receiving the row `context` object. Return `true` to show the button, `false` to hide it. |
| `dataAttributes` | `object \| function` | No | `{}` | Data attributes to embed in the button HTML. Can be a static object or a function `(context) => object`. These are extracted back into the `context` parameter when the button is clicked. |
| `permission` | `string` | No | `null` | Permission key. If set, the button only renders when `permissionManager.hasPermission(key)` returns `true`. |
| `order` | `number` | No | `999` | Display order within a state. Lower numbers appear first. Buttons with the same order retain their registration order. |

### Method chaining

`registerButton` returns `this`, so calls can be chained:

```javascript
manager
  .registerButton('edit', {
    label: 'Edit',
    icon: 'vi-regular vi-pen',
    cssClass: 'text-primary',
    order: 1,
    handler(context, $btn) {
      openEditModal(context.EmployeeId);
    },
  })
  .registerButton('delete', {
    label: 'Delete',
    icon: 'vi-regular vi-trash',
    cssClass: 'text-danger',
    order: 2,
    permission: 'employees.delete',
    handler(context, $btn) {
      confirmDelete(context.EmployeeId);
    },
  });
```

---

## 8. Registering States

States control which buttons are shown for each row condition. A state is a named group of button IDs.

```javascript
manager.registerState(stateName, buttonIds);
```

| Parameter | Type | Description |
|---|---|---|
| `stateName` | `string` | Unique state name. Pass this to `render()` to select which buttons show. |
| `buttonIds` | `string[]` | Array of button IDs (matching those registered with `registerButton`) to include in this state. |

```javascript
manager
  .registerState('active',   ['edit', 'deactivate', 'delete', 'view-history'])
  .registerState('inactive', ['activate', 'delete'])
  .registerState('pending',  ['approve', 'reject', 'view']);
```

A button ID can appear in multiple states. The `visibilityCondition` on the button provides additional per-row filtering within a state.

---

## 9. Rendering Buttons

Call `render()` inside your table's `mappingFunction` for each row.

```javascript
const html = manager.render(state, context, options);
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `state` | `string` | — | State name (from `registerState`) to determine which buttons to render. |
| `context` | `object` | `{}` | Row data. Passed to `visibilityCondition`, `dataAttributes` functions, and the click `handler`. |
| `options` | `object` | `{}` | Rendering options (see below). |

### Render Options

| Option | Type | Default | Description |
|---|---|---|---|
| `maxInline` | `number` | `3` | Maximum buttons to show inline on desktop before collapsing the rest into a dropdown. |
| `label` | `string` | — | Optional text label to show next to the `⋮` icon on the mobile offcanvas trigger button. |
| `title` | `string` | — | Title shown in the offcanvas header when the drawer opens on mobile. |

### Return value

Returns an HTML string ready to inject into a table cell. Returns `""` if there are no visible buttons or if the instance has been disposed.

### Example in mappingFunction

```javascript
$('#employeeTable').table({
  endpoint: '/api/employees',
  mappingFunction(data) {
    return data.map(row => `
      <tr>
        <td>${row.name}</td>
        <td>${row.department}</td>
        <td>
          ${manager.render(
            row.isActive ? 'active' : 'inactive',
            {
              employeeId: row.id,
              employeeName: row.name,
              isActive: row.isActive,
            },
            {
              maxInline: 3,
              title: row.name,
            }
          )}
        </td>
      </tr>
    `).join('');
  },
});
```

---

## 10. Rendering Logic by Viewport

The viewport is checked dynamically on every `render()` call using `window.innerWidth`.

### Desktop (viewport > breakpoint)

| Visible buttons | Result |
|---|---|
| ≤ `maxInline` | All buttons rendered inline in a `<div class="btn-group">` |
| > `maxInline` | First `(maxInline - 1)` buttons inline + a `⋮` dropdown for the rest |

- Buttons 1–2 rendered inline
- Buttons 3–5 in the `⋮` dropdown

### Mobile (viewport ≤ breakpoint)

| Visible buttons | Result |
|---|---|
| 1 | Button rendered directly with desktop (`btn btn-outline-secondary`) styling |
| > 1 | A single `⋮` button that opens the offcanvas drawer |

### Desktop button HTML

```html
<div class="btn-group" role="group">
  <button type="button" class="[cssClass] btn btn-outline-secondary"
          data-action="edit"
          data-toggle="tooltip" data-bs-placement="top" title="Edit"
          data-employee-id="42">
    <span class="vi-regular vi-pen"></span>
  </button>
  <!-- More inline buttons... -->
  <!-- Overflow dropdown trigger -->
  <button type="button" class="btn btn-outline-secondary px-0 w-auto"
          data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"
          aria-label="More actions">
    <span class="vi-solid vi-more-vertical"
          data-toggle="tooltip" data-bs-placement="top" title="More Actions"></span>
  </button>
  <ul class="dropdown-menu">
    <li>
      <button type="button" class="dropdown-item hstack gap-3" data-action="delete">
        <span class="vi-regular vi-trash"></span>Delete
      </button>
    </li>
  </ul>
</div>
```

### Mobile offcanvas trigger HTML

```html
<button type="button"
        class="btn btn-outline-secondary btn-open-action-offcanvas"
        data-bs-toggle="offcanvas"
        data-bs-target="#dv-actions-offcanvas"
        data-offcanvas-state="active"
        data-offcanvas-title="Maria Santos"
        data-employee-id="42"
        aria-label="Open actions menu">
  <span class="vi-solid vi-more-vertical"></span>
</button>
```

---

## 11. Offcanvas (Mobile) Integration

When the mobile offcanvas trigger is clicked, Bootstrap fires `show.bs.offcanvas`. The manager listens to this event and automatically calls `populateOffcanvas()` using the state and context data stored in the trigger button's data attributes.

**You do not need to call `populateOffcanvas()` manually** when using `render()` — it is wired up automatically.

### Manual offcanvas population

Use `populateOffcanvas()` if you need to trigger it outside of the normal button-click flow:

```javascript
manager.populateOffcanvas(state, context);
```

| Parameter | Type | Description |
|---|---|---|
| `state` | `string` | State name to determine which buttons to render in the offcanvas. |
| `context` | `object` | Row data. Use `context.title` to set the offcanvas header title. |

```javascript
manager.populateOffcanvas('active', {
  title: 'Maria Santos',
  employeeId: 42,
  isActive: true,
});
```

### Offcanvas button layout

Buttons inside the offcanvas use `dropdown-item hstack gap-4 py-4` styling with labels visible:

```html
<button type="button"
        class="[cssClass] dropdown-item hstack gap-4 py-4"
        data-action="edit"
        data-toggle="tooltip" data-bs-placement="top" title="Edit"
        data-employee-id="42">
  <span class="vi-regular vi-pen"></span>
  <span>Edit</span>
</button>
```

---

## 12. Event Handling & Context

### How handlers are attached

Event handlers are attached using jQuery event delegation (`$(document).on('click.actionButtons', '[data-action]', ...)`). This means they work on dynamically rendered table rows without needing to re-attach after each table refresh.

Handlers are attached **once** on the first `render()` or `populateOffcanvas()` call. Subsequent calls do not re-attach.

### How context flows to handlers

When a button is clicked, the manager reads all `data-*` attributes from the button element and converts them into a context object. This is the same object passed back to the `handler` function.


| HTML data attribute | JS dataset key | Context key (PascalCase) |
|---|---|---|
| `data-employee-id` | `employeeId` | `EmployeeId` |
| `data-is-active` | `isActive` | `IsActive` |
| `data-department-name` | `departmentName` | `DepartmentName` |


| Raw string value | Converted type |
|---|---|
| `"42"` | `42` (integer) |
| `"-5"` | `-5` (negative integer) |
| `"3.14"` | `3.14` (float) |
| `"true"` | `true` (boolean) |
| `"false"` | `false` (boolean) |
| Any other string | remains a string |

**Reserved keys** are automatically excluded from the context object and should not be used as data attribute names:

| Excluded key | Reason |
|---|---|
| `offcanvasState` | Internal state tracking |
| `offcanvasTitle` | Internal title tracking |
| `bsToggle` | Bootstrap internal |
| `bsTarget` | Bootstrap internal |
| `bsPlacement` | Bootstrap internal |
| `toggle` | Tooltip internal |
| `placement` | Tooltip internal |
| `action` | Manager action identifier |

### Handler signature

```javascript
handler(context, $button) {
  // context: extracted data attributes as PascalCase object
  // $button: jQuery-wrapped button element that was clicked
}
```

```javascript
manager.registerButton('view', {
  label: 'View',
  icon: 'vi-regular vi-eye',
  dataAttributes(context) {
    return {
      invoiceId:  context.invoiceId,
      customerId: context.customerId,
    };
  },
  handler(context, $btn) {
    // context.InvoiceId  → number (auto-coerced from data-invoice-id)
    // context.CustomerId → number (auto-coerced from data-customer-id)
    openInvoiceModal(context.InvoiceId);
  },
});
```

### Auto-close behavior

- **Dropdown:** After a button inside the dropdown menu is clicked, the dropdown is closed via `bootstrap.Dropdown.getInstance().hide()`.
- **Offcanvas:** After a button inside the offcanvas is clicked, the offcanvas is closed via `bootstrap.Offcanvas.getOrCreateInstance().hide()`.

If a button has **no handler** registered, the click event bubbles normally (not prevented). In the offcanvas, the offcanvas is still closed even for handler-less buttons.

---

## 13. Permission-Based Access Control

Pass a `permissionManager` object to the constructor. It must implement a single method:

```typescript
interface PermissionManager {
  hasPermission(permission: string): boolean;
}
```

Buttons with a `permission` property are only rendered if the permission manager returns `true` for that key. If no `permissionManager` is configured, all buttons are treated as permitted.

```javascript
// Example permission manager
const permissions = {
  hasPermission(key) {
    return userPermissions.includes(key);
  }
};

const manager = new ActionButtonManager({
  permissionManager: permissions,
});

manager.registerButton('delete', {
  label: 'Delete',
  icon: 'vi-regular vi-trash',
  permission: 'records.delete',  // Only shown if user has this permission
  handler(context) { /* ... */ },
});
```

---

## 14. Tooltips

Each button renders with `data-toggle="tooltip"` and `title="[label]"` attributes. After buttons are injected into the DOM, call `initializeTooltips()` to activate them.

```javascript
// After table renders
initializeTooltips(container)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `container` | `Element` | `document` | Root element to search within for tooltip elements. Scope to the table for performance. |

```javascript
// In table's success callback
$('#myTable').table({
  // ...
  success(data) {
    manager.initializeTooltips(document.getElementById('myTable'));
  },
});
```

> **Note:** `initializeTooltips()` creates a new `bootstrap.Tooltip` instance for each button. If your table re-renders frequently, consider scoping the container tightly to avoid processing the entire document.

---

## 15. API Reference

### Instance methods

| Method | Returns | Description |
|---|---|---|
| `registerButton(id, config)` | `this` | Registers a button. Must be called before `render()`. |
| `registerState(stateName, buttonIds)` | `this` | Registers a state with its button IDs. |
| `getVisibleButtons(state, context)` | `Button[]` | Returns sorted array of visible button configs for a state + context. Useful for inspection. |
| `render(state, context, options)` | `string` | Returns rendered HTML for the button group. |
| `populateOffcanvas(state, context)` | `this` | Manually populates the offcanvas with buttons for a given state + context. |
| `attachHandlers(container)` | `this` | Attaches delegated click and offcanvas event handlers. Called automatically on first render. |
| `initializeTooltips(container)` | `this` | Initializes Bootstrap tooltips within the given container. |
| `dispose()` | `this` | Removes all event handlers, clears registries, marks instance as disposed. |
| ~~`updateViewport(width)`~~ | `this` | **Deprecated.** No-op. Viewport is now checked dynamically. |

### Static methods

| Method | Returns | Description |
|---|---|---|
| `ActionButtonManager.create(config)` | `ActionButtonManager` | Factory: creates a base instance with the given config. |
| `ActionButtonManager.create(MyClass, config)` | `MyClass` | Factory: creates an instance of a subclass. |

---

## 16. Extending with Subclasses

Override `_initializeDefaultButtons()` in a subclass to pre-register standard buttons. This is useful when the same set of actions is reused across multiple pages.

```javascript
class EmployeeButtonManager extends ActionButtonManager {
  _initializeDefaultButtons() {
    this
      .registerButton('view', {
        label: 'View',
        icon: 'vi-regular vi-eye',
        order: 1,
        handler(context, $btn) {
          window.location.href = `/employees/${context.EmployeeId}`;
        },
      })
      .registerButton('edit', {
        label: 'Edit',
        icon: 'vi-regular vi-pen',
        order: 2,
        permission: 'employees.edit',
        handler(context, $btn) {
          openEditModal(context.EmployeeId);
        },
      })
      .registerButton('deactivate', {
        label: 'Deactivate',
        icon: 'vi-regular vi-power-off',
        order: 3,
        cssClass: 'text-warning',
        permission: 'employees.edit',
        visibilityCondition: (ctx) => ctx.IsActive === true,
        handler(context, $btn) {
          confirmDeactivate(context.EmployeeId);
        },
      })
      .registerButton('activate', {
        label: 'Activate',
        icon: 'vi-regular vi-power-off',
        order: 3,
        permission: 'employees.edit',
        visibilityCondition: (ctx) => ctx.IsActive === false,
        handler(context, $btn) {
          activateEmployee(context.EmployeeId);
        },
      })
      .registerButton('delete', {
        label: 'Delete',
        icon: 'vi-regular vi-trash',
        order: 4,
        cssClass: 'text-danger',
        permission: 'employees.delete',
        handler(context, $btn) {
          confirmDelete(context.EmployeeId);
        },
      })
      .registerState('active',   ['view', 'edit', 'deactivate', 'delete'])
      .registerState('inactive', ['view', 'activate', 'delete']);
  }
}

// Use the factory method to instantiate
const manager = ActionButtonManager.create(EmployeeButtonManager, {
  permissionManager: myPermissions,
});
```

---

## 17. Lifecycle & Cleanup

### Disposal

Call `dispose()` when the page or component using the manager is torn down. This prevents memory leaks by removing all event listeners and clearing the registries.

```javascript
manager.dispose();

// After disposal, all method calls are no-ops (render returns "", populateOffcanvas warns)
```

### Checking disposal

The manager logs a warning to the console if `render()` or `populateOffcanvas()` is called after disposal. The instance cannot be reused — create a new one.

### Preventing duplicate handlers

The manager uses an internal `_handlersAttached` flag. Even if `attachHandlers()` is called manually multiple times, or `render()` is called repeatedly (e.g., on every table refresh), handlers are only attached once.

---

## 18. Complete Usage Example

This example shows a full employee table integration with states, permissions, visibility conditions, and responsive rendering.

### HTML

```html
<!-- CDN URL for state images (used by table plugin) -->
<input type="hidden" id="voyadores-cdn-url" value="" />

<!-- Table -->
<table id="employeeTable" class="table table-hover table-bordered">
  <thead>
    <tr>
      <th>Name</th>
      <th>Department</th>
      <th>Status</th>
      <th class="col-icon">Actions</th>
    </tr>
  </thead>
  <tbody></tbody>
</table>

<!-- Load more button -->
<button id="loadMoreBtn" class="btn btn-outline-secondary mt-3" style="display:none">
  Load more
</button>

<!-- Offcanvas (mobile) — one per page -->
<div class="offcanvas offcanvas-bottom" tabindex="-1"
     id="dv-actions-offcanvas" aria-labelledby="dv-actions-offcanvas-label">
  <div class="offcanvas-header border-bottom">
    <h5 class="offcanvas-title" id="dv-actions-offcanvas-label">Actions</h5>
    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body"></div>
</div>
```

### JavaScript

```javascript
import { ActionButtonManager } from '/js/action-button-manager/action-button-manager.min.js';

// 1. Create and configure the manager
const manager = new ActionButtonManager({
  permissionManager: {
    hasPermission(key) {
      return window.userPermissions?.includes(key) ?? false;
    },
  },
});

// 2. Register buttons
manager
  .registerButton('view', {
    label: 'View',
    icon: 'vi-regular vi-eye',
    order: 1,
    dataAttributes: (ctx) => ({ employeeId: ctx.employeeId }),
    handler(context) {
      window.location.href = `/employees/${context.EmployeeId}`;
    },
  })
  .registerButton('edit', {
    label: 'Edit',
    icon: 'vi-regular vi-pen',
    order: 2,
    permission: 'employees.edit',
    dataAttributes: (ctx) => ({ employeeId: ctx.employeeId }),
    handler(context) {
      openEditModal(context.EmployeeId);
    },
  })
  .registerButton('approve', {
    label: 'Approve',
    icon: 'vi-regular vi-like',
    order: 3,
    cssClass: 'text-success',
    permission: 'employees.approve',
    dataAttributes: (ctx) => ({ employeeId: ctx.employeeId }),
    handler(context) {
      approveEmployee(context.EmployeeId);
    },
  })
  .registerButton('reject', {
    label: 'Reject',
    icon: 'vi-regular vi-dislike',
    order: 4,
    cssClass: 'text-danger',
    permission: 'employees.approve',
    dataAttributes: (ctx) => ({ employeeId: ctx.employeeId }),
    handler(context) {
      rejectEmployee(context.EmployeeId);
    },
  })
  .registerButton('deactivate', {
    label: 'Deactivate',
    icon: 'vi-regular vi-power-off',
    order: 5,
    permission: 'employees.edit',
    visibilityCondition: (ctx) => ctx.canDeactivate === true,
    dataAttributes: (ctx) => ({ employeeId: ctx.employeeId }),
    handler(context) {
      deactivateEmployee(context.EmployeeId);
    },
  })
  .registerButton('delete', {
    label: 'Delete',
    icon: 'vi-regular vi-trash',
    order: 6,
    cssClass: 'text-danger',
    permission: 'employees.delete',
    dataAttributes: (ctx) => ({ employeeId: ctx.employeeId }),
    handler(context) {
      confirmDelete(context.EmployeeId);
    },
  });

// 3. Register states
manager
  .registerState('active',   ['view', 'edit', 'deactivate', 'delete'])
  .registerState('inactive', ['view', 'edit', 'delete'])
  .registerState('pending',  ['view', 'approve', 'reject']);

// 4. Initialize table with manager
$('#employeeTable').table({
  endpoint: '/api/employees',
  mappingFunction(data) {
    return data.map(row => `
      <tr>
        <td>${row.name}</td>
        <td>${row.department}</td>
        <td>${row.statusLabel}</td>
        <td class="col-icon text-center">
          ${manager.render(
            row.status,
            {
              employeeId:    row.id,
              canDeactivate: row.subordinateCount === 0,
            },
            {
              maxInline: 3,
              title: row.name,
            }
          )}
        </td>
      </tr>
    `).join('');
  },
  success(data) {
    // Initialize tooltips after render
    manager.initializeTooltips(document.getElementById('employeeTable'));
  },
  loadMore: {
    id: 'loadMoreBtn',
    showOnPageSize: 20,
  },
});
```

---

## 19. Debugging & Troubleshooting

### Buttons not rendering

The manager returns `""` if the state has no registered buttons or if no buttons pass visibility/permission checks.

```javascript
// Inspect what's visible for a given state + context
const visible = manager.getVisibleButtons('active', { employeeId: 1 });
console.log(visible); // Should be a non-empty array
```

State names are case-sensitive.

---

### Handlers not firing

The click handler is delegated to `[data-action]`. If the `id` passed to `registerButton()` is not appearing in the rendered HTML, the handler won't trigger.

After `dispose()`, all handlers are removed. Check `manager._isDisposed`.

Since the handler uses delegation, any `stopPropagation()` between the button and `document` will prevent the event from reaching the manager.

---

### Context object has wrong keys or values

The context keys are **PascalCase** (first letter capitalized). For example, `data-employee-id` becomes `EmployeeId` in the handler context.

```javascript
// HTML: data-employee-id="42"
handler(context) {
  console.log(context.EmployeeId); // 42 (number, not "42")
  console.log(context.employeeId); // undefined — wrong case
}
```

---

### Offcanvas not populating on mobile

The manager looks up `$(this.offcanvasSelector)` at handler-attach time. If the offcanvas is added to the DOM after initialization, call `manager.attachHandlers()` manually.

Both are required for `populateOffcanvas()` to update content.

This is added automatically by `_createOffcanvasTrigger()` when `render()` is called. If you're building the trigger manually, include it.

---

### `ActionButtonManager: jQuery is not loaded` warning

jQuery must be available as a global (`$`) before the module is imported. Load jQuery via `<script>` before your module import or ensure it's bundled as a global.

---

### Permission check always returns false

Verify your `permissionManager` is receiving the correct permission strings. Log them:

```javascript
permissionManager: {
  hasPermission(key) {
    console.log('Checking permission:', key);
    return userPermissions.includes(key);
  }
}
```

---

## 20. Best Practices

### Keep `dataAttributes` minimal

Only embed the data the handler actually needs in the button. Avoid passing entire row objects — use the minimum set of IDs and flags required to perform the action.

```javascript
// Good — minimal, targeted
dataAttributes: (ctx) => ({ invoiceId: ctx.invoiceId }),

// Avoid — embeds everything, pollutes the DOM
dataAttributes: (ctx) => ctx,
```

### Use `visibilityCondition` instead of state proliferation

Prefer one state with `visibilityCondition` over many states that differ by one button:

```javascript
// Better — one state, conditional button
manager
  .registerButton('deactivate', {
    visibilityCondition: (ctx) => ctx.IsActive === true,
    // ...
  })
  .registerState('employee', ['view', 'edit', 'deactivate', 'delete']);

// Avoid — two almost-identical states
manager
  .registerState('active',   ['view', 'edit', 'deactivate', 'delete'])
  .registerState('active-no-deactivate', ['view', 'edit', 'delete']);
```

### Initialize tooltips after every table render

Tooltips must be re-initialized after every table refresh because old DOM elements are replaced. Use the `success` callback:

```javascript
success(data) {
  manager.initializeTooltips(document.getElementById('myTable'));
},
```

### Dispose on page/component teardown

If using a SPA or long-lived pages that dynamically mount/unmount components, always call `dispose()` when tearing down the page to prevent ghost event listeners:

```javascript
// On page unload or component teardown
manager.dispose();
```

### Use `order` to control button priority on mobile

On mobile, the `render()` output is a single trigger button — the actual action list in the offcanvas is ordered by `order`. Put the most common actions first (lowest `order`) so they appear at the top of the drawer.

### Scope `initializeTooltips` to the table

Avoid calling `initializeTooltips(document)` — it scans the entire page. Scope it to the table container for better performance, especially on large pages.

```javascript
manager.initializeTooltips(document.querySelector('#myTable'));
```

---

*Documentation maintained by the Voyadores Design System team. For plugin issues or feature requests, contact the frontend platform team.*
