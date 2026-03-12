---
title: "Currency Picker"
version: "1.0.0"
files: "`currency-picker.js`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The Currency Picker is a jQuery plugin that transforms a plain `<input type="number">` into a combined **currency selector + amount field** UI component. It renders a custom dropdown for selecting the currency and a cloned amount input side-by-side, while keeping the original input hidden and in sync for form submission.

It supports static arrays, functions, and Promises as currency sources — including fully async/callback-style loaders.

---

## 2. Features

| Feature | Description |
|---|---|
| Custom currency dropdown | Styled selector with symbol, code, and label per option |
| Static & async currency loading | Array, function, Promise, or callback-style loader |
| Auto-normalization | Accepts strings or objects with flexible key names |
| Form-safe | Hidden native `<select>` and synced `<input>` handle form submission |
| Programmatic API | `getValue`, `setValue`, `isEditable`, `destroy` |
| Readonly support | Inherits `readonly` attribute from original input |
| Accessible markup | ARIA roles, labels, and keyboard focus support |
| `onChange` callback | Fires on currency or amount change with full value object |
| Feature onboarding tour | Integrates with `TourManager` if available |

---

## 3. Dependencies

| Library | Version | Required |
|---|---|---|
| jQuery | 3.x recommended | **Yes** |
| Bootstrap 5 | 5.3.x (Voyadores theme) | Optional (for `.btn`, `.badge`, and tooltip classes used in the onboarding tour) |

jQuery must be loaded **before** the plugin.

---

## 4. Setup

### 1. Include the script

```html
<!-- Before closing </body>, after jQuery -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/currency-picker/currency-picker.js"></script>
```

### 2. Initialize

```javascript
$('#price').currencyPicker({ /* options */ });
```

---

## 5. Required HTML Structure

The plugin requires a standard `<input>` with a unique `id` and `name`.

```html
<input type="number" id="price" name="price" />
```

> The `id` and `name` attributes are used to generate IDs and names for the hidden `<select>` and cloned amount `<input>`. If omitted, they fall back to `"amount-id"` and `"amountName"`.

---

## 6. Configuration Options

Pass options as a plain object on initialization.

```javascript
$('#price').currencyPicker({
    amount: {
        value: 0,
        editable: true
    },
    currency: {
        value: 'USD',
        editable: true
    },
    currencies: [...],
    load: null,
    onChange: null
});
```

### amount

| Option | Type | Default | Description |
|---|---|---|---|
| `amount.value` | `number \| null` | `null` | Initial amount value. |
| `amount.editable` | `boolean` | `true` | When `false`, the amount input is disabled. |

### currency

| Option | Type | Default | Description |
|---|---|---|---|
| `currency.value` | `string \| null` | `null` | Pre-selected currency code. Falls back to the item with `isDefault: true`, then the first item. |
| `currency.editable` | `boolean` | `true` | When `false`, the currency dropdown is non-interactive. |

### Other options

