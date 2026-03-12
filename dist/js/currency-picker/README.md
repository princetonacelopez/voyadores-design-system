# Currency Picker

A jQuery plugin that transforms a plain number `<input>` into a combined **currency selector + amount field** UI component.

---

## Requirements

- jQuery 3.x+
- Bootstrap 5.x (for `.btn`, `.badge`, and tooltip classes used in the onboarding tour)

---

## Installation

Include the script after jQuery on your page:

```html
<script src="/js/currency-picker/currency-picker.js"></script>
```

---

## Basic Usage

Given a standard HTML input:

```html
<input type="number" id="price" name="price" />
```

Initialize the plugin:

```js
$('#price').currencyPicker();
```

This replaces the input with a `.vds-currency-amount-container` that contains:
- A custom currency dropdown (`.currency-picker-container`)
- A cloned amount input (`.input-amount`)
- A hidden native `<select>` for form submission

The original `<input>` is hidden and kept in sync with the amount field.

---

## Options

Pass an options object on initialization:

```js
$('#price').currencyPicker({
  amount: {
    value: 100,        // Initial amount value (default: null)
    editable: true     // Whether the amount input is enabled (default: true)
  },
  currency: {
    value: 'USD',      // Pre-selected currency code (default: null → uses isDefault)
    editable: true     // Whether the currency dropdown is interactive (default: true)
  },
  currencies: [...],   // Array, function, or Promise (see Currency List)
  load: null,          // Async loader callback (see Async Loading)
  onChange: null       // Callback fired on currency or amount change (see Events)
});
```

### Defaults

| Option | Default | Description |
|---|---|---|
| `amount.value` | `null` | Starting amount |
| `amount.editable` | `true` | Amount input enabled |
| `currency.value` | `null` | Pre-selected currency code |
| `currency.editable` | `true` | Currency dropdown enabled |
| `currencies` | `[{ code: "PHP", label: "Philippine peso", symbol: "₱" }]` | Static list |
| `load` | `null` | Async loader function |
| `onChange` | `null` | Change event callback |

---

## Currency List

The `currencies` option accepts three formats:

### 1. Static Array

```js
$('#price').currencyPicker({
  currencies: [
    { code: 'USD', label: 'US Dollar',     symbol: '$',  isDefault: true },
    { code: 'EUR', label: 'Euro',          symbol: '€' },
    { code: 'PHP', label: 'Philippine peso', symbol: '₱' }
  ]
});
```

### 2. Function (sync or async)

```js
$('#price').currencyPicker({
  currencies: () => fetchCurrenciesFromAPI()   // Can return array or Promise
});
```

### 3. Promise

```js
$('#price').currencyPicker({
  currencies: fetch('/api/currencies').then(r => r.json())
});
```

### Currency Object Shape

| Property | Type | Required | Description |
|---|---|---|---|
| `code` | string | yes | ISO 4217 currency code, e.g. `"USD"` |
| `label` | string | yes | Display name, e.g. `"US Dollar"` |
| `symbol` | string | no | Currency symbol, e.g. `"$"` |
| `isDefault` | boolean | no | Marks this currency as pre-selected |

Strings are also accepted and normalized to `{ code: item, label: item, symbol: "" }`.

### Fallback Behavior

If the currency list is empty or fails to load, the plugin falls back to the built-in default: `PHP / Philippine peso / ₱`.

---

## Async Loading

Use `load` for callback-style async loaders:

```js
$('#price').currencyPicker({
  load: function (done) {
    $.getJSON('/api/currencies', function (data) {
      done(data);
    });
  }
});
```

The `done` callback accepts the resolved currency array.

---

## Events

### `onChange`

Fires when either the currency or the amount changes.

```js
$('#price').currencyPicker({
  onChange: function (val) {
    // val = { currency: 'USD', symbol: '$', amount: 100 }
    console.log(val.currency, val.symbol, val.amount);
  }
});
```

The callback is invoked with `this` bound to the `.vds-currency-amount-container` element.

---

## Methods

Call methods using `.currencyPicker('methodName', ...args)`.

### `getValue()`

Returns the current state of the picker.

```js
const val = $('#price').currencyPicker('getValue');
// → { currency: 'USD', symbol: '$', amount: 100 }
```

| Return Key | Type | Description |
|---|---|---|
| `currency` | string | Selected currency code |
| `symbol` | string | Currency symbol |
| `amount` | number | Current numeric amount |

> When called on multiple elements, only the first element's value is returned.

---

### `setValue(val)`

Programmatically updates the currency and/or amount.

```js
$('#price').currencyPicker('setValue', { currency: 'EUR', amount: 250 });
```

| Key | Type | Description |
|---|---|---|
| `currency` | string | Currency code to select. Must exist in the loaded list. |
| `amount` | number \| string \| null | New amount value. Pass `null` or `""` to clear. |

Both keys are optional — omit either to leave it unchanged.

