# Formidable Dropzone A11y Enhancements

Accessibility improvements for Formidable Forms Dropzone upload fields.

- Focus management after upload/remove and after native file dialog closes
- Live region announcements for file add/remove
- Clearer remove link labels (e.g. “Remove file example.pdf”)
- Reduces redundant roles/announcements on Dropzone containers

## Feature Details
- **Per-dropzone live region + dialog guard**: `assets/formidable-dropzone-a11y-enhancements.js` injects a `.frm-a11y-sr-only` element beside every `.frm_dropzone`, sets `aria-live="assertive"`/`aria-atomic="true"`, and keeps it focusable so announcements like “Uploading file…” or “example.pdf uploaded” are spoken immediately. When the hidden native file picker closes, `installDialogCloseFocusRestore()` temporarily watches for focus/interaction events and snaps users back to that live region to avoid the browser reading the page title instead.
- **Upload/complete cycle announcements**: When a Dropzone instance is available the script hooks `processing`, `success`, and `removedfile` events to narrate “Uploading file, please wait”, “{file} uploaded”, or “{file} removed” and to focus the live region or the newest remove link. If Dropzone hasn’t initialized yet, a `MutationObserver` watches `.dz-preview` nodes and mirrors the same behavior so AJAX-initialized or pre-populated uploads stay accessible.
- **Remove link labeling & focus flow**: Every `.dz-remove` button has its `title` stripped and gets a specific `aria-label` (“Remove file {name}”). Click handlers compute the next logical focus target before Dropzone mutates the DOM—another remove link when files remain, otherwise the main upload button—so keyboard users never lose their place during add/remove cycles.
- **Attribute mirroring & role cleanup**: When the visual Dropzone wrapper carries `aria-describedby`, those ids are copied onto the hidden upload button, and redundant `role="group"` attributes are removed from the wrapper to reduce duplicate announcements. Existing previews are initialized on page load so preloaded files inherit the same labeling and focus handling.
- **Native dialog / button focus management**: Upload buttons are discovered via several selectors (compact, full, fallback text matches). After uploads complete the new file’s remove link is focused, and after all files are removed focus falls back to the button to keep tab order predictable.
- **Resilient detection on dynamic forms**: `enhanceUploads()` reruns after `frmFormErrors`, `frmPageChanged`, jQuery `ajaxComplete`, a zero-delay timeout, and a page-level `MutationObserver`, ensuring Dropzone instances added via AJAX, block editors, or other scripts automatically gain these enhancements without extra config.

## Requirements
- WordPress
- Formidable Forms with Dropzone-enabled file uploads

## Installation
1. Upload this folder to `wp-content/plugins/`
2. Activate “Formidable Dropzone A11y Enhancements” in Plugins

The script auto-detects Dropzone instances and enhances them. No settings are required.

## What It Does
- Creates an assertive, scoped live region near each Dropzone to announce changes
- Adjusts remove link accessible names and removes tooltip `title` attributes
- Restores focus to the upload button after changes and after the native file chooser closes
- Avoids duplicate group roles on containers to reduce screen reader noise

## Notes
- Non-upload accessibility features were moved into the separate “Formidable Global A11y Enhancements” plugin.
- The CSS/JS assets now enqueue only when Formidable detects a Dropzone-enabled file field on the page (or when the `formidable_dropzone_a11y_force_enqueue` filter returns true), keeping other front-end views free of unnecessary requests.
- JavaScript rescans triggered by AJAX events or MutationObservers are batched to the next animation frame so multiple rapid updates don’t repeatedly traverse the DOM.

## Development Notes
- Version: 1.0.3
- Enqueues `assets/formidable-dropzone-a11y-enhancements.js` and `assets/formidable-dropzone-a11y-enhancements.css`.
- PHP entry: `formidable-dropzone-a11y-enhancements.php`.

## License
GPL-2.0+ (see plugin header)
