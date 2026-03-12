---
title: "Template Editor"
version: "1.0.0"
files: "model.js · viewModel.js · commands.js · utils.js · template-builder.js · template-viewer.js · template-reviewer.js"
author: "Network Economic Services Ventures Philippines, Inc."
lastUpdated: "2026-03-10"
---

A modular JavaScript component suite for building, previewing, and reviewing multi-section evaluation forms. The system is built on a Command pattern with undo/redo support, an Observable state model, and responsive CSS layout.

---

---

## 1. Overview

The Template Editor is a three-mode evaluation form system:

| Class | Mode | Use case |
|---|---|---|
| `TemplateBuilder` | **Author** | Create and edit form templates (sections, questions, ordering, weights) |
| `TemplateViewer` | **Self-review** | A form respondent completes their own evaluation (single-role) |
| `TemplateReview` | **Dual-role review** | A reviewer and reviewee submit answers independently; a reconciled final score is agreed upon |

All three are standalone ES6 classes that take a `containerId` and an `options` object. They render entirely into their respective container elements.

---

## 2. Architecture

```
template-builder.js   ←→  viewModel.js  ←→  commands.js
template-viewer.js    ←→  model.js
template-reviewer.js  ←→  utils.js
                           vendor/sortable.js
```

### Patterns used

- **MVVM** — `FormViewModel` holds state; views subscribe and re-render on change
- **Command pattern** — every mutation is a command object with `execute()` and `undo()`; the history stack enables unlimited undo/redo
- **Observer pattern** — `Observable` class propagates state changes to all subscribers without coupling
- **Factory pattern** — `QuestionFactory.create(type, ...)` normalizes question construction for both `linearScale` and `text` types

---

## 3. File Structure

```
template-editor/
├── template-builder.js   # Form authoring UI (TemplateBuilder)
├── template-viewer.js    # Single-role form completion UI (TemplateViewer)
├── template-reviewer.js  # Dual-role review UI (TemplateReview)
├── viewModel.js          # State management (FormViewModel)
├── commands.js           # Undoable command objects
├── model.js              # Data models (FormTemplate, Section, QuestionFactory)
├── utils.js              # Observable, DomHelper, debounce, generateUUID, Config
└── vendor/
    ├── sortable.js       # Drag-and-drop reordering (full source)
    └── sortable.min.js   # Minified version
```

---

## 4. Dependencies

| Dependency | Source | Required by |
|---|---|---|
| Bootstrap 5 | External CDN or bundle | All three classes (form controls, badges, collapse, alerts) |
| `vendor/sortable.js` | Bundled | `TemplateBuilder` only (drag-and-drop reordering) |
| `template-editor.css` | `/css/template-editor/template-editor.css` | All three classes |

No jQuery dependency. All DOM manipulation is done via native APIs and the `DomHelper` utility.

### Import order

```html
<link rel="stylesheet" href="/css/template-editor/template-editor.css" />

<script type="module">
  import { TemplateBuilder } from '/js/template-editor/template-builder.js';
  import { TemplateViewer } from '/js/template-editor/template-viewer.js';
  import { TemplateReview } from '/js/template-editor/template-reviewer.js';
</script>
```

---

## 5. Data Models

### FormTemplate

The root data object passed to all three classes.

```javascript
{
  id:           string,     // UUID — generated automatically
  title:        string,     // Form title
  description:  string,     // Form description
  positionName: string,     // Associated position label
  positionId:   string,     // Associated position ID
  createdBy:    string,     // Creator name
  state:        number,     // 0 = draft, other values application-defined
  sections:     Section[]   // Ordered list of sections
}
```

> **TemplateViewer / TemplateReview** additionally expect `reviewee` and `reviewer` (string names) at the root level.

### Section

```javascript
{
  id:          string,     // UUID
  title:       string,     // Section heading
  description: string,     // Optional section description
  weightScore: number,     // Fractional weight (0–1); auto-calculated by FormViewModel
  orderNumber: number,     // 0-based position index
  questions:   Question[]  // Ordered list of questions
}
```

### Question — Linear Scale

