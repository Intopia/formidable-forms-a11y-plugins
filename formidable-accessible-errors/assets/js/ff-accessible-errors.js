(function ($) {
  'use strict';

  /**
   * Focus the error summary if present.
   * Works on first load (non-AJAX submit) and when AJAX re-renders error markup.
   */
	function focusErrorSummaryIfPresent(root) {
	  var $summary = $(root || document).find('.ff-global-errors').first();
	  if ($summary.length) {
		$summary.attr('tabindex', '-1');
		// Native focus (prefer) with fallback to jQuery
		if ($summary[0] && $summary[0].focus) {
			try { $summary[0].focus(); } catch (e) {}
		} else
		{
			$summary.trigger('focus');
		}
	  }
	}

  /**
   * Smoothly scroll to the field container and focus a sensible target inside it.
   */
  function jumpToField(fieldId) {
    var containerId = '#frm_field_' + fieldId + '_container';
    var $container = $(containerId);
    if ($container.length) {
      // Scroll to container.
      $container[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Find a focusable form control inside the container.
		var $focusTarget = $container
		  .find('input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])')
		  .filter(':visible')
		  .first();

		if (!$focusTarget.length) {
		  $focusTarget = $container.find('input, select, textarea').filter(':visible').first();
		}
		setTimeout(function () {
		  if ($focusTarget.length) {
			$focusTarget.trigger('focus');
		  } else {
			$container.attr('tabindex', '-1').trigger('focus');
		  }
		}, 250);
    }
  }

  /**
   * Bind click handlers for error links (delegated)
   */
  function bindErrorLinkNavigation(root) {
    $(root || document).off('click.ffErrorLink', '.ff-error-link').on('click.ffErrorLink', '.ff-error-link', function (e) {
      var fieldId = $(this).attr('data-ff-field-id');
      if (fieldId) {
        e.preventDefault();
        jumpToField(fieldId);
      }
    });
  }

  /**
   * Handle initial load (non-AJAX).
   */
 $(function () {
    focusErrorSummaryIfPresent(document);
    bindErrorLinkNavigation(document);
	muteDefaultFormidableAlert(document);
	decorateInlineErrors(document);
    observeFormidableContainers(document);
    bootstrapFormObserver();
	
	// When an AJAX submit returns validation errors
	$(document).on('frmFormErrors', function (event, form, response) {
	  // `form` is the <form> element that was just updated
	  decorateInlineErrors(form);
	  bindErrorLinkNavigation(form);
	  muteDefaultFormidableAlert($(form).parent());
	  focusErrorSummaryIfPresent(form);
      observeFormidableContainers(form);
	});

	// Multipage forms with AJAX page loads:
	$(document).on('frmPageChanged', function (event, form, response) {
	  decorateInlineErrors(form);
	  bindErrorLinkNavigation(form);
	  muteDefaultFormidableAlert($(form).parent()); // or muteDefaultFormidableAlert(form);
      observeFormidableContainers(form);
	});

	
  });

  /**
   * Handle AJAX forms:
   * Formidable re-renders portions of the form after an AJAX submit with errors.
   * Observe only the relevant Formidable wrappers for insertion of ".ff-global-errors".
   */
  function processAddedNode($node) {
    if (!$node || !$node.length) {
      return;
    }

    if ($node.is('.ff-global-errors') || $node.find('.ff-global-errors').length) {
      focusErrorSummaryIfPresent($node);
      bindErrorLinkNavigation($node);
    }

    muteDefaultFormidableAlert($node);
    decorateInlineErrors($node);
  }

  function handleFormMutations(mutationsList) {
    for (var i = 0; i < mutationsList.length; i++) {
      var mutation = mutationsList[i];

      if (mutation.type !== 'childList' || !mutation.addedNodes || !mutation.addedNodes.length) {
        continue;
      }

      $(mutation.addedNodes).each(function () {
        if (this && this.nodeType === 1) {
          var $node = $(this);
          processAddedNode($node);
          observeFormidableContainers($node);
        }
      });
    }
  }

  function observeFormidableContainers(root) {
    if (!window.MutationObserver) {
      return;
    }

    $(root || document).find('.frm_forms').each(function () {
      var el = this;
      if (el.nodeType !== 1 || el.getAttribute('data-ff-error-watching') === '1') {
        return;
      }

      var observer = new MutationObserver(handleFormMutations);
      observer.observe(el, { childList: true, subtree: true });
      el.setAttribute('data-ff-error-watching', '1');
      el.ffAccessibleErrorsObserver = observer;
    });
  }

  function bootstrapFormObserver() {
    if (!window.MutationObserver || !document.body) {
      return;
    }

    var bootstrapObserver = new MutationObserver(function (mutationsList) {
      for (var i = 0; i < mutationsList.length; i++) {
        var mutation = mutationsList[i];
        if (mutation.type !== 'childList' || !mutation.addedNodes || !mutation.addedNodes.length) {
          continue;
        }

        $(mutation.addedNodes).each(function () {
          if (this && this.nodeType === 1) {
            var node = this;
            var matches =
              node.matches || node.msMatchesSelector || node.webkitMatchesSelector;

            if (matches && matches.call(node, '.frm_forms')) {
              observeFormidableContainers(node);
            } else if (node.querySelector && node.querySelector('.frm_forms')) {
              observeFormidableContainers(node);
            }
          }
        });
      }
    });

    bootstrapObserver.observe(document.body, { childList: true, subtree: true });
  }
/*Remove role=alert from formidables page level error div*/
function muteDefaultFormidableAlert(root) {
  var $root = $(root || document);
  // Target Formidable's default top message wrapper
  $root.find('.frm_error_style[role="alert"]').each(function () {
    // Only mute once
    if (!this.hasAttribute('data-ff-muted')) {
      this.removeAttribute('role');           // remove live alerting
      this.setAttribute('data-ff-muted', '1');
    }
  });
}
/*Adds icon to inline errors*/
function decorateInlineErrors(root) {
  var $root = jQuery(root || document);
  // Respect PHP toggle passed via wp_localize_script
  if (!window.FFAE || !FFAE.inlineIconEnabled) return;

  $root.find('.frm_error, .frm_inline_error').each(function () {
    var el = this;
    if (el.hasAttribute('data-ff-decorated')) return;
    el.setAttribute('data-ff-decorated', '1');

    // Build a <span> with role="img" and aria-label, containing an inline SVG
    var span = document.createElement('span');
    span.className = 'ff-inline-error-icon';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', (FFAE.inlineIconAriaLabel || 'Error:'));

    // Inline SVG is decorative; the span carries the accessible name.
    span.innerHTML =
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" ' +
      'viewBox="0 0 20 20" width="16" height="16">' +
      '<path fill="currentColor" d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm1 15H9v-2h2Zm0-4H9V5h2Z"/>' +
      '</svg>';

    // Insert before the text/content
    el.insertBefore(span, el.firstChild);
  });
}


})(jQuery);