```js
// Update amount only
$('#price').currencyPicker('setValue', { amount: 500 });

// Update currency only
$('#price').currencyPicker('setValue', { currency: 'PHP' });
```

---

### `isEditable(val?)`

Get or set the editable state of the amount input and/or currency dropdown.

**Getter** — call with no argument:

```js
const state = $('#price').currencyPicker('isEditable');
// → { amount: true, currency: true }
```

**Setter** — pass an object:

```js
// Disable the amount input, keep currency selectable
$('#price').currencyPicker('isEditable', { amount: false, currency: true });

// Disable both
$('#price').currencyPicker('isEditable', { amount: false, currency: false });
```

---

### `destroy()`

Tears down the plugin and restores the original `<input>`.

```js
$('#price').currencyPicker('destroy');
```

- Removes the `.vds-currency-amount-container` from the DOM
- Restores the original `name`, `required`, and value attributes
- Unbinds all plugin event listeners

---

## Re-initialization

Calling `.currencyPicker(options)` on an already-initialized element does **not** re-render the UI. Instead it replaces the internal settings and calls `setValue` with the new `currency.value` and `amount.value`. To fully re-render, call `destroy()` first.

```js
$('#price').currencyPicker('destroy');
$('#price').currencyPicker({ currency: { value: 'JPY' } });
```

---

## DOM Structure

After initialization the plugin inserts the following structure after the original `<input>`:

```html
<div class="vds-currency-amount-container [readonly]">

  <div class="currency-picker-container [active]">
    <div class="currency-picker-item [disabled] [has-single-option]"
         role="combobox"
         aria-expanded="false"
         aria-haspopup="listbox"
         aria-label="Currency picker"
         tabindex="0">
      <!-- Active currency display -->
      <span class="currency-icon">$</span>
      <span class="currency-code">USD</span>
      <span class="currency-label">US Dollar</span>
    </div>

    <select class="currency-select-hidden"
            id="{originalId}-currency"
            name="{originalName}Currency"
            style="display:none">
      <option value="USD" data-symbol="$">$ USD</option>
      ...
    </select>
  </div>

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
    ...
  </div>

  <input class="input-amount"
         id="{originalId}-internal"
         name="{originalName}" />

</div>
```

The original `<input>` remains in the DOM (hidden) and stays in sync with the amount field. The hidden `<select>` handles currency form submission.

---

## Accessibility

| Feature | Implementation |
|---|---|
| Combobox role | `role="combobox"` on `.currency-picker-item` |
| Listbox role | `role="listbox"` on `.currency-options-container` |
| ARIA label | `aria-label="Currency picker"` / `"Currency options"` |
| ARIA expanded | `aria-expanded` reflects dropdown open state |
| Keyboard focusable | `tabindex="0"` on picker and each option |
| Disabled state | `tabindex="-1"` + `.disabled` class when not editable |

---

## Readonly Mode

If the original `<input>` has the `readonly` attribute, the `.vds-currency-amount-container` receives the `readonly` class, allowing CSS-level read-only styling.

---

## Form Submission

The plugin ensures correct form submission via two hidden fields:

| Field | Name | Value |
|---|---|---|
| Amount | Original `name` attribute | Current numeric amount |
| Currency | `{originalName}Currency` | Selected currency code |

---

## Console Messages

| Level | Message |
|---|---|
| `warn` | No elements matched the selector |
| `warn` | Unknown method called |
| `warn` | Already initialized (settings replaced instead) |
| `warn` | No currencies loaded — using PHP fallback |
| `warn` | No default currency found — using first available |
| `warn` | `getValue()` called on multiple elements |
| `warn` | `setValue()` — currency code not in loaded list |
| `warn` | `setValue()` — argument is not an object |
| `warn` | `isEditable()` — invalid argument types |
| `warn` | Method called on uninitialized picker |
| `error` | Currency load promise rejected |
| `log` | Current getValue() result |
| `log` | Currency/amount updated via setValue() |

---

## Example: Full Setup

```html
<input type="number" id="invoice-amount" name="invoiceAmount" required />
```

```js
$('#invoice-amount').currencyPicker({
  amount: { value: 0, editable: true },
  currency: { value: 'USD', editable: true },
  currencies: [
    { code: 'USD', label: 'US Dollar',       symbol: '$',  isDefault: true },
    { code: 'EUR', label: 'Euro',            symbol: '€' },
    { code: 'GBP', label: 'British Pound',   symbol: '£' },
    { code: 'PHP', label: 'Philippine Peso', symbol: '₱' }
  ],
  onChange: function (val) {
    console.log(`${val.symbol}${val.amount} ${val.currency}`);
  }
});

// Read value
const current = $('#invoice-amount').currencyPicker('getValue');

// Update value
$('#invoice-amount').currencyPicker('setValue', { amount: 999, currency: 'EUR' });

// Lock fields
$('#invoice-amount').currencyPicker('isEditable', { amount: false, currency: false });

// Tear down
$('#invoice-amount').currencyPicker('destroy');
```