```javascript
{
  id:           string,          // UUID
  sectionId:    string,          // Parent section ID
  title:        string,          // Question text
  type:         'linearScale',
  required:     boolean,
  orderNumber:  number,
  weightScore:  number,          // Fractional weight (0–1); auto-calculated
  weightedType: string,          // 'Default' or application-defined category

  // Linear scale range
  minScore:  number,             // Default: 1
  maxScore:  number,             // Default: 5
  minLabel:  string,             // Default: 'Poor'
  maxLabel:  string,             // Default: 'Excellent'

  // TemplateViewer fields
  answer:    number | null,

  // TemplateReview fields
  revieweeAnswer:        number | null,
  reviewerAnswer:        number | null,
  finalScore:            number | null,   // Agreed score
  finalScoreOverridden:  boolean,         // Prevents auto-sync when true
  remarks:               string           // Reviewer comment
}
```

### Question — Text

```javascript
{
  id:           string,
  sectionId:    string,
  title:        string,
  type:         'text',
  required:     boolean,
  orderNumber:  number,
  weightScore:  number,
  weightedType: string,

  // TemplateViewer
  answer:          string | null,

  // TemplateReview
  revieweeAnswer:  string | null,
  reviewerAnswer:  string | null
}
```

### Question types

| Type value | Numeric alias | Rendered as |
|---|---|---|
| `'linearScale'` | `0` | Radio button scale with min/max labels and optional avatar overlays |
| `'text'` | `1` | Textarea |

`QuestionFactory.create()` accepts both the string and numeric forms.

---

## 6. TemplateBuilder

The form authoring interface. Renders a full editor with a section list, per-section question cards, drag-and-drop reordering, undo/redo, and an optional live preview panel.

### Constructor

```javascript
const builder = new TemplateBuilder(containerId, options);
```

| Parameter | Type | Description |
|---|---|---|
| `containerId` | `string` | **Required.** `id` of the container `<div>`. |
| `options` | `object` | Configuration (see below). |

### Options

```javascript
{
  enablePreview: false,       // Show TemplateViewer preview panel alongside the editor
  previewContainer: '',       // Container ID for the live preview (required when enablePreview: true)

  template: {
    title:        '',         // Pre-populate title field
    description:  '',         // Pre-populate description field
    positions:    [],         // Array of { id, name } objects for position dropdown
    positionName: '',         // Pre-selected position label
    positionId:   '',         // Pre-selected position ID
    createdBy:    ''          // Creator name to embed in saved data
  },

  section: {
    reorder:         true,    // Allow drag-and-drop reordering of sections
    showDescription: true,    // Show the section minimap/navigation pane
    maxSection:      20       // Maximum number of sections allowed
  },

  question: {
    reorder:      true,       // Allow drag-and-drop reordering of questions
    isRequired:   true,       // New questions default to required
    maxQuestions: 20          // Maximum questions per section
  },

  data: null                  // Load an existing FormTemplate object on init
}
```

### Public methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `save()` | — | `FormTemplate` | Finalize order numbers on all sections/questions and return the complete template object. Call this to get serializable data to send to an API. |
| `loadJsonData(data)` | `data: FormTemplate` | `void` | Replace the current template with new data. Validates structure, rebuilds the ViewModel, and re-renders. |
| `undo()` | — | `void` | Step back one action in history (if available). |
| `redo()` | — | `void` | Replay the last undone action (if available). |
| `render()` | — | `void` | Manually trigger a full re-render. Normally called automatically. |
| `getSaveState()` | — | `'Unsaved' \| 'Saved'` | Returns the current save state label. |
| `setUnsaved(value)` | `value: boolean` | `void` | Programmatically mark the form as unsaved/saved. |
| `subscribeToState(listener)` | `listener: Function` | `void` | Subscribe to state changes (fires with `'Unsaved'` or `'Saved'`). |

### Toolbar

A fixed floating toolbar is rendered on the right side of the viewport. It contains:

- **Add Section** — creates a new `Section` and appends it
- **Add Linear Scale** — adds a `linearScale` question to the selected section (or first section)
- **Add Text** — adds a `text` question to the selected section
- **Undo** — disabled when history is empty
- **Redo** — disabled when undo stack is empty

"Add Question" buttons disable when the selected section already has `maxQuestions` questions.

### Minimap

