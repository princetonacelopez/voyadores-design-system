---
title: "Wizard Form"
version: "1.0.0"
files: "`js/wizard-form/wizard-form.min.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## Overview

`WizardForm` is a lightweight ES6 class that transforms a multi-step modal form into a guided, sequential wizard experience. It manages step navigation, progress tracking, and lifecycle callbacks without any external framework dependency beyond the Voyadores Bootstrap theme.

Each step is a distinct panel inside a shared modal. The wizard controls which panel is visible, renders a progress indicator, drives a progress bar, and exposes step-level callbacks so the caller can validate data, load content, or redirect flow before advancing.

---

## Features

- Multi-step form navigation (next / previous)
- Animated progress bar tracking completion percentage
- Step indicator list with active and completed states (Voyadores icons)
- Per-step lifecycle callbacks: `onEnter`, `onNext`, `onFinish`, `skipWhen`
- Optional step skipping via `skipWhen` predicate
- Configurable finish button text and submit behavior
- Form reset integration (listens for native `reset` event)
- Optional back-navigation disable per step or globally
- Full API for runtime control: `reset`, `navigate`, setters

---

## Dependencies

| Dependency | Purpose |
|---|---|
| Bootstrap 5 Modal | Container structure (`.modal-content`) |
| Voyadores Icon Font | Step indicator icons (`vi-solid vi-check-circle`, `vi-solid vi-contrast`) |

No jQuery is required. WizardForm uses the native DOM API throughout.

---

## CDN Setup

```html
<!-- Required: Voyadores Bootstrap theme (icons + base styles) -->
<link rel="stylesheet" href="https://cdn.voyadores.com/content/css/bootstrap/bootstrap.voyadores.theme.min.css" />
<link rel="stylesheet" href="https://cdn.voyadores.com/content/fonts/Voyadores-Icon/voyadores-icon.min.css" />

<!-- Required: Bootstrap JS -->
<script src="https://cdn.voyadores.com/content/js/bootstrap/bootstrap.bundle.min.js"></script>

<!-- WizardForm (ES Module) -->
<script type="module">
  import WizardForm from 'https://cdn.voyadores.com/content/js/wizard-form/wizard-form.min.js';
  // usage here
</script>
```

> **Important:** The file uses `export default`, so it must be imported with `<script type="module">` or a module bundler. It cannot be loaded as a classic script.

---

## Required HTML Structure

WizardForm expects a specific DOM structure inside a Bootstrap modal. The wizard container must be inside `.modal-content`, and navigation buttons must be siblings inside `.wizard-navigation` at the modal content level.

```html
<div class="modal fade" id="myWizardModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">

      <!-- Modal header (optional) -->
      <div class="modal-header">
        <h5 class="modal-title">Create New Record</h5>
      </div>

      <!-- Wizard navigation buttons (MUST be inside .modal-content) -->
      <div class="modal-footer">
        <div class="wizard-navigation">
          <button type="button" class="prev-button btn btn-outline-secondary">Back</button>
          <button type="button" class="next-button btn btn-primary">Next</button>
        </div>
      </div>

      <!-- Wizard container -->
      <div class="modal-body">
        <div id="myWizard">

          <!-- Progress bar -->
          <progress class="progress-bar" value="0" max="100"></progress>

          <!-- Step indicator list -->
          <ol class="progress-indicator"></ol>

          <!-- Step content panels -->
          <div class="wizard-content">
            <div class="wizard-step">
              <!-- Step 1 content -->
              <h4>Basic Information</h4>
              <input type="text" name="name" placeholder="Full Name" />
            </div>

            <div class="wizard-step">
              <!-- Step 2 content -->
              <h4>Contact Details</h4>
              <input type="email" name="email" placeholder="Email Address" />
            </div>

            <div class="wizard-step">
              <!-- Step 3 content -->
              <h4>Review & Submit</h4>
              <p>Please review your information before submitting.</p>
            </div>
          </div>

        </div><!-- /#myWizard -->
      </div><!-- /.modal-body -->

    </div><!-- /.modal-content -->
  </div>
</div>
```

### Required Elements

| Selector | Required | Description |
|---|---|---|
| `.progress-bar` | Yes | `<progress>` element — value updated automatically |
| `.progress-indicator` | Yes | `<ol>` or `<ul>` — step titles rendered here |
| `.wizard-content` | Yes | Wrapper containing all `.wizard-step` panels |
| `.wizard-step` (×N) | Yes | One per step — shown/hidden via `.active` class |
| `.modal-content .wizard-navigation > .prev-button` | Yes | Back button — searched via `.closest('.modal-content')` |
| `.modal-content .wizard-navigation > .next-button` | Yes | Next/Finish button |

> **Note:** `.prev-button` and `.next-button` are queried by traversing up to `.modal-content` from the wizard container. They do not need to be inside `#myWizard` — they just need to be inside the same `.modal-content`.

---

## Constructor

```js
new WizardForm(containerId, config)
```

