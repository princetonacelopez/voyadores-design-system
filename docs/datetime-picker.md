---
title: "Datetime Picker"
version: "1.0.0"
files: "`application.datetimepicker.js` · `jquery.datetimepicker.min.js` · `jquery.datetimepicker.css`"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

## 1. Overview

The DateTime Picker integrates the [xdsoft jQuery Datetimepicker](https://xdsoft.net/jqplugins/datetimepicker/) library into the Voyadores application. It provides:

- Three pre-configured date picker variants (plain date, past-limited, future-limited) attached via CSS class selectors.
- Two display formatters that reformat raw database date strings into human-readable text.
- Two JavaScript helper functions for programmatic date/time formatting.

---

## 2. Features

| Feature | Description |
|---|---|
| Date-only pickers | Time column is disabled; only the calendar is shown |
| Pre-configured variants | Three ready-to-use picker behaviors via CSS classes |
| Min/Max date constraints | Restrict selectable dates to a relative range |
| Inline-parent positioning | Calendar renders inside the nearest positioned parent |
| Display formatters | Auto-format server date strings on page load |
| 12-hour time helper | Utility function for formatting `Date` objects to `h:mm am/pm` |

---

## 3. Dependencies

| Library | Version | Required |
|---|---|---|
| jQuery | 3.x recommended | **Yes** |
| xdsoft jQuery Datetimepicker | bundled (`jquery.datetimepicker.min.js`) | **Yes** |
| Moment.js | Any stable | **Yes** (used by formatters and min/max date calculations) |

All three must be loaded **before** `application.datetimepicker.js`.

---

## 4. Setup

### 1. Include files

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/datetime-picker/jquery.datetimepicker.css" />

<!-- Before closing </body> -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/moment/moment.min.js"></script>
<script src="/js/jquery/jquery.datetimepicker.min.js"></script>
<script src="/js/application/application.datetimepicker.js"></script>
```

### 2. Add the CSS class to your inputs

```html
<!-- Standard date picker -->
<input type="text" class="fld-date-picker" name="startDate" />

<!-- Date picker — selectable range: last 7 days to today -->
<input type="text" class="fld-date-picker-min-date" name="birthDate" />

<!-- Date picker — selectable range: today to 7 days ahead -->
<input type="text" class="fld-date-picker-max-date" name="dueDate" />
```

No further JavaScript is required. All pickers are initialized automatically on `$(document).ready`.

---

## 5. Picker Variants

Three variants are initialized on page load via jQuery class selectors.

### `.fld-date-picker` — Standard date picker

A plain date-only picker with no date range restrictions.

```javascript
$('.fld-date-picker').datetimepicker({
    format        : 'm/d/Y',
    timepicker    : false,
    defaultSelect : true,
    insideParent  : true,
    scrollInput   : false,
});
```

| Option | Value | Effect |
|---|---|---|
| `format` | `'m/d/Y'` | Value written to the input: `01/25/2026` |
| `timepicker` | `false` | Hides the time column |
| `defaultSelect` | `true` | Pre-selects today's date when the picker opens |
| `insideParent` | `true` | Calendar is positioned inside the nearest parent element |
| `scrollInput` | `false` | Disables changing the value by scrolling the mouse wheel |

---

### `.fld-date-picker-min-date` — Past-limited date picker

Restricts selectable dates to the last 7 days (inclusive of today). Useful for backdated entries.

```javascript
$('.fld-date-picker-min-date').datetimepicker({
    format      : 'm/d/Y',
    timepicker  : false,
    minDate     : moment().subtract(7, 'days').format('YYYY/M/D'),
    insideParent: true,
    scrollInput : false,
});
```

| Option | Value | Effect |
|---|---|---|
| `minDate` | 7 days before today | Disables all dates earlier than the minimum |

> `defaultSelect` is not set here, so no date is pre-selected when the picker opens.

---

### `.fld-date-picker-max-date` — Future-limited date picker

Restricts selectable dates from today up to 7 days in the future. Useful for scheduling.

```javascript
$('.fld-date-picker-max-date').datetimepicker({
    format        : 'm/d/Y',
    timepicker    : false,
    defaultSelect : true,
    insideParent  : true,
    scrollInput   : false,
    minDate       : new Date(),
    maxDate       : moment().add(7, 'days').format('YYYY/M/D'),
});
```

| Option | Value | Effect |
|---|---|---|
| `minDate` | `new Date()` | Disables all past dates |
| `maxDate` | 7 days from today | Disables all dates beyond the maximum |

---

## 6. Date Display Formatters

On `$(document).ready`, the application script reformats the text content of any element carrying these classes. This is intended for **read-only display fields** that receive raw server-side date strings (format: `M/D/YYYY hh:mm:ss A`).

### `.fld-date-format` — Date only

Renders: `Jan 25, 2026`

```html
<!-- Before JS runs -->
<span class="fld-date-format">1/25/2026 02:30:00 PM</span>

<!-- After JS runs -->
<span class="fld-date-format">Jan 25, 2026</span>
```

Input format parsed: `M/D/YYYY hh:mm:ss A`
Output format: `MMM DD, YYYY`

---

### `.fld-date-time-format` — Date and time

Renders: `2:30 PM Jan 25, 2026`

```html
<!-- Before JS runs -->
<span class="fld-date-time-format">1/25/2026 02:30:00 PM</span>

<!-- After JS runs -->
<span class="fld-date-time-format">2:30 PM Jan 25, 2026</span>
```

Input format parsed: `M/D/YYYY hh:mm:ss A`
Output format: `h:mm A MMM DD, YYYY`

> These formatters use Moment.js and transform the element's `innerHTML` in place. Apply them only to elements whose entire text content is the raw date string.

---

## 7. Helper Functions

Two utility functions are available globally for programmatic date formatting.

### `formatDate(date)`

Parses a .NET-style serialized date string (`/Date(ms)/`) and returns a locale-formatted date and time string.

```javascript
formatDate('/Date(1737763200000)/');
// → "1/25/2026 12:00:00 AM"  (locale-dependent)
```

| Parameter | Type | Description |
|---|---|---|
| `date` | `string` | A .NET JSON date string, e.g. `"/Date(1737763200000)/"` |


> Output format depends on the browser's locale setting.

---

### `formatDateTime12(date)`

Formats a JavaScript `Date` object as a 12-hour time string.

```javascript
formatDateTime12(new Date('2026-01-25T14:30:00'));
// → "2:30 pm"
```

| Parameter | Type | Description |
|---|---|---|
| `date` | `Date` | A JavaScript `Date` object |


> Returns only the time portion. The hour `0` is converted to `12`. Minutes are zero-padded.

---

## 8. Plugin Options Reference

Key options from the xdsoft jQuery Datetimepicker plugin used in this project:

| Option | Type | Default | Description |
|---|---|---|---|
| `format` | `string` | `'Y/m/d H:i'` | Format for the value written to the input. Uses PHP date format tokens. |
| `timepicker` | `boolean` | `true` | Show or hide the time column. |
| `datepicker` | `boolean` | `true` | Show or hide the date calendar. |
| `defaultSelect` | `boolean` | `true` | Pre-select today's date when the picker opens without an existing value. |
| `insideParent` | `boolean` | `false` | Positions the calendar popup inside the nearest positioned ancestor instead of the `<body>`. |
| `scrollInput` | `boolean` | `true` | Allow changing the value by scrolling the mouse wheel over the input. |
| `minDate` | `Date \| string \| false` | `false` | Earliest selectable date. Accepts a `Date` object or a `'YYYY/M/D'` string. |
| `maxDate` | `Date \| string \| false` | `false` | Latest selectable date. Accepts a `Date` object or a `'YYYY/M/D'` string. |

### PHP-style format tokens

| Token | Output | Example |
|---|---|---|
| `d` | Day of month, 2 digits | `01`–`31` |
| `j` | Day of month, no leading zero | `1`–`31` |
| `m` | Month, 2 digits | `01`–`12` |
| `n` | Month, no leading zero | `1`–`12` |
| `Y` | Year, 4 digits | `2026` |
| `y` | Year, 2 digits | `26` |
| `H` | Hour (24h), 2 digits | `00`–`23` |
| `h` | Hour (12h), 2 digits | `01`–`12` |
| `i` | Minutes, 2 digits | `00`–`59` |
| `s` | Seconds, 2 digits | `00`–`59` |
| `A` | AM / PM | `AM`, `PM` |

---

## 9. CSS Classes Reference

### Plugin-generated elements

| Class | Element | Description |
|---|---|---|
| `.xdsoft_datetimepicker` | Wrapper `<div>` | Root container of the calendar popup. `position: absolute; z-index: 9999`. |
| `.xdsoft_datepicker` | Inner `<div>` | The calendar portion (224px wide). Shown/hidden with `.active`. |
| `.xdsoft_timepicker` | Inner `<div>` | The time column (58px wide). Shown/hidden with `.active`. |
| `.xdsoft_mounthpicker` | `<div>` | Month/year header row. |
| `.xdsoft_label` | `<div>` | Clickable month or year label; opens a dropdown list. |
| `.xdsoft_prev` | Button | Navigate to the previous month. |
| `.xdsoft_next` | Button | Navigate to the next month. |
| `.xdsoft_today_button` | Button | Jump to today's date. |
| `.xdsoft_calendar` | `<div>` | The calendar grid wrapper. |
| `.xdsoft_today` | `<td>` | Today's date cell. |
| `.xdsoft_current` | `<td>` | The currently selected date cell. |
| `.xdsoft_default` | `<td>` | The default (pre-selected) date cell. |
| `.xdsoft_other_month` | `<td>` | Days from the previous or next month shown in the grid. |
| `.xdsoft_disabled` | `<td>` | Dates outside the min/max range (not selectable). |
| `.xdsoft_time_box` | `<div>` | The scrollable time list container (151px height). |
| `.xdsoft_inline` | Modifier | Applied to the root when the picker is inline (not floating). |
| `.xdsoft_noselect` | Modifier | Disables text selection on picker elements. |
| `.xdsoft_scrollbar` | `<div>` | Custom scrollbar for the time column. |

---

## 10. Theming & Customization

The default CSS uses hardcoded hex colors. Override specific rules in your own stylesheet to match the Voyadores theme.

### Common overrides

```css
/* Selected date — use brand primary instead of blue */
.xdsoft_datetimepicker .xdsoft_calendar td.xdsoft_current,
.xdsoft_datetimepicker .xdsoft_calendar td.xdsoft_default {
    background: var(--vds-primary);
    box-shadow: none;
    color: #fff;
}

/* Hover state */
.xdsoft_datetimepicker .xdsoft_calendar td:hover {
    background: var(--vds-primary-bg-subtle) !important;
    color: var(--vds-primary-text-emphasis) !important;
    box-shadow: none !important;
}

/* Today highlight */
.xdsoft_datetimepicker .xdsoft_calendar td.xdsoft_today {
    color: var(--vds-primary);
}

/* Popup border */
.xdsoft_datetimepicker {
    border-color: var(--vds-border-color);
    box-shadow: var(--vds-box-shadow);
}
```

---

## 11. Full Example

```html
<!-- Display formatters -->
<p>Date: <span class="fld-date-format">1/25/2026 02:30:00 PM</span></p>
<p>Date &amp; time: <span class="fld-date-time-format">1/25/2026 02:30:00 PM</span></p>

<!-- Picker inputs -->
<div class="mb-3">
    <label class="form-label">Start Date</label>
    <input type="text" class="form-control fld-date-picker" name="startDate" />
</div>

<div class="mb-3">
    <label class="form-label">Birth Date (last 7 days only)</label>
    <input type="text" class="form-control fld-date-picker-min-date" name="birthDate" />
</div>

<div class="mb-3">
    <label class="form-label">Due Date (next 7 days only)</label>
    <input type="text" class="form-control fld-date-picker-max-date" name="dueDate" />
</div>

<!-- Scripts -->
<script src="/js/jquery/jquery.min.js"></script>
<script src="/js/moment/moment.min.js"></script>
<script src="/js/jquery/jquery.datetimepicker.min.js"></script>
<script src="/js/application/application.datetimepicker.js"></script>
```

### Programmatic formatting

```javascript
// Format a .NET date string for display
const label = formatDate('/Date(1737763200000)/');
document.getElementById('created-at').textContent = label;

// Format a Date object to 12-hour time
const timeStr = formatDateTime12(new Date());  // → "2:30 pm"
document.getElementById('recorded-time').textContent = timeStr;
```

### Custom initialization (outside the three variants)

```javascript
$('#custom-picker').datetimepicker({
    format      : 'm/d/Y',
    timepicker  : false,
    insideParent: true,
    scrollInput : false,
    minDate     : moment().startOf('month').format('YYYY/M/D'),
    maxDate     : moment().endOf('month').format('YYYY/M/D'),
});
```