When `section.showDescription: true` (default), a section navigation pane renders on the left column showing all section titles. Clicking a title scrolls the editor to that section. The active section is highlighted with the brand color border (`section-active` class).

### Live preview

When `enablePreview: true` and `previewContainer` is set, a `TemplateViewer` instance is instantiated in the preview container and kept in sync with every edit.

### Drag-and-drop

Both section reordering and question reordering use **Sortable.js** (bundled in `vendor/`). Drag operations are translated into `ReorderSectionCommand` and `ReorderQuestionCommand` respectively, which are undo-able.

Questions can also be dragged **across sections** via `TransferQuestionCommand`.

---

## 7. TemplateViewer

A single-role form completion interface. The respondent navigates section-by-section and answers questions. It supports an autosave callback and a preview (read-only) mode.

### Constructor

```javascript
const viewer = new TemplateViewer(containerId, options);
```

### Options

```javascript
{
  data:               {},          // Required. FormTemplate object to render.
  previewMode:        false,       // true = read-only, no answer submission, no autosave
  onCompletionChange: () => {},    // Callback(isComplete: boolean) — fired when section completion status changes
  submitId:           'submit-view', // id of the external submit button to enable/disable
  submitText:         'Finish',    // Label text for the final section's navigation button
  titleAction:        '',          // Prefix prepended to the form title (e.g. "Preview: ")
  onAutoSave:         () => {}     // Callback(formData: FormTemplate) — fired on debounced autosave
}
```

### Public methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `get data` | — | `FormTemplate` | Read the current form data including all answers. |
| `set data(value)` | `value: FormTemplate` | `void` | Replace the form data, re-validate, reset to section 0, re-render. |
| `save()` | — | `FormTemplate` | Return the current form data. |
| `navigate(direction)` | `'back' \| 'next'` | `void` | Move to previous or next section. Validates required questions on `'next'`. |
| `updateAnswer(si, qi, value)` | `si: number, qi: number, value: any` | `void` | Set the answer for a question by section/question index. Triggers autosave. |
| `checkCompletion()` | — | `boolean` | Returns `true` if all required questions in the current section are answered. |
| `render()` | — | `void` | Re-render the entire form. |

### Section navigation

- Sections are shown one at a time. The current section index starts at `0`.
- A progress bar shows the overall percentage of answered required questions.
- **Back** button is hidden on the first section.
- **Next** button is replaced by `submitText` (default `"Finish"`) on the last section.
- Clicking **Next** validates required questions in the current section. If any are unanswered, validation feedback is shown and navigation is blocked.
- The progress bar and "next" button are hidden when only one section exists.

### Validation

When required questions are unanswered and the user tries to advance:
- Each unanswered question's radio group or textarea gets `is-invalid` styling
- An alert is injected: _"Please answer N required question(s) before continuing."_
- The alert auto-dismisses and highlights clear once all required questions are filled

### Autosave

In non-preview mode, `onAutoSave` is debounced with a 2-second delay. It only fires if the current data differs from the last saved snapshot (prevents no-op saves). After firing, the save state transitions through: `changed → saving → saved → lastEdited` (1 minute after last save).

### Data initialization

`TemplateViewer` calls `initializeReview(data)` on construction:
- Text questions default to `answer: ''`
- Linear scale questions default to `answer: null`
- Existing answer values are preserved

### Validation rules

The viewer throws on construction if:
- `data` is not a plain object
- No sections exist
- Any section has no questions
- Any `linearScale` question is missing `minScore` or `maxScore`

---

## 8. TemplateReview

A dual-role review interface where both a reviewee and a reviewer submit scores for the same form. The class navigates question-by-question (not section-by-section), reconciles answers into a `finalScore`, and calculates weighted performance scores.

### Constructor

```javascript
const review = new TemplateReview(containerId, options);
```

### Options

```javascript
{
  data:               {},              // Required. FormTemplate with reviewee/reviewer string properties.
  previewMode:        false,           // Read-only mode
  showScoreSection:   true,            // Show the score tally page at the end
  showScores:         true,            // Show score displays per question/section
  onCompletionChange: () => {},        // Callback(isComplete: boolean) — all linear scale questions have finalScore
  submitId:           'submit-review', // id of external submit button
  submitText:         'Finish',        // Last-question button label
  titleAction:        '',              // Title prefix
  submitEnable:       true,            // Initial enabled/disabled state of submit button
  onAutoSave:         () => {}         // Callback(reviewData: FormTemplate) — debounced autosave
}
```

