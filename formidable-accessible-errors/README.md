# Formidable - Accessible Error Summary

Accessible, keyboard-friendly error summary for Formidable Forms.

- Replaces the default invalid message block with a focusable, linked error summary
- Clicking an error jumps to the related field and focuses a sensible target
- Disables Formidable's default "focus first error" and per-field `role=alert` to prevent double announcements
- Works with AJAX and multi-page forms; adds optional inline error icon decoration
- Only loads JS/CSS on pages that actually render a Formidable form, so other pages stay lean

## Feature Details
- **Accessible summary markup**: Replaces the default invalid message with a `.ff-global-errors` block that has an `aria-labelledby` heading, an ordered list of errors, and per-item anchors. Each error link includes a `data-ff-field-id` attribute so the scroll/focus script can route users to the right control even when Formidable changes field id formats.
- **Field resolution engine**: While capturing `frm_validate_entry` errors the plugin caches the current form id, then builds a map of field ids, prefixed ids (e.g. `field123`, `frm_field_123`), and field keys/slugs via `FrmField::get_all_for_form()`. That lookup lets it associate each validation message with the correct container regardless of how Formidable keyed the error.
- **Focus & navigation JS**: `assets/js/ff-accessible-errors.js` focuses the summary as soon as it appears (initial render, AJAX error refresh, or multipage transition), binds click handlers so activating an error link scrolls to `#frm_field_{id}_container`, and then focuses the first visible input/select/textarea. It retries focus after a short delay to ensure dynamically-rendered controls are ready.
- **Scoped AJAX & multipage resilience**: MutationObservers are attached only to `.frm_forms` wrappers (even ones injected later), avoiding expensive document-wide observation while still catching newly inserted `.ff-global-errors` blocks. Native Formidable events (`frmFormErrors`, `frmPageChanged`) trigger inline error decoration and re-binding for Next/Prev transitions.
- **Alert muting & inline icon options**: Filters `frm_focus_first_error` and `frm_include_alert_role_on_field_errors` to prevent Formidable from battling for focus or firing duplicate live alerts, and the JS strips `role="alert"` from `.frm_error_style` containers once per render. An inline SVG icon with an accessible `aria-label` can be injected into every `.frm_error`/`.frm_inline_error`; site owners can toggle it or change the label via `ff_accessible_errors_inline_icon_enabled` and `ff_accessible_errors_inline_icon_aria_label`.
- **Opt-in styling**: Unless `ff_accessible_errors_load_css` returns false, `assets/css/ff-accessible-errors.css` styles the summary, error list links, and inline icon layout while letting `currentColor` drive the icon hue so it inherits surrounding theme colors.

## Requirements
- WordPress
- Formidable Forms (Lite or Pro)

## Installation
1. Upload this folder to `wp-content/plugins/`
2. Activate "Formidable - Accessible Error Summary" in Plugins

The plugin runs automatically on pages with Formidable forms that produce validation errors.

## Usage
- On submission with validation errors, focus moves to a heading in the summary.
- Each error is a link; activating it scrolls to the field container and focuses a logical control.
- AJAX submits and multipage transitions are supported.

## Filters
Customize behavior via WordPress filters:

- `ff_accessible_errors_inline_icon_enabled` (bool, default `true`)
  - Toggle the inline error icon decoration inside per-field messages.
  - Example: `add_filter('ff_accessible_errors_inline_icon_enabled', '__return_false');`

- `ff_accessible_errors_inline_icon_aria_label` (string, default `'Error:'`)
  - Change the accessible label for the inline error icon.
  - Example:
    ```php
    add_filter('ff_accessible_errors_inline_icon_aria_label', function () { return 'Error message:'; });
    ```

- `ff_accessible_errors_load_css` (bool, default `true`)
  - Disable the included CSS if you prefer to style errors yourself.
  - Example: `add_filter('ff_accessible_errors_load_css', '__return_false');`

## Compatibility
- If you also use "Formidable Global A11y Enhancements", that plugin will automatically disable its global message focusing to avoid conflicts, allowing this plugin to lead.

## Development Notes
- Version: 1.2.0
- Registers JS/CSS globally but enqueues them via `frm_enqueue_form_scripts`, so assets load whenever a Formidable form is included.
- PHP entry: `formidable-accessible-errors.php`.

## License
GPL-2.0+ (see plugin header)
