(function ($) {
  'use strict';

  var DROPZONE_SELECTOR = '.frm_dropzone, [id$="_dropzone"]';
  var requestFrame = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (cb) { return setTimeout(cb, 16); };
  var pendingContexts = [];
  var enhanceScheduled = false;

  function hasDropzoneGlobals() {
    return typeof window.__frmDropzone !== 'undefined' || typeof window.__frmAjaxDropzone !== 'undefined';
  }

  function scheduleEnhance(context) {
    var ctx = context || document;
    var hasDocumentQueued = pendingContexts.some(function (item) { return item === document; });

    if (ctx === document) {
      pendingContexts = [document];
    } else if (!hasDocumentQueued) {
      var alreadyQueued = pendingContexts.some(function (item) { return item === ctx; });
      if (!alreadyQueued) {
        pendingContexts.push(ctx);
      }
    }

    if (enhanceScheduled) {
      return;
    }

    enhanceScheduled = true;
    requestFrame(function () {
      enhanceScheduled = false;
      var contexts = pendingContexts.slice();
      pendingContexts = [];
      for (var i = 0; i < contexts.length; i++) {
        enhanceUploads(contexts[i]);
      }
    });
  }

  // Utility: safely focus an element
  function safeFocus($el) {
    if (!$el || !$el.length) return;
    var node = $el.get(0);
    var tag = node && node.tagName ? node.tagName.toLowerCase() : '';
    var isNativeFocusable = tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea';
    var hasTabindex = $el.is('[tabindex]');
    var isContentEditable = $el.is('[contenteditable], [contenteditable="true"]');
    if (!isNativeFocusable && !hasTabindex && !isContentEditable) {
      $el.attr('tabindex', '-1');
    }
    $el.trigger('focus');
  }

  // Focus only if not already focused
  function ensureFocus($el) {
    if (!$el || !$el.length) return;
    if (document.activeElement !== $el.get(0)) {
      safeFocus($el);
    }
  }

  // When the native file dialog closes, browsers/AT can briefly announce the page title.
  // This guard nudges focus back to the live region right after the dialog closes.
  function installDialogCloseFocusRestore($drop, $btn, $live) {
    if (!$btn || !$btn.length) return;
    $btn.off('click.frm-a11y-dlg').on('click.frm-a11y-dlg', function () {
      var active = true;
      var cleanup = function () {
        if (!active) return;
        active = false;
        $(window).off('focus.frm-a11y-dlg');
        $(document).off('focusin.frm-a11y-dlg mousemove.frm-a11y-dlg mouseover.frm-a11y-dlg');
      };
      var scheduleReturn = function () {
        if (!active) return;
        cleanup();
        // Immediately and then shortly after, move focus to the live region
        setTimeout(function () { safeFocus($live); }, 0);
        setTimeout(function () { safeFocus($live); }, 200);
      };
      // Detect return from native dialog across browsers/AT
      $(window).one('focus.frm-a11y-dlg', scheduleReturn);
      $(document).one('focusin.frm-a11y-dlg', scheduleReturn);
      $(document).one('mousemove.frm-a11y-dlg mouseover.frm-a11y-dlg', scheduleReturn);
      // Failsafe timeout to avoid a stuck guard
      setTimeout(function () { scheduleReturn(); }, 5000);
    });
  }

  // Note: non-upload a11y features have moved to the
  // separate "Formidable Global A11y Enhancements" plugin.

  // Create (or get existing) assertive live region next to an upload field
  function getOrCreateLiveRegion($anchorEl, idBase) {
    var regionId = idBase + '-live';
    var $existing = $('#' + regionId);
    if ($existing.length) {
      if (!$existing.is('[tabindex]')) { $existing.attr('tabindex', '-1'); }
      if (!$existing.is('[role]')) { $existing.attr('role', 'status'); }
      return $existing;
    }
    var $region = $('<div/>', {
      id: regionId,
      'class': 'frm-a11y-sr-only',
      'aria-live': 'assertive',
      'aria-atomic': 'true',
      'tabindex': '-1'
    });
    $anchorEl.after($region);
    return $region;
  }

  function clearLiveText($live) {
    if (!$live || !$live.length) return;
    var t = $live.data('frm-a11y-live-timeout');
    if (t) {
      clearTimeout(t);
      $live.removeData('frm-a11y-live-timeout');
    }
    $live.text('');
  }

  function setLiveText($live, text, clearAfterMs) {
    if (!$live || !$live.length) return;
    var t = $live.data('frm-a11y-live-timeout');
    if (t) { clearTimeout(t); }
    $live.text(text);
    if (typeof clearAfterMs === 'number') {
      var tid = setTimeout(function () {
        $live.text('');
        $live.removeData('frm-a11y-live-timeout');
      }, clearAfterMs);
      $live.data('frm-a11y-live-timeout', tid);
    }
  }

  // Try to find the most appropriate visible label to use for aria-labelledby
  function autoFindLabelIdFor($dropzone) {
    // 1) Legend in the nearest fieldset
    var $fs = $dropzone.closest('fieldset');
    if ($fs.length) {
      var $legend = $fs.children('legend').first();
      if ($legend.length) {
        if (!$legend.attr('id')) $legend.attr('id', 'frm-a11y-legend-' + Math.random().toString(36).slice(2));
        return $legend.attr('id');
      }
    }

    // 2) A label associated with a nearby input[type="file"]
    //    Formidable often hides the real <input type="file">, but it still exists in the DOM
    var $file = $dropzone.find('input[type="file"]').first();
    if (!$file.length) $file = $dropzone.parent().find('input[type="file"]').first();
    if ($file.length) {
      var id = $file.attr('id');
      if (id) {
        var $label = $('label[for="' + id + '"]').first();
        if ($label.length) {
          if (!$label.attr('id')) $label.attr('id', 'frm-a11y-label-' + Math.random().toString(36).slice(2));
          return $label.attr('id');
        }
      }
    }

    // 3) A visible text element near the dropzone (fallback)
    var $heading = $dropzone.prevAll('h3,h4,h5,label').first();
    if (!$heading.length) $heading = $dropzone.parent().find('h3,h4,h5,label').first();
    if ($heading.length) {
      if (!$heading.attr('id')) $heading.attr('id', 'frm-a11y-heading-' + Math.random().toString(36).slice(2));
      return $heading.attr('id');
    }

    return null;
  }

  // Get readable filename from Dropzone preview area
  function extractLatestFilename($dropzone) {
    var $name = $dropzone.find('.dz-filename span').last();
    return ($name.text() || '').trim();
  }

  function extractFilenameFromPreview($preview) {
    var $name = $preview.find('.dz-filename span').last();
    return ($name.text() || '').trim();
  }

  // Adjust remove link accessibility for the most recent item
  function fixRemoveLinkA11y($dropzone, filename) {
    var $remove = $dropzone.find('.dz-remove').last();
    if (!$remove.length) return;
    $remove.removeAttr('title');
    $remove.attr('aria-label', filename ? ('Remove file ' + filename) : 'Remove file');
  }

  function fixRemoveLinkA11yForPreview($preview, filename) {
    var $remove = $preview.find('.dz-remove').first();
    if (!$remove.length) return;
    $remove.removeAttr('title');
    $remove.attr('aria-label', filename ? ('Remove file ' + filename) : 'Remove file');
  }

  // After any upload or removal, put focus back on the main upload button
  function refocusUploadButton($btn) {
    if ($btn && $btn.length) $btn.trigger('focus');
  }

  // Find the upload trigger button that actually opens the file chooser
  function findUploadButton($drop) {
    // Try within this dropzone first
    var $btn = $drop.find('.dz-message .frm_upload_text > button').first();
    if ($btn.length) return $btn;
    $btn = $drop.find('.dz-message .frm_compact_text > button').first();
    if ($btn.length) return $btn;
    $btn = $drop.find('.frm_upload_text > button, .frm_compact_text > button').first();
    if ($btn.length) return $btn;

    // Try within the same field container
    var $field = $drop.closest('.frm_form_field, .frm_form_fields, form');
    $btn = $field.find('.frm_upload_text > button, .frm_compact_text > button').first();
    if ($btn.length) return $btn;

    // Fallbacks: look for a button/link inside dropzone that triggers uploads
    $btn = $drop.find('button, .button, .frm_button, a').filter(function () {
      var t = ($(this).text() || '').toLowerCase();
      return t.indexOf('upload') !== -1 || t.indexOf('select file') !== -1 || t.indexOf('choose file') !== -1;
    }).first();

    return $btn;
  }

  function initExistingPreviews($drop, $btn, $live) {
    $drop.find('.dz-preview').each(function () {
      var $p = $(this);
      var name = ($p.find('.dz-filename span').text() || '').trim();
      var $remove = $p.find('.dz-remove');
      if ($remove.length) {
        $remove.removeAttr('title');
        $remove.attr('aria-label', name ? ('Remove file ' + name) : 'Remove file');
        $remove.off('click.frm-a11y').on('click.frm-a11y', handleRemoveClickFactory($drop, $btn, $live));
      }
    });
  }

  function handleRemoveClickFactory($drop, $btn, $live) {
    return function (e) {
      var $remove = $(this);
      var $preview = $remove.closest('.dz-preview');
      var name = extractFilenameFromPreview($preview);

      // Determine next focus target before the DOM updates
      var $allRemoves = $drop.find('.dz-preview .dz-remove');
      var idx = $allRemoves.index($remove);
      var $nextFocus = $();
      if ($allRemoves.length > 1) {
        if (idx < $allRemoves.length - 1) {
          $nextFocus = $allRemoves.eq(idx + 1);
        } else {
          $nextFocus = $allRemoves.eq(idx - 1);
        }
      } else {
        // Focus the upload button when no files remain
        $nextFocus = $btn;
      }

      if ($live && $live.length && name) {
        setLiveText($live, name + ' removed', 1000);
      }

      // After Dropzone removes the node, move focus
      setTimeout(function () {
        if ($nextFocus && $nextFocus.length) {
          safeFocus($nextFocus);
        } else {
          // Fallback to the main upload button
          refocusUploadButton($btn);
        }
      }, 0);
    };
  }

  // Accessible uploads: auto-detect dropzones and wire everything up
  function enhanceUploads(context) {
    var $ctx = context ? $(context) : $(document);
    var $dropzones = $ctx.find(DROPZONE_SELECTOR);

    if (!$dropzones.length) {
      return 0;
    }

    $dropzones.each(function () {
      var $drop = $(this);
      if ($drop.data('frm-a11y-wired')) return;
      $drop.data('frm-a11y-wired', true);

      var $btn = findUploadButton($drop);
      if (!$btn.length) return;

      // If dropzone has aria-describedby, mirror it onto the real button (keep it on the group as well)
      var describedBy = $drop.attr('aria-describedby');
      if (describedBy && !$btn.is('[aria-describedby]')) {
        $btn.attr('aria-describedby', describedBy);
      }

      // Remove redundant group role from the dropzone container to avoid extra announcements
      if ($drop.is('[role="group"]')) {
        $drop.removeAttr('role');
      }

      /* Auto wire aria-labelledby to a meaningful label/legend nearby
      if (!$btn.is('[aria-labelledby]')) {
        var labelId = autoFindLabelIdFor($drop);
        if (labelId) $btn.attr('aria-labelledby', labelId);
      }*/

      // Create/get a live region for this specific dropzone
      var idBase = $drop.attr('id') ? $drop.attr('id') : ('frm-dropzone-' + Math.random().toString(36).slice(2));
      var $live = getOrCreateLiveRegion($drop, idBase);

      // Initialize any existing previews on load (prepopulated files)
      initExistingPreviews($drop, $btn, $live);
      // Install guard to restore focus to the live region after native dialog closes
      installDialogCloseFocusRestore($drop, $btn, $live);

      // Prefer Dropzone instance hooks when available (more stable than DOM)
      function wireDropzoneEvents() {
        var dz = $drop.get(0).dropzone;
        if (!dz || $drop.data('frm-a11y-dz-wired')) return;
        $drop.data('frm-a11y-dz-wired', true);
        $drop.data('frm-a11y-prefer-dz', true);

        dz.on('processing', function (file) {
          // Start announcement and focus
          $drop.data('frm-a11y-uploading', true);
          setLiveText($live, 'Uploading file, please wait');
          // Focus the live region during upload
          safeFocus($live);
        });

        dz.on('success', function (file) {
          var fname = (file && file.name) ? file.name : extractLatestFilename($drop);
          if (fname) { setLiveText($live, fname + ' uploaded', 1000); }
          var $p = $(file && file.previewElement ? file.previewElement : null);
          if ($p && $p.length) {
            fixRemoveLinkA11yForPreview($p, fname);
            $p.find('.dz-filename').off('click.frm-a11y').on('click.frm-a11y', handleRemoveClickFactory($drop, $btn, $live));
            var $filename = $p.find('.dz-filename').first();
            if ($filename.length) safeFocus($filename);
          }
          // Clear uploading state if none processing
          var anyProcessing = $drop.find('.dz-preview.dz-processing').length > 0;
          if (!anyProcessing) { $drop.removeData('frm-a11y-uploading'); }
        });

        dz.on('removedfile', function (file) {
          var fname = (file && file.name) ? file.name : '';
          if (fname) { setLiveText($live, fname + ' removed', 1000); }
          // Focus next available remove or group
          setTimeout(function () {
            var $rem = $drop.find('.dz-preview .dz-remove');
            if ($rem.length) {
              safeFocus($rem.first());
            } else {
              // Focus the upload button when no previews remain
              refocusUploadButton($btn);
            }
          }, 0);
        });
      }

      // Attempt to wire immediately (Dropzone may already be initialized)
      wireDropzoneEvents();

      function markUploading() {
        if ($drop.data('frm-a11y-uploading')) return;
        $drop.data('frm-a11y-uploading', true);
        setLiveText($live, 'Uploading file, please wait');
        // Focus the live region during upload
        safeFocus($live);
      }

      function clearUploadingIfNoneLeft() {
        var anyProcessing = $drop.find('.dz-preview.dz-processing').length > 0;
        if (!anyProcessing) {
          $drop.removeData('frm-a11y-uploading');
        }
      }

      function handlePreviewState($p) {
        if ($drop.data('frm-a11y-prefer-dz')) { return; }
        if (!$p || !$p.length) return;
        // Upload start
        if ($p.hasClass('dz-processing') && !$p.data('frm-a11y-processing-announced')) {
          $p.data('frm-a11y-processing-announced', true);
          markUploading();
        }
        // Upload complete
        if (($p.hasClass('dz-success') || $p.hasClass('dz-complete')) && !$p.data('frm-a11y-success-handled')) {
          $p.data('frm-a11y-success-handled', true);
          var fname = extractFilenameFromPreview($p) || extractLatestFilename($drop);
          if (fname) { setLiveText($live, fname + ' uploaded', 1000); }
          fixRemoveLinkA11yForPreview($p, fname);
          // Ensure remove handlers are bound with focus management
          $p.find('.dz-remove').off('click.frm-a11y').on('click.frm-a11y', handleRemoveClickFactory($drop, $btn, $live));
          // Move focus to this file's remove button
          var $remove = $p.find('.dz-remove').first();
          if ($remove.length) {
            safeFocus($remove);
          }
          clearUploadingIfNoneLeft();
        }
      }

      // Observe Dropzone preview changes and class changes
      var observer = new MutationObserver(function (mutations) {
        try {
          mutations.forEach(function (m) {
            if (m.type === 'childList') {
              $(m.addedNodes).each(function () {
                var $node = $(this);
                if ($node.is('.dz-preview')) {
                  handlePreviewState($node);
                } else if ($node.find && $node.find('.dz-preview').length) {
                  $node.find('.dz-preview').each(function () { handlePreviewState($(this)); });
                }
                // If Dropzone instance appears later, wire events once
                wireDropzoneEvents();
              });
            } else if (m.type === 'attributes' && m.attributeName === 'class') {
              var $target = $(m.target);
              if ($target.is('.dz-preview')) {
                handlePreviewState($target);
              }
              wireDropzoneEvents();
            }
          });
        } catch (err) { /* noop */ }
      });

      try {
        observer.observe($drop.get(0), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      } catch (e) { /* graceful */ }
    });

    return $dropzones.length;
    return $dropzones.length;
  }

  // Run on load and after ajax updates
  $(function () {
    var initialCount = enhanceUploads(document);
    var hasDropzoneSignal = initialCount > 0 || hasDropzoneGlobals();

    if (!hasDropzoneSignal) {
      return;
    }

    // Formidable AJAX lifecycle hooks: re-scan the form context after updates
    $(document).on('frmFormErrors', function (_event, form /*, response */) {
      // Validation errors returned via AJAX; form content was updated
      scheduleEnhance(form);
    });

    $(document).on('frmPageChanged', function (_event, form /*, response */) {
      // Multi-page AJAX navigation; page content replaced
      scheduleEnhance(form);
    });

    // Fallback for jQuery-based AJAX flows on the site
    $(document).on('ajaxComplete', function () {
      scheduleEnhance(document);
    });

    setTimeout(function () {
      scheduleEnhance(document);
    }, 0);

    // Robust fallback for non-jQuery injections (fetch, framework renders, etc.)
    if (window.MutationObserver && document.body) {
      var bodyObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var node = m.addedNodes[j];
              if (node && node.nodeType === 1) {
                // If this node is or contains a dropzone, enhance within this subtree
                if (node.matches && (node.matches(DROPZONE_SELECTOR) || node.querySelector(DROPZONE_SELECTOR))) {
                  scheduleEnhance(node);
                }
              }
            }
          }
        }
      });
      try { bodyObserver.observe(document.body, { childList: true, subtree: true }); } catch (e) { /* noop */ }
    }
  });

})(jQuery);