### Public methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `get data` | — | `FormTemplate` | Read the current review data including all answers and scores. |
| `set data(value)` | `value: FormTemplate` | `void` | Replace review data, validate, reset to question 0, re-render. |
| `navigate(direction)` | `'back' \| 'next'` | `void` | Move between questions. On the last question, navigates to the score tally page (if enabled). |
| `updateAnswer(si, qi, role, value)` | `si: number, qi: number, role: 'Reviewee'\|'Reviewer', value: any` | `void` | Set a role-specific answer. Auto-syncs `finalScore` if both roles match and not overridden. |
| `updateFinalScore(si, qi, value)` | `si: number, qi: number, value: number` | `void` | Manually set the agreed score. Sets `finalScoreOverridden: true` to prevent future auto-sync. |
| `updateRemarks(si, qi, value)` | `si: number, qi: number, value: string` | `void` | Update the reviewer's remarks for a question. |
| `checkCompletion()` | — | `boolean` | Returns `true` if all `linearScale` questions have a `finalScore` set. |
| `render()` | — | `void` | Re-render the entire review interface. |
| `updateScoreTally()` | — | `void` | Re-render the score tally page if it is currently visible. |
| `calculateSectionAverage(section, role)` | `section, 'Reviewee'\|'Reviewer'` | `number\|null` | Simple average of a role's answers in a section. |
| `calculateWeightedScore(section, role)` | `section, 'Reviewee'\|'Reviewer'` | `number\|null` | Weighted average using question `weightScore`. |
| `calculateTotalWeightedAverage(role)` | `'Reviewee'\|'Reviewer'` | `string` | Overall weighted average to 1 decimal place. |
| `calculateOverallPerformanceScore()` | — | `string` | Final score from agreed `finalScore` values × section weights. |
| `getInitials(name)` | `name: string` | `string` | Extract 1–2 initials from a name (for avatar rendering). |

### Question-by-question navigation

Unlike `TemplateViewer` which advances by section, `TemplateReview` navigates one question at a time across all sections. Navigation state tracks both `currentSection` and `currentQuestion` indices simultaneously.

### Auto-sync of finalScore

When `updateAnswer()` is called for either role:
- If the reviewee and reviewer answers are **equal** AND `finalScoreOverridden` is `false`, `finalScore` is automatically set to that value
- If a reviewer manually calls `updateFinalScore()`, `finalScoreOverridden` is set to `true` — preventing future auto-sync even if both roles later agree

This means the agreed score box stays unlocked only when the two parties disagree.

### Score tally page

When `showScoreSection: true` (default), after the last question the interface shows a score summary:
- Per-section averages for both reviewee and reviewer
- Per-section final (agreed) scores
- Overall performance score

Use `showScores: false` to hide individual score displays on each question card (useful in blind review scenarios).

### Avatars

Each linear scale option renders small circular avatar badges above the selected value for each role:
- **Reviewee** — blue circle (`template-avatar-reviewee`)
- **Reviewer** — yellow circle (`template-avatar-reviewer`)

On desktop, when both avatars are present on the same option, they are staggered left/right. On mobile (≤ 768px), both are centered.

### Wavy circle badge

The score tally page uses a `.wavy-circle` CSS badge to display the overall performance score visually. Two variants exist: default (brand warning/orange) and `.silver` (for secondary/neutral scores).

---

## 9. FormViewModel

The internal state manager for `TemplateBuilder`. You do not instantiate it directly — `TemplateBuilder` creates it internally — but understanding it helps with custom integrations.

### Constructor options

```javascript
const vm = new FormViewModel({
  isQuestionRequired: true   // Default required state for new questions
});
```

### Mutation methods

Every method below creates a command, executes it, pushes it to `history`, and clears `undone`.

