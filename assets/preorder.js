/* assets/preorder.js */
(function () {
  function initFromConfigScript(cfgScript) {
    var sectionId = cfgScript.dataset.sectionId || cfgScript.id.replace('preorder-config-', '');
    var formId = cfgScript.dataset.formId || '';
    var cfg = {};
    try {
      cfg = JSON.parse(cfgScript.textContent || '{}');
    } catch (e) {
      cfg = {};
    }

    function getForm() {
      return formId ? document.getElementById(formId) : document.querySelector('form[action*="/cart/add"]');
    }
    function getEls() {
      var form = getForm();
      return {
        form: form,
        btn: document.getElementById('ProductSubmitButton-' + sectionId),
        propsHost: document.getElementById('preorder-props-' + sectionId),
        dynHost: document.getElementById('preorder-dynamic-' + sectionId),
        fastPay: form ? form.querySelector('.shopify-payment-button, .shopify-payment-button__button') : null,
        idInput: form ? form.querySelector('input[name="id"]') : null,
      };
    }
    function getVariantId(form) {
      var idInput = form && form.querySelector('input[name="id"]');
      return idInput ? idInput.value : null;
    }
    function formatDateFromNow(days) {
      var d = new Date();
      d.setDate(d.getDate() + (parseInt(days || 0) || 0));
      return d.toLocaleDateString(document.documentElement.lang || 'fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    function render() {
      var els = getEls();
      if (!els.form || !els.btn) return;

      var vid = getVariantId(els.form);
      if (!vid || !cfg[vid]) return;

      var v = cfg[vid];
      var inv = Number(v.inventory_quantity || 0);
      var hasNoStock = inv <= 0;

      // Cap atteint ?
      var max = Number(v.max || 0);
      var capReached = false;
      var limitAllows = true;
      if (max > 0 && inv <= 0 - max) {
        limitAllows = false;
        capReached = true;
      }

      var allowPre = !!(v.enabled && hasNoStock && v.can_backorder && limitAllows);
      var mustBlock = !!(hasNoStock && v.can_backorder && !v.enabled);
      var blocked = mustBlock || capReached;

      // --- Toggle disabled + aria ---
      var disable = blocked || (!v.available && !allowPre);
      els.btn.disabled = disable;
      els.btn.setAttribute('aria-disabled', disable ? 'true' : 'false');

      // --- Label (sans casser le spinner) ---
      var labelEl = els.btn.querySelector('span') || els.btn;
      if (allowPre) {
        labelEl.textContent = els.btn.getAttribute('data-label-preorder') || 'Précommande';
      } else if (blocked) {
        labelEl.textContent = els.btn.getAttribute('data-label-soldout') || 'Épuisé';
      } else if (v.available) {
        labelEl.textContent = els.btn.getAttribute('data-label-add') || 'Ajouter au panier';
      } else {
        labelEl.textContent = els.btn.getAttribute('data-label-soldout') || 'Épuisé';
      }

      // --- Inputs cachés (uniquement si préco autorisée) ---
      if (els.propsHost) {
        if (allowPre) {
          var etaDays = Number(v.eta_days || 0);
          var iso = '';
          if (etaDays > 0) {
            var future = new Date();
            future.setDate(future.getDate() + etaDays);
            iso = future.toISOString().slice(0, 10);
          }
          els.propsHost.innerHTML =
            '<input type="hidden" name="properties[Preorder]" value="true">' +
            (etaDays > 0 ? '<input type="hidden" name="properties[Estimated shipping]" value="' + iso + '">' : '');
        } else {
          els.propsHost.innerHTML = '';
        }
      }

      // --- Texte dynamique : ETA seulement si préco autorisée ---
      if (els.dynHost) {
        var tEta = els.dynHost.dataset.i18nEtaTemplate || 'Expédition estimée : __DATE__ (__DAYS__ jours).';
        var html = '';
        if (allowPre) {
          var etaDays2 = Number(v.eta_days || 0);
          if (etaDays2 > 0) {
            var dateStr = formatDateFromNow(etaDays2);
            html = '<p>' + tEta.replace('__DATE__', dateStr).replace('__DAYS__', etaDays2) + '</p>';
          }
        } else {
          html = '';
        }
        els.dynHost.innerHTML = html;
      }

      // --- Paiement accéléré (masqué quand bloqué ou non dispo sans préco) ---
      if (els.fastPay) {
        els.fastPay.style.display = blocked || (!v.available && !allowPre) ? 'none' : '';
      }
    }

    // Init + écoutes
    render();
    document.addEventListener('change', function (e) {
      if (e.target && e.target.closest && e.target.closest('form[action*="/cart/add"]')) render();
    });
    document.addEventListener('variant:changed', render);
    document.addEventListener('variantChange', render);
    document.addEventListener('shopify:section:load', function (e) {
      if (e.detail && e.detail.sectionId === sectionId) render();
    });

    // Fallback robuste: observe l’input id
    var els0 = getEls();
    if (els0.idInput) {
      var last = els0.idInput.value;
      var obs = new MutationObserver(function () {
        var now = getEls();
        if (!now.idInput) return;
        if (now.idInput.value !== last) {
          last = now.idInput.value;
          render();
        }
      });
      obs.observe(els0.idInput, { attributes: true, attributeFilter: ['value'] });
    }
  }

  function initAll() {
    document.querySelectorAll('script[id^="preorder-config-"]').forEach(initFromConfigScript);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  document.addEventListener('shopify:section:load', initAll);
})();