| Parameter | Type | Description |
|---|---|---|
| `containerId` | `string \| Element` | CSS selector string (e.g. `'#myWizard'`) or direct DOM element |
| `config` | `object` | Configuration object (see below) |

---

## Configuration Object

```js
const config = {
  steps: [...],              // Required — array of step definition objects
  allowPrevious: true,       // Optional — enable/disable back button (default: true)
  finishButtonText: 'Submit',// Optional — label for Next button on the last step (default: 'Finish')
  finishButtonSubmit: false, // Optional — if true, finish button acts as form submit (default: false)
  formId: 'myForm',         // Optional — native <form> ID to bind reset event
};
```

### Config Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `steps` | `Step[]` | — | **Required.** Array of step definition objects. Length determines total step count. |
| `allowPrevious` | `boolean` | `true` | When `false`, the Back button is always disabled regardless of current step. |
| `finishButtonText` | `string` | `'Finish'` | Label shown on the Next button when the user is on the last step. |
| `finishButtonSubmit` | `boolean` | `false` | When `true`, the finish action is treated as a form submission trigger. |
| `formId` | `string` | `''` | ID of a `<form>` element. When provided, WizardForm listens for the form's `reset` event and calls `wizard.reset()` automatically. |

---

## Step Definition Object

Each entry in the `steps` array configures one step. All properties are optional except `title`.

```js
{
  title: 'Basic Information',    // Required — shown in the step indicator list
  skipWhen: () => boolean,       // Optional — skip this step if true
  onEnter: () => void,           // Optional — called when this step becomes active
  onNext: (next) => void,        // Optional — called when Next is clicked; must call next() to advance
  onFinish: () => void,          // Optional — called when Next is clicked on the last step
}
```

### Step Properties

| Property | Type | Description |
|---|---|---|
| `title` | `string` | Displayed in the step indicator bar. |
| `skipWhen` | `() => boolean` | Called during `_init`. If it returns `true`, the wizard automatically advances past this step. Useful for conditional flows. |
| `onEnter` | `() => void` | Called when the step is activated (on init, after navigating forward, and when navigating back). Use to load dynamic content or reset field state. |
| `onNext` | `(next: Function) => void` | Called when the user clicks Next on this step. The `next` argument is a function — **you must call `next()` to advance**. This allows async validation: run validation, then call `next()` only on success. |
| `onFinish` | `() => void` | Called when the user clicks the finish button on the final step. Use to submit data, close the modal, or trigger confirmation. |

---

## Step Indicator Icons

The step indicator uses Voyadores Icon Font classes:

| State | Icon class | Description |
|---|---|---|
| Pending / Active | `vi-solid vi-contrast` | Half-filled circle — step not yet completed |
| Completed | `vi-solid vi-check-circle` | Checkmark circle — step already passed |

Step indicator items also receive CSS classes for styling:

| CSS class | When applied |
|---|---|
| `progress-step` | Always — base class for all steps |
| `progress-step active` | Current step |
| `progress-step completed` | Steps before the current step |

---

## Public API

### `destroy()`

Nullifies all internal references. Call this when tearing down the wizard to prevent memory leaks (e.g. when a modal is closed and the instance is no longer needed).

```js
wizard.destroy();
```

### `navigate(direction)`

Moves the wizard forward or backward by the given number of steps. Positive = forward, negative = backward. Calls `onEnter` of the destination step if defined.

```js
wizard.navigate(1);   // go forward one step
wizard.navigate(-1);  // go back one step
```

### `reset()`

Resets the wizard to step 0, re-renders the indicator, updates navigation and progress bar, and calls the first step's `onEnter` if defined. Also calls `form.reset()` if a `formId` was provided.

```js
wizard.reset();
```

### `setAllowPrevious(allow)`

Enables or disables the Back button at runtime.

```js
wizard.setAllowPrevious(false); // disable back navigation
wizard.setAllowPrevious(true);  // re-enable
```

### `setFinishButtonText(text)`

Changes the label of the Next/Finish button at runtime.

```js
wizard.setFinishButtonText('Complete Registration');
```

### `setFinishButtonSubmit(isSubmit)`

Changes whether the finish button acts as a submit trigger at runtime.

```js
wizard.setFinishButtonSubmit(true);
```

### `setFormId(formId)`

Updates the bound form ID at runtime.

```js
wizard.setFormId('registrationForm');
```

---

## Usage Examples

### Basic 3-step wizard

```html
<script type="module">
import WizardForm from 'https://cdn.voyadores.com/content/js/wizard-form/wizard-form.min.js';

const wizard = new WizardForm('#myWizard', {
  steps: [
    {
      title: 'Basic Info',
      onEnter() {
        console.log('Step 1 entered');
      },
      onNext(next) {
        // Validate before advancing
        const name = document.querySelector('[name="name"]').value;
        if (!name.trim()) {
          alert('Name is required');
          return; // do NOT call next() — stay on this step
        }
        next(); // advance to step 2
      }
    },
    {
      title: 'Contact Details',
      onEnter() {
        console.log('Step 2 entered');
      },
      onNext(next) {
        next(); // advance to step 3
      }
    },
    {
      title: 'Confirmation',
      onFinish() {
        // Submit form data
        document.querySelector('#myForm').submit();
      }
    }
  ]
});
</script>
```