| Method | Description |
|---|---|
| `addSection()` | Append a new section, recalculate weights |
| `addQuestion(type, title?, sectionIndex?)` | Add a question of `'linearScale'` or `'text'`; creates a section if none exist |
| `deleteSection(sectionIndex)` | Remove section at index, recalculate weights |
| `deleteQuestion(sectionIndex, questionIndex)` | Remove question, recalculate weights |
| `duplicateSection(sectionIndex)` | Deep-copy section + all questions with new UUIDs, insert after original |
| `duplicateQuestion(sectionIndex, questionIndex)` | Deep-copy question with new UUID, title gets " (Copy)" suffix |
| `reorderSection(fromIndex, toIndex)` | Move section, update `orderNumber` on all sections |
| `reorderQuestion(sectionIndex, fromIndex, toIndex)` | Move question within a section |
| `transferQuestion(fromSI, toSI, fromQI, toQI)` | Move question across sections, update `sectionId` |
| `updateTemplateTitle(title)` | Update `formTemplate.title` |
| `updateTemplateDescription(description)` | Update `formTemplate.description` |
| `updateTemplatePosition(positionId)` | Update `formTemplate.positionId` |
| `updateTemplateProperty(property, value)` | Generic template property update |
| `updateSectionTitle(sectionIndex, title)` | Update section title |
| `updateSectionDescription(sectionIndex, description)` | Update section description |
| `updateQuestionTitle(si, qi, title)` | Update question title |
| `updateQuestionType(si, qi, type)` | Replace question type, preserving id/title/weights |
| `updateQuestionRequired(si, qi, required, noRender?)` | Toggle required flag; `noRender: true` skips re-render |
| `updateQuestionMinValue(si, qi, minValue)` | Set linear scale min (integer-clamped) |
| `updateQuestionMaxValue(si, qi, maxValue)` | Set linear scale max (integer-clamped) |
| `updateQuestionMinLabel(si, qi, label)` | Set min axis label |
| `updateQuestionMaxLabel(si, qi, label)` | Set max axis label |
| `updateQuestionWeightedType(si, qi, type)` | Set question weighted type category |
| `calculateWeights()` | Recalculate uniform section and question weights (1/n each) |
| `undo()` | Pop from `history`, call `.undo()`, push to `undone` |
| `redo()` | Pop from `undone`, re-execute, push back to `history` |
| `subscribe(listener)` | Register a listener for state changes |

### Weight calculation

`calculateWeights()` distributes weights uniformly:
- Each section gets `weightScore = 1 / totalSections`
- Each question within a section gets `weightScore = 1 / totalQuestionsInSection`

This is called automatically after every structural mutation (add, delete, duplicate).

---

## 10. Commands

All commands are in `commands.js`. They implement `execute()` and `undo()`. The ViewModel calls `calculateWeights()` and `notifyUpdate()` after structural changes.

| Command class | What it does |
|---|---|
| `AddSectionCommand` | Push new section onto `sections` array |
| `AddQuestionCommand` | Push new question onto a section's `questions` array |
| `UpdatePropertyCommand` | Set a single property at template, section, or question scope |
| `DeleteSectionCommand` | `splice` section out; `undo` splices it back at same index |
| `DeleteQuestionCommand` | `splice` question out; `undo` splices it back |
| `DuplicateSectionCommand` | Deep-copy section + questions with fresh UUIDs, `splice` in after original |
| `DuplicateQuestionCommand` | Deep-copy question with fresh UUID, `splice` in after original |
| `ReorderSectionCommand` | `splice` from source, `splice` into target; updates `orderNumber`; `undo` reverses |
| `ReorderQuestionCommand` | Same as above but scoped to a single section |
| `TransferQuestionCommand` | `splice` from source section, `splice` into target section; updates `sectionId` and `orderNumber` on both sides |

`UpdatePropertyCommand` has a `scope` parameter:

| `scope` value | Target |
|---|---|
| `'template'` | `formTemplate[property]` |
| `'section'` (default) with `questionIndex === null` | `section[property]` |
| `'section'` with `questionIndex !== null` | `section.questions[questionIndex][property]` |

---

## 11. Utilities

### Observable

A minimal pub-sub implementation.

```javascript
import { Observable } from './utils.js';

const obs = new Observable();
obs.subscribe(data => console.log('changed:', data));
obs.notify({ key: 'value' });
obs.unsubscribe(myListener);
```

