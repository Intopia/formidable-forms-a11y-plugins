/* global jQuery */
(function ($) {
  'use strict';

  function safeFocus($el) {
    if (!$el || !$el.length) return;
    var added = false;
    if (!$el.is('[tabindex]')) { $el.attr('tabindex', '-1'); added = true; }
    $el.trigger('focus');
    if (added || $el.attr('tabindex') === '-1') {
      if (typeof trackTabindex === 'function') try { trackTabindex($el, 'safeFocus'); } catch (e) {}
    }
  }

  // Read settings localized from PHP with sensible defaults
  var CFG = window.ff_globa11y || {
    other_fields_fix: true,
    global_message_focus: false,
    success_message_focus: true,
    multi_page_focus: true,
    multi_page_focus_level: 1,
    has_accessible_errors: false,
    remove_alert_role_on_field_errors: false,
    remove_choice_error_alert_role: false,
    debug_tabindex: false
  };
  CFG.has_accessible_errors = !!CFG.has_accessible_errors;
  try {
    if (!CFG.debug_tabindex) {
      var qs = (window.location && window.location.search) || '';
      if (/([?&])ff_globa11y_debug=1(?!\d)/.test(qs)) CFG.debug_tabindex = true;
    }
  } catch (e) {}

  function trackTabindex($el, label) {
    if (!CFG.debug_tabindex || !$el || !$el.length || typeof MutationObserver === 'undefined') return;
    var el = $el.get(0);
    try {
      if (el.__ffTabindexObserver) {
        try { el.__ffTabindexObserver.disconnect(); } catch (e) {}
      }
      var observer = new MutationObserver(function () {
        var current = el.getAttribute('tabindex');
        if (current !== '-1') {
          // eslint-disable-next-line no-console
          console.warn('[ff_globa11y] tabindex changed/removed', { label: label || '', element: el, tabindex: current });
          try { observer.disconnect(); } catch (e) {}
        }
      });
      observer.observe(el, { attributes: true, attributeFilter: ['tabindex'] });
      el.__ffTabindexObserver = observer;
    } catch (e) {}
  }

  // Intent tracking for multi-page focus (covers no-sessionStorage cases)
  var mpIntent = false;
  function setMpIntent() {
    mpIntent = true;
    try { if (window.sessionStorage) sessionStorage.setItem('fga11y_mp_focus', '1'); } catch (e) {}
  }
  function consumeMpIntent() {
    var had = !!mpIntent;
    mpIntent = false;
    var hadSess = false;
    try {
      if (window.sessionStorage && sessionStorage.getItem('fga11y_mp_focus') === '1') {
        hadSess = true;
        sessionStorage.removeItem('fga11y_mp_focus');
      }
    } catch (e) {}
    return had || hadSess;
  }

  // 1) "Other" inputs: hide duplicate SR labels, move text into aria-label
  function enhanceOtherInputs(context) {
    var $ctx = context ? $(context) : $(document);
    $ctx.find('.frm_other_input').each(function () {
      var $input = $(this);
      var $srLabel = $input.siblings('label.frm_screen_reader').first();
      if ($srLabel.length) {
        $srLabel.css('display', 'none');
        var txt = ($srLabel.text() || '').trim();
        if (txt) $input.attr('aria-label', txt);
      }
    });
  }

  // Remove role=alert from inline field errors when site opts out via filter
  function adjustInlineErrorRoles(context) {
    var REMOVE_ALERT = !!(CFG.remove_alert_role_on_field_errors || CFG.remove_choice_error_alert_role);
    if (!REMOVE_ALERT) return;
    var $ctx = context ? $(context) : $(document);
    $ctx.find('.frm_error_style[role="alert"], .frm_error[role="alert"], .frm_inline_error[role="alert"]').each(function () {
      var $err = $(this);
      if ($err.attr('role') === 'alert') {
        $err.removeAttr('role');
      }
    });
  }

  // 2) Focus management for global errors and success messages
  function focusMessages(context) {
    var $ctx = context ? $(context) : $(document);

    // If Accessible Errors is active, skip error focusing but still handle success.
    if (!CFG.has_accessible_errors && CFG.global_message_focus) {
      // Prefer accessible error summary if present
      var $ffSummary = $ctx.find('.ff-global-errors').first();
      if ($ffSummary.length) {
        var $head = $ffSummary.find('[role="heading"], h2, h3').first();
        if ($head.length) {
          $head.attr('tabindex', '-1');
          try { trackTabindex($head, 'ff-global-errors heading'); } catch (e) {}
          safeFocus($head);
          return;
        }
        $ffSummary.attr('tabindex', '-1');
        try { trackTabindex($ffSummary, 'ff-global-errors container'); } catch (e) {}
        safeFocus($ffSummary);
        return;
      }

      // Legacy/global errors fallback
      var $errorHeading = $ctx.find('.global-errors h2').first();
      if ($errorHeading.length) {
        $errorHeading.attr('tabindex', '-1');
        try { trackTabindex($errorHeading, 'legacy global-errors h2'); } catch (e) {}
        safeFocus($errorHeading);
        return;
      }
    }

    // Success messages
    if (!CFG.success_message_focus) return;
    var $msg = $ctx.find('.frm_message').first();
    if ($msg.length) {
      $msg.attr('tabindex', '-1');
      try { trackTabindex($msg, 'frm_message'); } catch (e) {}
      safeFocus($msg);
      return;
    }
    return;
  }

  // 3) Multi-page: focus H1 in the current page/form after navigation
  function focusFirstHeadingIn($root) {
    var level = parseInt(CFG.multi_page_focus_level, 10);
    if (!(level >= 1 && level <= 6)) level = 1;
    var selector = 'h' + level + ':visible';
    var $h = $root && $root.length ? $root.find(selector).first() : $();
    if (!$h || !$h.length) {
      $h = $(selector).first();
    }
    if ($h.length) {
      safeFocus($h);
      return true;
    }
    return false;
  }

  function attemptFocusH1Around($el, tries, delay) {
    tries = typeof tries === 'number' ? tries : 10;
    delay = typeof delay === 'number' ? delay : 120;
    var $root = $el && $el.length ? $el.closest('form, .frm-show-form, .frm_form_fields') : $(document);
    // Prefer errors over heading after multi-page navigation
    var $foundSummary = $root.find('.ff-global-errors, .global-errors h2').first();
    if (!$foundSummary.length) {
      $foundSummary = $(document).find('.ff-global-errors, .global-errors h2').first();
    }
    if ($foundSummary.length) {
      if (CFG.has_accessible_errors) {
        // Accessible Errors will handle focusing the summary; avoid overriding
        return;
      }
      // Otherwise, use our own message focusing
      focusMessages($foundSummary.closest('form, .frm-show-form, .frm_form_fields').length ? $foundSummary.closest('form, .frm-show-form, .frm_form_fields') : document);
      return;
    }
    var done = focusFirstHeadingIn($root);
    if (done) return;
    if (tries <= 0) return;
    setTimeout(function () { attemptFocusH1Around($el, tries - 1, delay); }, delay);
  }

  $(function () {
    // Track last submitter in case submit happens without a click event
    var lastSubmitter = null;
    if (CFG.multi_page_focus) {
      $(document).on('click keydown', '.frm_next_page, .frm_prev_page', function () {
        lastSubmitter = this;
        setMpIntent();
      });
      // Set flag on submit if the submitter is Next/Prev (handles full reload flows)
      $(document).on('submit', 'form', function (e) {
        var submitter = (e.originalEvent && e.originalEvent.submitter) ? e.originalEvent.submitter : lastSubmitter;
        if (submitter && ($(submitter).is('.frm_next_page, .frm_prev_page'))) {
          setMpIntent();
        }
      });
    }
    if (CFG.other_fields_fix) {
      enhanceOtherInputs(document);
    }
    adjustInlineErrorRoles(document);
    focusMessages(document);
    

    // Multi-page: handle following scenarios
    if (CFG.multi_page_focus) {
      // a) If we previously navigated pages via full reload, focus now
      try {
        if (consumeMpIntent()) {
          attemptFocusH1Around($(document));
        }
      } catch (e) {}

      // b) When clicking next/prev page buttons (AJAX transitions)
      // Set the intent flag but do not pre-focus; wait for content change.
      $(document).on('click', '.frm_next_page, .frm_prev_page', function () {
        setMpIntent();
      });
    }

    $(document).on('ajaxComplete', function () {
      // Scope to Formidable-related AJAX requests only
      var args = arguments;
      try {
        var settings = args && args.length >= 3 ? args[2] : null;
        var url = settings && settings.url ? String(settings.url) : '';
        var dataStr = settings && settings.data != null ? String(settings.data) : '';
        var isFormidableAjax = /admin-ajax\.php|formidable|\bfrm\b|frm_|frm\-/.test(url) || /formidable|\bfrm\b|frm_|frm\-/.test(dataStr);
        if (!isFormidableAjax) {
          return; // ignore unrelated AJAX completions
        }
      } catch (e) {}
      if (CFG.other_fields_fix) {
        enhanceOtherInputs(document);
      }
      adjustInlineErrorRoles(document);
      focusMessages(document);
      // Focus H1 only if a Next/Prev navigation was initiated (session flag)
      if (CFG.multi_page_focus) {
        if (consumeMpIntent()) {
          attemptFocusH1Around($(document));
          // extra retries in case of delayed renders
          setTimeout(function () { attemptFocusH1Around($(document)); }, 200);
          setTimeout(function () { attemptFocusH1Around($(document)); }, 500);
        }
      }
    });

    setTimeout(function () {
      if (CFG.other_fields_fix) {
        enhanceOtherInputs(document);
      }
      adjustInlineErrorRoles(document);

      // Non-AJAX multipage: if we land on a page with a visible Prev button, we are not on page 1
      if (CFG.multi_page_focus) {
        if (consumeMpIntent()) {
          attemptFocusH1Around($(document));
          setTimeout(function () { attemptFocusH1Around($(document)); }, 200);
          return;
        }
        var $prevBtn = $('.frm_prev_page:visible').first();
        if ($prevBtn.length) {
          attemptFocusH1Around($prevBtn);
          setTimeout(function () { attemptFocusH1Around($prevBtn); }, 200);
        }
      }
    }, 0);

    // For AJAX-based multipage transitions, rely on Formidable's event when available
    if (CFG.multi_page_focus) {
      $(document).on('frmPageChanged', function (event, form /*, response */) {
        // Prefer handling when an intent exists, but still attempt as a fallback
        if (consumeMpIntent()) {
          attemptFocusH1Around($(form));
          setTimeout(function () { attemptFocusH1Around($(form)); }, 200);
        } else {
          // Fallback in case intent couldn't be stored (no sessionStorage, keyboard submit, etc.)
          attemptFocusH1Around($(form));
        }
      });
    }
  });
})(jQuery);





