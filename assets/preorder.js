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

    // ---------- HELPERS DOM ----------
    function getSectionRoot() {
      return document.getElementById('shopify-section-' + sectionId) || document;
    }
    function getVariantSelects() {
      // priorité à <variant-selects data-section="...">
      var root = getSectionRoot();
      return (
        root.querySelector('variant-selects[data-section="' + sectionId + '"]') ||
        root.querySelector('#variant-selects-' + sectionId) ||
        root.querySelector('variant-selects')
      );
    }
    function getForm() {
      var vs = getVariantSelects();
      // le form est parent proche de variant-selects dans Dawn
      return (
        (vs && vs.closest('form')) ||
        (formId ? document.getElementById(formId) : document.querySelector('form[action*="/cart/add"]'))
      );
    }
    function getEls() {
      var form = getForm();
      return {
        root: getSectionRoot(),
        vs: getVariantSelects(),
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

    // ---------- INDEX VARIANTES ----------
    // au moment où on construit variants depuis cfg :
    var variants = Object.keys(cfg).map(function (id) {
      var v = cfg[id] || {};
      return {
        id,
        options: Array.isArray(v.options) ? v.options.map(String) : [],
        purchasable: !!v.purchasable, // <= utiliser tel quel
        available: !!v.available,
        allow_preorder: !!v.allow_preorder,
        blocked: !!v.blocked,
        eta_days: Number(v.eta_days || 0),
      };
    });

    // ---------- LOGIQUE D’ACTIVATION ----------
    function matchesCandidate(v, candidate) {
      // candidate = ['Or rouge', null, 'M'] ; null = indifférent
      for (var i = 0; i < 3; i++) {
        if (candidate[i] != null && v.options[i] !== candidate[i]) return false;
      }
      return true;
    }
    function anyVariantEnabledFor(candidate) {
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        if (!matchesCandidate(v, candidate)) continue;
        if (v.purchasable) return true; // <= clé : on regarde "purchasable"
      }
      return false;
    }

    // ---------- LECTURE DES OPTIONS SELECTIONNÉES ----------

    // Sélection courante (longueur = nb de groupes). On combine variante courante + DOM.
    function readSelectedOptions() {
      var groups = getOptionGroups();
      var selected = new Array(groups.length).fill(null);

      var els = getEls();
      var vid = getVariantId(els.form);
      if (vid && cfg[vid] && Array.isArray(cfg[vid].options)) {
        var cur = cfg[vid].options;
        for (var i = 0; i < groups.length && i < cur.length; i++) selected[i] = cur[i];
      }

      // overlay DOM (si l'id n'a pas encore bougé)
      groups.forEach(function (group, idx) {
        var r = group.querySelector('input[type="radio"]:checked');
        if (r) selected[idx] = r.value;
        var s = group.querySelector('select');
        if (s && s.value) selected[idx] = s.value;
      });

      return selected;
    }

    // Lit les groupes d'options (fieldset) dans <variant-selects> ou fallback form
    function getOptionGroups() {
      var root = getSectionRoot();
      var vs =
        root.querySelector('variant-selects[data-section="' + sectionId + '"]') ||
        root.querySelector('variant-selects') ||
        root;
      var groups = Array.from(vs.querySelectorAll('fieldset'));
      if (!groups.length) {
        var form = getForm();
        if (form) groups = Array.from(form.querySelectorAll('fieldset'));
      }
      return groups.filter(function (g) {
        return g.querySelector('input[type="radio"], select');
      });
    }

    function labelForInput(input, scope) {
      return (scope || document).querySelector('label[for="' + input.id + '"]');
    }

    // Existe-t-il AU MOINS une variante achetable correspondante au préfixe (0..i) ?
    function anyVariantEnabledForPrefix(prefixValues, lastIndex) {
      for (var k = 0; k < variants.length; k++) {
        var v = variants[k];
        if (!v.purchasable) continue; // décision serveur: disponible OU préco autorisée et non bloquée
        var ok = true;
        for (var j = 0; j <= lastIndex; j++) {
          var wanted = prefixValues[j];
          if (wanted != null && v.options[j] !== wanted) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
      return false;
    }

    // Désactive uniquement les enfants; le parent n’est disabled que si tous ses enfants le sont.
    function updateOptionStates() {
      var groups = getOptionGroups();
      if (!groups.length || !variants.length) return;

      var selected = readSelectedOptions();

      groups.forEach(function (group, groupIndex) {
        // --- Radios ---
        var radios = Array.from(group.querySelectorAll('input[type="radio"]'));
        var checkedRadio = radios.find(function (r) {
          return r.checked;
        });

        radios.forEach(function (input) {
          var prefix = selected.slice(0, groupIndex); // fige les parents
          prefix[groupIndex] = input.value; // candidate à ce niveau

          var enable = anyVariantEnabledForPrefix(prefix, groupIndex);

          // propriété + attribut (certains styles lisent l'attribut)
          input.disabled = !enable;
          if (!enable) input.setAttribute('disabled', '');
          else input.removeAttribute('disabled');
          input.setAttribute('aria-disabled', !enable ? 'true' : 'false');

          // style sur le label
          var lbl = labelForInput(input, group);
          if (lbl) lbl.classList.toggle('disabled', !enable);

          // accessibilité facultative pour le span .label-unavailable
          var un = lbl && lbl.querySelector('.label-unavailable');
          if (un) un.hidden = enable;
        });

        // si la valeur cochée devient disabled -> bascule sur la 1re activable
        if (checkedRadio && checkedRadio.disabled) {
          var fallback = radios.find(function (r) {
            return !r.disabled;
          });
          if (fallback && !fallback.checked) {
            fallback.checked = true;
            fallback.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // --- Selects ---
        var select = group.querySelector('select');
        if (select) {
          Array.prototype.forEach.call(select.options, function (opt) {
            if (!opt.value) return;
            var prefix = selected.slice(0, groupIndex);
            prefix[groupIndex] = opt.value;
            var enable = anyVariantEnabledForPrefix(prefix, groupIndex);
            opt.disabled = !enable;
            if (!enable) opt.setAttribute('disabled', '');
            else opt.removeAttribute('disabled');
          });

          var cur = select.options[select.selectedIndex];
          if (cur && cur.disabled) {
            var firstOk = Array.prototype.find.call(select.options, function (o) {
              return o.value && !o.disabled;
            });
            if (firstOk) {
              select.value = firstOk.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      });
    }

    // ---------- RENDER BOUTON + ETA (inchangé) ----------
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
      if (!els.form || !els.btn) {
        updateOptionStates();
        return;
      }

      var vid = getVariantId(els.form);
      if (!vid || !cfg[vid]) {
        updateOptionStates();
        return;
      }

      var v = cfg[vid];
      var allowPre = !!v.allow_preorder;
      var blocked = !!v.blocked;
      var available = !!v.available;

      // bouton principal
      var disable = blocked || (!available && !allowPre);
      els.btn.disabled = disable;
      els.btn.setAttribute('aria-disabled', disable ? 'true' : 'false');

      var labelEl = els.btn.querySelector('span') || els.btn;
      if (allowPre) {
        labelEl.textContent = els.btn.getAttribute('data-label-preorder') || 'Précommande';
      } else if (blocked) {
        labelEl.textContent = els.btn.getAttribute('data-label-soldout') || 'Épuisé';
      } else if (available) {
        labelEl.textContent = els.btn.getAttribute('data-label-add') || 'Ajouter au panier';
      } else {
        labelEl.textContent = els.btn.getAttribute('data-label-soldout') || 'Épuisé';
      }

      // props cachées
      if (els.propsHost) {
        var etaDays = Number(v.eta_days || 0);
        if (allowPre) {
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

      // ETA dynamique
      if (els.dynHost) {
        var tEta = els.dynHost.dataset.i18nEtaTemplate || 'Expédition estimée : __DATE__ (__DAYS__ jours).';
        var html = '';
        if (allowPre) {
          var etaDays2 = Number(v.eta_days || 0);
          if (etaDays2 > 0) {
            var dateStr = formatDateFromNow(etaDays2);
            html = '<p>' + tEta.replace('__DATE__', dateStr).replace('__DAYS__', etaDays2) + '</p>';
          }
        }
        els.dynHost.innerHTML = html;
        els.dynHost.toggleAttribute('hidden', !(allowPre && Number(v.eta_days || 0) > 0));
      }

      // Paiement accéléré
      if (els.fastPay) {
        els.fastPay.style.display = blocked || (!available && !allowPre) ? 'none' : '';
      }

      // Désactivation des valeurs d’options
      updateOptionStates();
    }

    // ---------- INIT + ÉCOUTES ----------
    render();

    // toute interaction dans le sélecteur de variantes
    var root = getSectionRoot();
    root.addEventListener('change', function (e) {
      if (e.target && (e.target.type === 'radio' || e.target.tagName === 'SELECT')) render();
    });

    document.addEventListener('variant:changed', render);
    document.addEventListener('variantChange', render);
    document.addEventListener('shopify:section:load', function (e) {
      if (e.detail && e.detail.sectionId === sectionId) render();
    });

    // observe les re-rendus de <variant-selects>
    var vs = getVariantSelects() || getSectionRoot();
    var mo = new MutationObserver(function () {
      updateOptionStates();
    });
    mo.observe(vs, { childList: true, subtree: true });

    // fallback : observe l’input id
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  document.addEventListener('shopify:section:load', initAll);
})();