| Method | Description |
|---|---|
| `subscribe(listener)` | Add listener function to array |
| `notify(data)` | Call all listeners with `data` |
| `unsubscribe(listener)` | Remove a specific listener by reference |

### DomHelper

Static helpers for DOM manipulation.

```javascript
import { DomHelper } from './utils.js';

const btn = DomHelper.createElement('button', {
  className: 'btn btn-primary',
  type: 'button',
  disabled: false
}, 'Click me');

DomHelper.appendChildren(container, btn, otherElement);
DomHelper.clear(container);
```

| Method | Description |
|---|---|
| `createElement(tag, attrs, innerHTML)` | Create an element. `className` sets `element.className`; `checked` sets both property and attribute. |
| `appendChildren(parent, ...children)` | Append all non-null children to parent. |
| `clear(element)` | Set `element.innerHTML = ''`. |

### `debounce(func, wait)`

Returns a debounced version of `func` that delays invocation by `wait` ms.

```javascript
import { debounce } from './utils.js';

const save = debounce(() => api.save(data), 300);
input.addEventListener('input', save);
```

### `generateUUID()`

Returns a v4-style UUID string (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`).

```javascript
import { generateUUID } from './utils.js';

const id = generateUUID(); // e.g. "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

### Config constants

```javascript
import { Config } from './utils.js';

Config.debounceDelay  // 300 (ms)
Config.toolbarClass   // Bootstrap utility classes for fixed toolbar
Config.buttonClass    // Bootstrap classes for toolbar buttons
```

---

## 12. CSS Layout & Classes


### Color tokens

The CSS file defines its own scoped color scale (independent of the Bootstrap theme):

| Scale | Range | Example |
|---|---|---|
| `--gray-0` – `--gray-12` | Light → dark grays | `--gray-0: #f8f9fa`, `--gray-9: #212529` |
| `--blue-0` – `--blue-12` | Light → dark blues | `--blue-6: #228be6` (reviewee avatar) |
| `--green-0` – `--green-12` | Light → dark greens | |
| `--yellow-0` – `--yellow-12` | Light → dark yellows | `--yellow-6: #fab005` (reviewer avatar) |
| `--shadow-1` – `--shadow-6` | Layered box shadows | Increasing depth |

Dark theme shadows are strengthened via `--shadow-strength: 10%` under `[data-bs-theme=dark]`.

### Layout

#### `.template-container`

The outermost wrapper. Uses CSS Grid.

| Variant | Grid columns |
|---|---|
| Default (with description pane) | `300px 1fr` |
| With `.template-description` child only | `1fr` |
| With single `.template-section-container` child | `1fr` |
| Mobile (≤ 768px) | `1fr` (stacked) |

#### `.template-toolbar`

Fixed floating toolbar. Vertically centered on the right edge of the viewport (`position: fixed; inset: 50% 0 auto auto; transform: translateY(-50%)`).

#### `.template-description`

Fixed left sidebar panel (300px wide) containing the section minimap. Scrollable. Sticky within its column.

#### `.template-section-container`

Right column flex container. Sections stack vertically with `gap: 1.5rem`. Uses `align-content: center` on desktop, `start` on mobile.

#### `.template-section`

Individual section card. `min(100%, 600px)` wide on default, `max(600px, 768px)` on `≥ 1400px`. Has `section-active` state variant with brand-color border.

### Key component classes

| Class | Purpose |
|---|---|
| `.template-title` | Section/form title with `text-wrap: pretty` |
| `.template-question-card` | White card with `shadow-2`, rounded corners |
| `.template-question-title` | Question label text |
| `.template-question-number` | Small gray ordinal number above question |
| `.template-question-actions` | Flex row for question-level action buttons |
| `.template-question-linear-scale-container` | Horizontal flex container for radio scale |
| `.template-question-linear-scale-label-container` | Space-between row for min/max labels |
| `.template-section-pane` | Section navigation tile in the minimap |
| `.template-section-pane-list` | Unstyle list of section tiles |
| `.template-navigation` | Bottom navigation bar (Back/Next/Progress) |
| `.template-score-badge` | Pill badge for score display |
| `.template-section-weight-score` | Section weight pill |
| `.template-question-weight-score` | Question weight pill |
| `.template-table-remarks` | Small italic remarks below a score table |
| `.template-button-collapse` | Styled collapse toggle button |
| `.template-avatar-reviewee` | Blue circle avatar (1.5rem × 1.5rem) |
| `.template-avatar-reviewer` | Yellow circle avatar (1.5rem × 1.5rem) |
| `.wavy-circle` | Star-burst badge for overall performance score |
| `.wavy-circle.silver` | Silver variant for secondary scores |

### Collapse toggle arrow

The `[data-bs-toggle="collapse"] .vi-angle-down` icon rotates 180° when expanded:

```css
[aria-expanded="true"]:not(.collapsed) .vi-angle-down { transform: rotate(180deg); }
[aria-expanded="false"].collapsed      .vi-angle-down { transform: rotate(0deg); }
```

### Spin animation

```css
.vi-repeat { animation: spin 1s linear infinite; }
```

Used for loading/saving indicator states.

### Dark theme

All major surfaces have `[data-bs-theme=dark]` overrides. Apply dark mode to a parent element or `<html>`:

```html
<html data-bs-theme="dark">
```

---

## 13. Scoring System

### Weight calculation

Weights are auto-calculated uniformly by `FormViewModel.calculateWeights()`:

```
section.weightScore  = 1 / totalSections
question.weightScore = 1 / totalQuestionsInSection
```

This recalculates after every structural change (add, delete, duplicate).

### TemplateReview score calculations

| Method | Formula |
|---|---|
| Section average | `sum(answers) / count(answered)` |
| Section weighted score | `sum(answer × questionWeight)` |
| Total weighted average | `sum(sectionWeightedScore × sectionWeight) / sum(sectionWeight for answered sections)` |
| Overall performance score | `sum(section.finalScore × section.weightScore)` across sections that have at least one `finalScore` |
| Section final score | `sum(question.finalScore × normalized_questionWeight)` |

All scores are displayed to **1 decimal place** with EPSILON-based rounding to avoid floating-point drift.

---

## 14. Save State Machine

Both `TemplateViewer` and `TemplateReview` track the save state for their autosave UI indicator.

```
                   answer changed
  idle  ──────────────────────────►  changed
                                         │
                        2s debounce fires │
                                         ▼
                                      saving  ──► (onAutoSave callback fires)
                                         │
                          2s transition  │
                                         ▼
                                       saved
                                         │
                        1 minute idle    │
                                         ▼
                                   lastEdited
```

| State | Description |
|---|---|
| `idle` | Initial state, no changes since init |
| `changed` | User has answered/changed something |
| `saving` | 2-second transition while showing "Saving…" |
| `saved` | Shows "Saved" with timestamp |
| `lastEdited` | Shows "Last edited [time]" after 1 minute |

The `onAutoSave` callback only fires if the current JSON differs from the last saved snapshot — preventing repeated no-op requests.

---

## 15. Usage Examples

### 15.1 TemplateBuilder — new form

```html
<div id="builder-container"></div>
<button id="save-btn">Save Template</button>
```

```javascript
import { TemplateBuilder } from '/js/template-editor/template-builder.js';

const builder = new TemplateBuilder('builder-container', {
  template: {
    title: 'Annual Performance Review',
    positions: [
      { id: '1', name: 'Software Engineer' },
      { id: '2', name: 'Product Manager' },
    ],
    createdBy: 'HR Admin',
  },
  section: { maxSection: 10 },
  question: { maxQuestions: 15 },
});

document.getElementById('save-btn').addEventListener('click', () => {
  const template = builder.save();
  fetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify(template),
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 15.2 TemplateBuilder — load existing form

```javascript
import { TemplateBuilder } from '/js/template-editor/template-builder.js';

const builder = new TemplateBuilder('builder-container', {
  data: existingTemplateFromApi,   // FormTemplate object
});

// Listen for unsaved changes
builder.subscribeToState(state => {
  document.getElementById('status').textContent = state; // 'Unsaved' or 'Saved'
});
```

### 15.3 TemplateBuilder — with live preview

```html
<div id="builder"></div>
<div id="preview"></div>
```

```javascript
const builder = new TemplateBuilder('builder', {
  enablePreview: true,
  previewContainer: 'preview',
  data: myTemplate,
});
```

### 15.4 TemplateViewer — self-review with autosave

```javascript
import { TemplateViewer } from '/js/template-editor/template-viewer.js';

const viewer = new TemplateViewer('viewer-container', {
  data: formTemplateFromApi,
  submitId: 'submit-self-review',
  submitText: 'Submit Review',
  titleAction: 'Self-Review: ',
  onCompletionChange(isComplete) {
    document.getElementById('submit-self-review').disabled = !isComplete;
  },
  onAutoSave(formData) {
    fetch('/api/reviews/draft', {
      method: 'PUT',
      body: JSON.stringify(formData),
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

document.getElementById('submit-self-review').addEventListener('click', () => {
  const answers = viewer.data;
  fetch('/api/reviews/submit', {
    method: 'POST',
    body: JSON.stringify(answers),
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 15.5 TemplateReview — dual-role review

```javascript
import { TemplateReview } from '/js/template-editor/template-reviewer.js';

// formData must include reviewee and reviewer names
const formData = {
  ...template,
  reviewee: 'Maria Santos',
  reviewer: 'Juan dela Cruz',
  sections: template.sections,
};

const review = new TemplateReview('review-container', {
  data: formData,
  showScoreSection: true,
  showScores: true,
  submitId: 'submit-review-btn',
  submitText: 'Finalize Review',
  onCompletionChange(isComplete) {
    document.getElementById('submit-review-btn').disabled = !isComplete;
  },
  onAutoSave(reviewData) {
    fetch('/api/reviews/save', {
      method: 'PUT',
      body: JSON.stringify(reviewData),
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
```

### 15.6 TemplateViewer in preview mode (read-only)

```javascript
const preview = new TemplateViewer('preview-container', {
  data: myTemplate,
  previewMode: true,
  titleAction: 'Preview: ',
});
```

---

## 16. Debugging & Troubleshooting

### "Container with ID '...' not found"

The `containerId` string must match an existing `id` attribute in the DOM **at the time the constructor is called**. Ensure the element exists before importing/initializing the class.

```javascript
// Wrong — DOM not ready
const builder = new TemplateBuilder('builder');

// Correct — wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const builder = new TemplateBuilder('builder');
});
```

---

### "Data must be a single FormTemplate object"

The `data` option must be a plain object (not an array, not `null`). If your API wraps the data in an array, unwrap it first:

```javascript
const data = apiResponse[0]; // or apiResponse.data
const viewer = new TemplateViewer('viewer', { data });
```

---

### Weights showing as `0` or `NaN`

All sections and questions must exist in the data before `calculateWeights()` runs. If you build a `FormTemplate` manually without going through the ViewModel, call `vm.calculateWeights()` explicitly after adding all sections/questions.

---

### `finalScore` not auto-syncing in TemplateReview

Auto-sync only works for `linearScale` questions when:
1. Both `revieweeAnswer` and `reviewerAnswer` are equal
2. `finalScoreOverridden` is `false`

If a form loaded from the API has `finalScoreOverridden: true` on any question, that question's agreed score will not auto-sync even if answers match. This is intentional — if a facilitator has already set the final score, it is not overwritten.

---

### Section not scrolling into view

`scroll-margin-block-start: 1.5rem` is set on `.template-section` and `.template-section-container`. If your page has a fixed topbar taller than `1.5rem`, increase this value in your page-specific CSS override.

---

### Drag-and-drop not working

- Verify `vendor/sortable.js` is being loaded (check the browser console for import errors).
- Drag-and-drop requires `section.reorder: true` and `question.reorder: true` (both default `true`). Confirm neither was set to `false`.
- Mobile touch drag requires that Bootstrap's `* { cursor: none }` global is not interfering — Sortable.js needs native drag events. Wrap the builder container in `.bs-scope` if needed.

---

### Undo does not fully revert a change

`undo()` reverts one command at a time. Each property edit (title, description, min/max label, etc.) is a separate command. Multiple rapid edits in debounced fields (300ms debounce) may produce multiple commands — each requiring a separate `Ctrl+Z`.

---

*Documentation maintained by the Voyadores Design System team. For plugin issues or feature requests, contact the frontend platform team.*