| Option | Type | Default | Description |
|---|---|---|---|
| `currencies` | `Array \| Function \| Promise` | `[{ code: "PHP", label: "Philippine peso", symbol: "₱" }]` | Currency data source. See [Currency List Formats](#7-currency-list-formats). |
| `load` | `function \| null` | `null` | Callback-style async loader. Receives a `done(list)` callback. Takes precedence over `currencies` if provided. |
| `onChange` | `function \| null` | `null` | Fired when the currency or amount changes. Receives a value object `{ currency, symbol, amount }`. |

---

## 7. Currency List Formats

### Static Array

```javascript
$('#price').currencyPicker({
    currencies: [
        { code: 'USD', label: 'US Dollar',        symbol: '$',  isDefault: true },
        { code: 'EUR', label: 'Euro',              symbol: '€' },
        { code: 'PHP', label: 'Philippine Peso',   symbol: '₱' }
    ]
});
```

### Function (sync or async)

```javascript
$('#price').currencyPicker({
    currencies: () => fetchCurrenciesFromAPI() // Can return an array or a Promise
});
```

### Promise

```javascript
$('#price').currencyPicker({
    currencies: fetch('/api/currencies').then(r => r.json())
});
```

### Async Loader Callback (`load`)

```javascript
$('#price').currencyPicker({
    load: function (done) {
        $.getJSON('/api/currencies', function (data) {
            done(data);
        });
    }
});
```

> `load` takes precedence over `currencies` when both are provided.

### Currency Object Shape

| Property | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | **Yes** | ISO 4217 currency code, e.g. `"USD"`. Also accepts `value` as an alias. |
| `label` | `string` | Yes | Display name, e.g. `"US Dollar"`. |
| `symbol` | `string` | No | Currency symbol, e.g. `"$"`. |
| `isDefault` | `boolean` | No | Marks this currency as the pre-selected default. |

Strings are also accepted and normalized to `{ code: item, label: item, symbol: "" }`.

### Fallback Behavior

If the resolved list is empty or the load fails, the plugin falls back to the built-in default: **PHP / Philippine peso / ₱**.

---

## 8. Methods

Call methods using `.currencyPicker('methodName', ...args)`.

### `getValue()`

Returns the current picker state as an object.

```javascript
const val = $('#price').currencyPicker('getValue');
// → { currency: 'USD', symbol: '$', amount: 100 }
```

| Return Key | Type | Description |
|---|---|---|
| `currency` | `string` | Selected currency code. |
| `symbol` | `string` | Currency symbol. |
| `amount` | `number` | Current numeric amount, or the settings value if the field is empty. |

> When called on a jQuery set with multiple elements, only the **first** element's value is returned.

---

### `setValue(val)`

Programmatically updates the currency and/or amount.

```javascript
$('#price').currencyPicker('setValue', { currency: 'EUR', amount: 250 });
```

| Key | Type | Description |
|---|---|---|
| `currency` | `string` | Currency code to select. Must already exist in the loaded list. |
| `amount` | `number \| string \| null` | New amount value. Pass `null` or `""` to clear. Non-numeric strings are set to `0`. |

Both keys are optional — omit either to leave it unchanged.

```javascript
// Update amount only
$('#price').currencyPicker('setValue', { amount: 500 });

// Update currency only
$('#price').currencyPicker('setValue', { currency: 'PHP' });
```

> If the currency code is not found in the loaded list, `setValue` logs a warning and returns without making changes.

---

### `isEditable(val?)`

Get or set the editable state of the amount input and/or currency dropdown.

**Getter** — call with no argument:

```javascript
const state = $('#price').currencyPicker('isEditable');
// → { amount: true, currency: true }
```

**Setter** — pass an object with boolean values:

```javascript
// Lock the amount, keep currency selectable
$('#price').currencyPicker('isEditable', { amount: false, currency: true });

// Lock both
$('#price').currencyPicker('isEditable', { amount: false, currency: false });
```

---

### `destroy()`

Tears down the plugin and fully restores the original `<input>`.

```javascript
$('#price').currencyPicker('destroy');
```

- Removes the `.vds-currency-amount-container` from the DOM.
- Restores the original `name`, `required`, and current amount value to the input.
- Unbinds all plugin event listeners.
- Clears all plugin data from the element.

---

## 9. Events

### `onChange`

Fires when either the currency selection or the amount field changes.

```javascript
$('#price').currencyPicker({
    onChange: function (val) {
        // val = { currency: 'USD', symbol: '$', amount: 100 }
        console.log(val.currency, val.symbol, val.amount);
    }
});
```

`this` inside the callback is bound to the `.vds-currency-amount-container` element.

> The callback fires from two sources: the custom currency option click handler, and a delegated `change input` listener on the container. Rapid typing in the amount field will fire it on each keystroke.

---

## 10. DOM Structure

After initialization the plugin inserts the following structure immediately **after** the original `<input>`:

```html
<!-- Original input is hidden, kept in sync -->
<input type="number" id="price" style="display:none" />

<!-- Plugin-generated container -->
<div class="vds-currency-amount-container [readonly]">

    <div class="currency-picker-container [active]">

        <!-- Visible currency display trigger -->
        <div class="currency-picker-item [disabled] [has-single-option]"
             role="combobox"
             aria-expanded="false"
             aria-haspopup="listbox"
             aria-label="Currency picker"
             tabindex="0">
            <span class="currency-icon" title="US Dollar" data-toggle="tooltip">$</span>
            <span class="currency-code">USD</span>
            <span class="currency-label">US Dollar</span>
        </div>

        <!-- Hidden native select for form submission -->
        <select class="currency-select-hidden"
                id="price-currency"
                name="priceCurrency"
                style="display:none">
            <option value="USD" data-symbol="$">$ USD</option>
            <option value="EUR" data-symbol="€">€ EUR</option>
        </select>

    </div>

    <!-- Dropdown options list -->
    <div class="currency-options-container"
         role="listbox"
         aria-label="Currency options"
         style="display:none">
        <div class="currency-option [selected]"
             data-value="USD"
             data-symbol="$"
             tabindex="0">
            <span class="currency-icon">$</span>
            <span class="currency-code">USD</span>
            <span class="currency-label">US Dollar</span>
        </div>
        <!-- ...more options -->
    </div>

    <!-- Cloned visible amount input -->
    <input class="input-amount"
           id="price-internal"
           name="price"
           type="number" />

</div>
```

---

## 11. Form Submission

The plugin sets up two fields that are submitted with the form:

| Field | `name` | Value |
|---|---|---|
| Amount | Original `name` attribute (e.g. `price`) | Current numeric amount |
| Currency | `{originalName}Currency` (e.g. `priceCurrentcy`) | Selected currency code |

The original `<input>` has its `name` attribute removed during initialization so it does not submit a duplicate value.

---

## 12. Re-initialization

Calling `.currencyPicker(options)` on an already-initialized element **does not** re-render the UI. Instead it:

1. Replaces the internal `settings` object with a fresh merge of defaults and the new options.
2. Calls `setValue` with the new `currency.value` and `amount.value`.

To fully re-render (e.g. to swap out the currency list), call `destroy()` first:

```javascript
$('#price').currencyPicker('destroy');
$('#price').currencyPicker({ currency: { value: 'JPY' }, currencies: newList });
```

---

## 13. Readonly & Disabled States

### Readonly

If the original `<input>` has the `readonly` attribute set, the `.vds-currency-amount-container` receives the `readonly` CSS class at render time. No interactive behavior is automatically suppressed — use this class in your CSS to style the read-only appearance.

### Disabled fields

Use `isEditable()` to programmatically disable or re-enable the amount input or currency dropdown after initialization.

```javascript
// View-only mode
$('#price').currencyPicker('isEditable', { amount: false, currency: false });

// Re-enable
$('#price').currencyPicker('isEditable', { amount: true, currency: true });
```

---

## 14. Accessibility

| Element | ARIA / Behavior |
|---|---|
| `.currency-picker-item` | `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-label="Currency picker"` |
| `.currency-options-container` | `role="listbox"`, `aria-label="Currency options"` |
| `.currency-option` | `tabindex="0"` (keyboard focusable) |
| Disabled picker | `tabindex="-1"` + `.disabled` class |
| Amount input | Inherits `required` from original input |

---

## 15. Feature Onboarding Tour

On initialization the plugin calls `triggerFeatureOnboarding()`, which registers a one-step Driver.js tour via a `TourManager` singleton (if available on the page).

The tour requires:

| Element | Description |
|---|---|
| `#voyadores-cdn-url` | Hidden input whose `value` is the base CDN URL for tour image assets. |
| `[data-bs-theme]` | Element with Bootstrap theme attribute (`"light"` or `"dark"`) used to select the correct GIF. |
| `TourManager` global | Singleton with `getInstance()`, `registerTour()`, and `startPendingTour()` methods. |

If `TourManager` is not defined, the tour is silently skipped.

> **Note:** The tour was marked for removal on Feb. 5, 2026. It will be safe to remove the `triggerFeatureOnboarding()` call and its function body once confirmed no longer needed.

---

## 16. CSS Classes Reference

| Class | Element | Description |
|---|---|---|
| `.vds-currency-amount-container` | Wrapper `<div>` | Root container injected after the original input. |
| `.readonly` | `.vds-currency-amount-container` | Added when the original input has `readonly`. |
| `.currency-picker-container` | Inner `<div>` | Wraps the display trigger and hidden select. |
| `.active` | `.currency-picker-container` | Added while the dropdown is open. |
| `.currency-picker-item` | Display `<div>` | The visible currency trigger button. |
| `.disabled` | `.currency-picker-item` | Added when `currency.editable` is `false`. |
| `.has-single-option` | `.currency-picker-item` | Added when only one currency is available. |
| `.currency-select-hidden` | `<select>` | Hidden native select for form submission. |
| `.currency-options-container` | Dropdown `<div>` | The dropdown panel. |
| `.currency-option` | Option `<div>` | Individual currency option in the dropdown. |
| `.selected` | `.currency-option` | Marks the currently selected option. |
| `.currency-icon` | `<span>` | Currency symbol within an option. |
| `.currency-code` | `<span>` | Currency code within an option (e.g. `USD`). |
| `.currency-label` | `<span>` | Currency label within an option (e.g. `US Dollar`). |
| `.input-amount` | Cloned `<input>` | The visible, editable amount input. |

---

## 17. Console Messages

| Level | Message |
|---|---|
| `warn` | `[CurrencyPicker]: No elements found. Selector returned empty set.` |
| `warn` | `[CurrencyPicker]: Method "{name}" does not exist` |
| `warn` | `[CurrencyPicker]: Already initialized, settings replaced` |
| `warn` | `[CurrencyPicker]: No currencies loaded, using default currencies as fallback.` |
| `warn` | `[CurrencyPicker]: No default selected currency was found ... using the first available currency as fallback.` |
| `warn` | `[CurrencyPicker]: getValue() was called on multiple elements. Using the first one only.` |
| `warn` | `[CurrencyPicker]: No {code} was found in the loaded currencies. Value will not be updated.` |
| `warn` | `[CurrencyPicker]: setValue() expects an object like {amount: ..., currency: ...}` |
| `warn` | `[CurrencyPicker]: isEditable() expects an object like {amount: true, currency: false}` |
| `warn` | `[CurrencyPicker]: isEditable() expects "amount"/"currency" to be a boolean (true/false)` |
| `warn` | `[CurrencyPicker]: Cannot get/set/destroy/disable an uninitialized picker. Call .currencyPicker() first.` |
| `error` | `[CurrencyPicker]: Failed to load currencies` |
| `log` | `[CurrencyPicker]: Amount value: ... \| Currency value: ... \| Symbol: ...` |
| `log` | `[CurrencyPicker]: Currency value has been updated to {code}` |
| `log` | `[CurrencyPicker]: Amount value has been updated to {value}` |
| `log` | `[CurrencyPicker]: Currency display has been updated` |

---

## 18. Full Example

```html
<input type="number" id="invoice-amount" name="invoiceAmount" required />
<input type="hidden" id="voyadores-cdn-url" value="https://your-cdn.com" />
```

```javascript
$('#invoice-amount').currencyPicker({
    amount: {
        value: 0,
        editable: true
    },
    currency: {
        value: 'USD',
        editable: true
    },
    currencies: [
        { code: 'USD', label: 'US Dollar',       symbol: '$',  isDefault: true },
        { code: 'EUR', label: 'Euro',             symbol: '€' },
        { code: 'GBP', label: 'British Pound',    symbol: '£' },
        { code: 'PHP', label: 'Philippine Peso',  symbol: '₱' }
    ],
    onChange: function (val) {
        console.log(`${val.symbol}${val.amount} ${val.currency}`);
    }
});

// Read current value
const current = $('#invoice-amount').currencyPicker('getValue');
// → { currency: 'USD', symbol: '$', amount: 0 }

// Update programmatically
$('#invoice-amount').currencyPicker('setValue', { amount: 999, currency: 'EUR' });

// Lock to view-only
$('#invoice-amount').currencyPicker('isEditable', { amount: false, currency: false });

// Re-enable
$('#invoice-amount').currencyPicker('isEditable', { amount: true, currency: true });

// Tear down and restore original input
$('#invoice-amount').currencyPicker('destroy');
```