### Conditional step skipping

```js
const wizard = new WizardForm('#myWizard', {
  steps: [
    { title: 'Account Type', onNext(next) { next(); } },
    {
      title: 'Business Details',
      // Skip this step if user selected "individual" account type
      skipWhen: () => document.querySelector('[name="accountType"]:checked')?.value === 'individual',
      onEnter() { loadBusinessForm(); },
      onNext(next) { next(); }
    },
    { title: 'Review', onFinish() { submitForm(); } }
  ]
});
```

### Async validation with API call

```js
{
  title: 'Email Verification',
  onNext(next) {
    const email = document.querySelector('[name="email"]').value;

    fetch('/api/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      if (data.available) {
        next(); // advance only if email is available
      } else {
        showError('This email is already registered.');
      }
    });
  }
}
```

### Disable back navigation on certain steps

```js
{
  title: 'Processing',
  onEnter() {
    wizard.setAllowPrevious(false); // lock navigation during processing
    processData().then(() => {
      wizard.setAllowPrevious(true);
      wizard.navigate(1);
    });
  }
}
```

### Reset wizard when modal closes

```js
const modal = document.getElementById('myWizardModal');
modal.addEventListener('hidden.bs.modal', () => {
  wizard.reset();
});
```

### Destroy wizard when modal is removed from DOM

```js
modal.addEventListener('hidden.bs.modal', () => {
  wizard.destroy();
  wizard = null;
});
```

---

## Navigation Behavior

| Condition | Back button | Next button label |
|---|---|---|
| Step 0 | Always disabled | "Next" |
| Step 1..N-2 | Enabled (if `allowPrevious: true`) | "Next" |
| Last step | Enabled (if `allowPrevious: true`) | Value of `finishButtonText` |
| `allowPrevious: false` | Always disabled | (same as above) |

---

## Progress Bar

The `<progress>` element's `value` is updated automatically on every navigation:

```
progress = ((currentStep + 1) / steps.length) * 100
```

Styles the progress bar using the browser's native `<progress>` element. Override with CSS to match your design.

---

## CSS Classes Reference

Apply these classes in your stylesheet to control appearance:

| Class | Element | Purpose |
|---|---|---|
| `.progress-bar` | `<progress>` | The step progress bar |
| `.progress-indicator` | `<ol>` / `<ul>` | Container for step indicators |
| `.progress-step` | `<li>` | Individual step in the indicator |
| `.progress-step.active` | `<li>` | Currently active step |
| `.progress-step.completed` | `<li>` | Steps already passed |
| `.progress-step-icon` | `<span>` | Icon wrapper inside each step |
| `.progress-step-title` | `<span>` | Title text inside each step |
| `.wizard-content` | `<div>` | Wraps all step panels |
| `.wizard-step` | `<div>` | Individual step panel |
| `.wizard-step.active` | `<div>` | Visible step panel |
| `.wizard-navigation` | `<div>` | Wrapper for prev/next buttons |
| `.prev-button` | `<button>` | Back button |
| `.next-button` | `<button>` | Next / Finish button |

---

## Debugging

### Back/Next buttons don't work



---

### Step panels all show at once


```css
.wizard-step          { display: none; }
.wizard-step.active   { display: block; }
```

---

### Progress indicator is empty



---

### `skipWhen` not firing


```js
onEnter() {
  if (shouldSkip()) wizard.navigate(1);
}
```

---

### `onNext` advances automatically without calling `next()`



---

### Wizard does not reset after form `reset` event



---

### Module import error: `Cannot use import statement`


```html
<!-- Correct -->
<script type="module">
  import WizardForm from '.../wizard-form.min.js';
</script>

<!-- Wrong — will throw SyntaxError -->
<script src=".../wizard-form.min.js"></script>
```

---

## Best Practices

- **Always validate in `onNext`** — never advance automatically without verifying required fields for that step.
- **Keep steps focused** — each step should collect one logical group of data. Avoid putting too many fields in a single step.
- **Handle async in `onNext`** — show a loading state while async operations (API calls, file uploads) are in progress, then call `next()` on success.
- **Call `destroy()` on cleanup** — if the wizard is created inside a Bootstrap modal, destroy the instance in the `hidden.bs.modal` event to avoid memory leaks and stale event listeners.
- **Provide `onEnter` for dynamic steps** — use `onEnter` to populate dropdowns, load dependent data, or reset fields each time a step is entered (including on back-navigation).
- **Use `skipWhen` only for init-time conditions** — for conditions that change at runtime, use `onEnter` + `navigate(1)` instead.
- **Test with `allowPrevious: false`** — for irreversible steps (e.g. payment confirmation), disable back navigation to prevent the user from undoing committed actions.
