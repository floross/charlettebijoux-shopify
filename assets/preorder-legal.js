document.addEventListener('DOMContentLoaded', function () {
  function scope(root) {
    return {
      legal: root.querySelector('[data-preorder-legal]'),
      ack: root.querySelector('#preorder-ack'),
      checkoutBtns: root.querySelectorAll('button[name="checkout"], a[href*="checkout"]'),
    };
  }
  function toggle(root) {
    var s = scope(root);
    var mustAck = !!s.legal && !!s.ack;
    s.checkoutBtns.forEach(function (btn) {
      if (!btn) return;
      if (mustAck && !s.ack.checked) {
        btn.setAttribute('disabled', '');
        btn.setAttribute('aria-disabled', 'true');
      } else {
        btn.removeAttribute('disabled');
        btn.removeAttribute('aria-disabled');
      }
    });
  }
  function wire(root) {
    var s = scope(root);
    if (s.ack) {
      s.ack.addEventListener('change', function () {
        toggle(root);
      });
      toggle(root);
    }
  }

  // Page panier
  var cartPage = document.querySelector('form[action="/cart"]') || document;
  wire(cartPage);

  // Drawer (observe car le contenu change dynamiquement)
  var drawer = document.querySelector('cart-drawer, #CartDrawer') || document;
  var mo = new MutationObserver(function () {
    wire(drawer);
  });
  mo.observe(drawer, { childList: true, subtree: true });
});
