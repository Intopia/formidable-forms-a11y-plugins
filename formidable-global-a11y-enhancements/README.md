# Formidable Global A11y Enhancements

Accessibility improvements for Formidable Forms outside of file uploads, with admin toggles.

- Other inputs cleanup: hides duplicate screen-reader labels and moves text into `aria-label`.
- Optional removal of `role="alert"` from inline field errors when disabled via `frm_include_alert_role_on_field_errors`.
- Global message focus: focuses the error summary (when our summary is used and Accessible Error Summary is not active) and the success message after submit.
- Multi-page focus: on next/previous, focuses the first visible heading (configurable H1–H6); prefers the error summary when present.
- Adds `aria-describedby` to radio/checkbox controls (either every input or the role="group"/"radiogroup" container) to reference the field description and inline error.
- Formidable detection: watcher-heavy JS only enqueues when a Formidable form actually rendered, so other front-end pages stay untouched.

## Feature Details
- **Other field cleanup / inline error roles**: Watches `.frm_other_input` elements to hide duplicate `.frm_screen_reader` labels while copying their text into `aria-label` so the prompt is still announced. The same toggle mirrors the `frm_include_alert_role_on_field_errors` filter by stripping `role=alert` from inline errors when a site opts out of alerts, keeping announcements aligned with site intent.
- **Global error message focus**: When Accessible Error Summary is not already active, the script finds `.ff-global-errors` (or classic `.global-errors h2`) after submission, injects `tabindex=-1`, and focuses its heading/container so screen-reader users immediately land on the summary.
- **Success message focus**: Regardless of errors, `.frm_message` receives focus once a submission succeeds so confirmation text is spoken even if the user was at the bottom of a long page.
- **Multi-page focus management**: Tracks clicks/keyboard activation on `.frm_next_page` / `.frm_prev_page`, stores that intent in `sessionStorage`, and after AJAX or full reloads focuses the first visible heading at the admin-selected level (H1-H6). It retries a few times to catch delayed renders and always prefers global error summaries when they exist.
- **Choice field `aria-describedby` injection**: Parses each radio/checkbox `<input>` and merges ids for the field description (`frm_desc_*`) and inline error (`frm_error_*`) into `aria-describedby`, preserving any existing ids so assistive tech announces both context and validation hints. Alternatively, enable the group-level setting to target Formidable's `.frm_opt_container` element (role="group"/"radiogroup") so the whole choice set references the description/error once.
- **Runtime config surface**: Exposes all toggles to JS through `ff_globa11y`, including whether the Accessible Error Summary plugin is active and whether alert roles are disabled. Adding `?ff_globa11y_debug=1` to the URL enables optional `tabindex` tracking logs so focus traps can be debugged safely.

## Requirements
- WordPress
- Formidable Forms (Lite or Pro)

## Installation
1. Upload this folder to `wp-content/plugins/`
2. Activate "Formidable Global A11y Enhancements" in Plugins

## Settings
Navigate to `Settings → Formidable A11y` to toggle features:
- Other fields cleanup (default: ON)
- Global error message focus (default: OFF)
- Success message focus (default: ON)
- Multi-page focus (default: ON)
- Multi-page heading level H1–H6 (default: H1)
- Add aria-describedby to radio/checkbox controls (default: ON)
- Add aria-describedby to the role="group"/"radiogroup" container (default: OFF, enabling this turns off the per-input option)

If "Formidable – Accessible Error Summary" is active, this plugin auto-disables its own global error focusing to avoid conflicts.

## Behavior Details
- Localized settings object: `ff_globa11y` controls runtime behavior in JS.
- Multi-page transitions are managed via click handlers and short retries; full-page navigations use `sessionStorage` to focus after reload.
- AJAX handling is scoped to Formidable-related requests to avoid unrelated triggers.
- Inline error `role="alert"` removal respects the `frm_include_alert_role_on_field_errors` filter.
- Optional debugging of focusable tabindex can be enabled with `?ff_globa11y_debug=1`.
- The radio/checkbox `aria-describedby` filter runs only on front-end renders (skipping admin/builder/preview contexts) to avoid clashing with custom templates, and the group-level option specifically targets Formidable's default `.frm_opt_container` wrapper with role="group"/"radiogroup".

## Development Notes
- Version: 1.2.4
- Enqueues `assets/formidable-global-a11y-enhancements.js`
- PHP entry: `formidable-global-a11y-enhancements.php`

## Changelog
- 1.2.4
  - Add setting to choose heading level (H1–H6) for multi-page focus; H1 remains default.
  - Add option to inject `aria-describedby` on radio/checkbox inputs.
  - Scope AJAX hooks to Formidable-related requests.
  - Respect `frm_include_alert_role_on_field_errors` to optionally remove `role="alert"` from inline field errors.
  - Add i18n wrappers for admin settings and load text domain.
  - Only enqueue the front-end JS when Formidable forms are present and skip choice markup filtering in admin/builder previews.
  - Add a setting to target the choice group container (role="group"/"radiogroup") with `aria-describedby`, automatically disabling per-input injection when selected.

## License
GPL-2.0+ (see plugin header)

