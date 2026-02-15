import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';

  const script = `
(function() {
  'use strict';

  var CHECKOUT_URL = '${appUrl}/checkout';

  function setFrequency(code, label) {
    sessionStorage.setItem('subscription_frequency', code);
    sessionStorage.setItem('subscription_frequency_label', label || '');
  }

  function detectFrequencyFromText(text) {
    if (!text) return false;
    text = String(text).toLowerCase().trim();

    if (/^(her hafta|1 hafta|haftada bir|weekly|every week|every 1 week|1 week)/i.test(text) || text === 'haftada 1') {
      setFrequency('1_week', '1 haftada bir');
      return true;
    }
    if (/^(2 hafta|iki hafta|2 haftada|every 2 week|bi.?weekly)/i.test(text) || text === '2 haftada bir') {
      setFrequency('2_week', '2 haftada bir');
      return true;
    }
    if (/^(3 hafta|uc hafta|3 haftada|every 3 week)/i.test(text) || text === '3 haftada bir') {
      setFrequency('3_week', '3 haftada bir');
      return true;
    }
    if (/^(4 hafta|4 haftada|monthly|aylik|ayda bir|every month|her ay|1 ay)/i.test(text) || text === 'ayda bir') {
      setFrequency('1_month', '1 ayda bir');
      return true;
    }
    if (/^(2 ay|iki ay|2 ayda|every 2 month)/i.test(text)) {
      setFrequency('2_month', '2 ayda bir');
      return true;
    }
    if (/^(3 ay|uc ay|3 ayda|every 3 month|quarterly)/i.test(text)) {
      setFrequency('3_month', '3 ayda bir');
      return true;
    }
    return false;
  }

  function detectCurrentSelection() {
    var all = document.querySelectorAll('.active, .selected, [aria-selected="true"], [aria-checked="true"], [data-active], .is-active, input:checked');
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || '').trim().toLowerCase();
      if (t.length > 80) continue;
      if (t.includes('abonelik') || t.includes('subscription')) {
        sessionStorage.setItem('purchase_type', 'subscription');
        return;
      }
      if (t.includes('tek seferlik') || t.includes('one-time')) {
        sessionStorage.setItem('purchase_type', 'single');
        return;
      }
    }
  }

  function detectCurrentFrequency() {
    var selects = document.querySelectorAll('select');
    for (var i = 0; i < selects.length; i++) {
      var txt = (selects[i].options[selects[i].selectedIndex] && selects[i].options[selects[i].selectedIndex].text) || '';
      if (detectFrequencyFromText(txt)) return;
    }

    var active = document.querySelectorAll('.active, .selected, [aria-selected="true"], input[type="radio"]:checked');
    for (var j = 0; j < active.length; j++) {
      var v = (active[j].textContent || active[j].value || '').toLowerCase();
      if (v.includes('hafta') || v.includes('week') || v.includes('ay') || v.includes('month')) {
        if (detectFrequencyFromText(v)) return;
      }
    }
  }

  function trackPurchaseType() {
    document.addEventListener('click', function(e) {
      var el = e.target;
      var chain = [el];
      var p = el.parentElement;
      for (var i = 0; i < 5 && p; i++) {
        chain.push(p);
        p = p.parentElement;
      }

      for (var j = 0; j < chain.length; j++) {
        var text = (chain[j].textContent || '').trim().toLowerCase();
        if (text.length > 80) continue;

        if (text === 'tek seferlik' || text.includes('tek seferlik') || text === 'one-time') {
          sessionStorage.setItem('purchase_type', 'single');
          sessionStorage.removeItem('subscription_frequency');
          sessionStorage.removeItem('subscription_frequency_label');
          break;
        }
        if (text === 'abonelik' || text.includes('abonelik') || text === 'subscription') {
          sessionStorage.setItem('purchase_type', 'subscription');
          break;
        }

        if (text.includes('hafta') || text.includes('week') || text.includes('ay') || text.includes('month')) {
          detectFrequencyFromText(text);
        }
      }
    }, true);

    document.addEventListener('change', function(e) {
      if (e.target.tagName === 'SELECT') {
        var txt = (e.target.options[e.target.selectedIndex] && e.target.options[e.target.selectedIndex].text) || '';
        detectFrequencyFromText(txt) || detectFrequencyFromText(e.target.value || '');
      }
    }, true);

    setTimeout(function() {
      detectCurrentSelection();
      detectCurrentFrequency();
    }, 600);
  }

  function deriveFromText(text) {
    if (!text) return null;
    var t = String(text).toLowerCase();

    var m1 = t.match(/(\\d+)\\s*(hafta|week|weeks|ay|month|months)/i);
    if (m1) {
      var n = parseInt(m1[1], 10) || 1;
      // Guard against plan/variant IDs accidentally parsed as frequency.
      if (n < 1 || n > 12) n = 1;
      if (/(hafta|week)/i.test(m1[2])) return { code: n + '_week', label: n + ' haftada bir' };
      return { code: n + '_month', label: n + ' ayda bir' };
    }

    if (t.indexOf('haftada bir') !== -1 || t.indexOf('every week') !== -1) return { code: '1_week', label: '1 haftada bir' };
    if (t.indexOf('2 haftada bir') !== -1) return { code: '2_week', label: '2 haftada bir' };
    if (t.indexOf('3 haftada bir') !== -1) return { code: '3_week', label: '3 haftada bir' };
    if (t.indexOf('ayda bir') !== -1 || t.indexOf('every month') !== -1) return { code: '1_month', label: '1 ayda bir' };
    return null;
  }

  function interceptCheckout() {
    document.addEventListener('click', function(e) {
      var target = e.target.closest('a[href*="/checkout"], button[name="checkout"], input[name="checkout"], form[action*="/checkout"] button[type="submit"], .shopify-payment-button button, [data-shopify-checkout]');
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      redirectToOurCheckout();
      return false;
    }, true);

    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (form && form.action && form.action.indexOf('/checkout') !== -1) {
        e.preventDefault();
        e.stopPropagation();
        redirectToOurCheckout();
        return false;
      }
    }, true);
  }

  function redirectToOurCheckout() {
    detectCurrentSelection();
    detectCurrentFrequency();

    fetch('/cart.js')
      .then(function(res) { return res.json(); })
      .then(function(cart) {
        if (!cart.items || cart.items.length === 0) {
          alert('Sepetiniz bos!');
          return;
        }

        var purchaseType = sessionStorage.getItem('purchase_type') || 'single';
        var frequency = sessionStorage.getItem('subscription_frequency') || '';
        var frequencyLabel = sessionStorage.getItem('subscription_frequency_label') || '';
        var planId = '';

        // priority: properties(3) > selling_plan(2) > sku/text(1) > session(0)
        var best = { code: '', label: '', priority: -1 };
        function pick(code, label, priority) {
          if (!code) return;
          if (priority > best.priority) {
            best.code = code;
            best.label = label || '';
            best.priority = priority;
          }
        }

        var mappedItems = cart.items.map(function(item) {
          var img = item.image || '';
          if (img && !img.startsWith('http')) img = 'https:' + img;

          var hasSP = !!item.selling_plan_allocation;
          var hasProp = item.properties && (item.properties._subscription || item.properties.shipping_interval_unit_type || item.properties._seal_subscription);
          if (hasSP || hasProp) purchaseType = 'subscription';

          var propPlanPrice = null;
          if (item.properties && item.properties._plan_price) {
            var raw = String(item.properties._plan_price).replace(',', '.').replace(/[^\\d.]/g, '');
            var parsed = parseFloat(raw);
            if (!isNaN(parsed) && parsed > 0) propPlanPrice = parsed;
          }

          if (item.properties) {
            if (!planId && item.properties._plan_id) {
              planId = String(item.properties._plan_id);
            }

            if (item.properties.shipping_interval_unit_type && item.properties.shipping_interval_frequency) {
              var unit = String(item.properties.shipping_interval_unit_type).toLowerCase();
              var freq = parseInt(item.properties.shipping_interval_frequency, 10) || 1;
              if (freq < 1 || freq > 12) freq = 1;
              if (unit.indexOf('week') !== -1 || unit.indexOf('hafta') !== -1) pick(freq + '_week', freq + ' haftada bir', 3);
              if (unit.indexOf('month') !== -1 || unit.indexOf('ay') !== -1) pick(freq + '_month', freq + ' ayda bir', 3);
            }

            try {
              Object.keys(item.properties).forEach(function(k) {
                var v = item.properties[k];
                if (v == null) return;
                var d = deriveFromText(String(k) + ' ' + String(v));
                if (d) pick(d.code, d.label, 3);
              });
            } catch (_) {}
          }

          if (item.selling_plan_allocation && item.selling_plan_allocation.selling_plan) {
            var d1 = deriveFromText(item.selling_plan_allocation.selling_plan.name || '');
            if (d1) pick(d1.code, d1.label, 2);
          }

          if (item.sku) {
            var d2 = deriveFromText(String(item.sku).replace(/[_-]/g, ' '));
            if (d2) pick(d2.code, d2.label, 1);
          }

          // Price rule:
          // - One-time items always use Shopify cart unit price.
          // - Subscription items use plan price when provided; otherwise fallback to Shopify cart price.
          var isSubscriptionItem = !!hasSP || !!hasProp;
          var effectiveUnitPrice = isSubscriptionItem && propPlanPrice !== null
            ? propPlanPrice
            : (item.price / 100);
          var effectiveLinePrice = effectiveUnitPrice * item.quantity;

          return {
            id: item.product_id,
            variant_id: item.variant_id,
            name: item.product_title,
            variant: item.variant_title || '',
            price: effectiveUnitPrice.toFixed(2),
            line_price: effectiveLinePrice.toFixed(2),
            quantity: item.quantity,
            image: img,
            sku: item.sku || '',
            handle: item.handle || '',
            product_type: item.product_type || '',
            vendor: item.vendor || '',
            requires_shipping: item.requires_shipping,
            properties: item.properties || {},
            selling_plan: item.selling_plan_allocation ? {
              id: item.selling_plan_allocation.selling_plan.id,
              name: item.selling_plan_allocation.selling_plan.name
            } : null
          };
        });

        if (best.code) {
          frequency = best.code;
          frequencyLabel = best.label || frequencyLabel;
          sessionStorage.setItem('subscription_frequency', frequency);
          if (frequencyLabel) sessionStorage.setItem('subscription_frequency_label', frequencyLabel);
        }

        // Final normalization to avoid invalid frequency like "<planId>_week".
        var freqMatch = String(frequency || '').match(/^(\\d+)_(week|month)$/i);
        if (freqMatch) {
          var safeCount = parseInt(freqMatch[1], 10) || 1;
          var safeUnit = String(freqMatch[2]).toLowerCase();
          if (safeCount < 1 || safeCount > 12) safeCount = 1;
          frequency = safeCount + '_' + safeUnit;
          if (!frequencyLabel || /^\\d{6,}/.test(String(frequencyLabel).trim())) {
            frequencyLabel = safeCount + (safeUnit === 'week' ? ' haftada bir' : ' ayda bir');
          }
        } else if (purchaseType === 'subscription') {
          var fallback = deriveFromText(frequencyLabel || '');
          if (fallback) {
            frequency = fallback.code;
            frequencyLabel = fallback.label;
          } else if (/hafta|week/i.test(String(frequencyLabel || ''))) {
            frequency = '1_week';
            frequencyLabel = '1 haftada bir';
          } else if (/(^|\\s)ay|month/i.test(String(frequencyLabel || ''))) {
            frequency = '1_month';
            frequencyLabel = '1 ayda bir';
          }
        }

        var effectiveTotal = mappedItems.reduce(function(sum, item) {
          return sum + (parseFloat(item.line_price) || 0);
        }, 0);

        var cartData = {
          items: mappedItems,
          total: effectiveTotal.toFixed(2),
          total_discount: ((cart.total_discount || 0) / 100).toFixed(2),
          currency: cart.currency,
          item_count: cart.item_count,
          purchase_type: purchaseType,
          subscription_frequency: frequency,
          subscription_frequency_label: frequencyLabel,
          plan_id: planId || '',
          shop_url: window.location.origin,
          shop_name: (window.Shopify && window.Shopify.shop) || window.location.hostname,
          requires_shipping: cart.requires_shipping
        };

        var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cartData))));
        window.location.href = CHECKOUT_URL + '?cart=' + encodeURIComponent(encoded);
      })
      .catch(function(err) {
        console.error('Sepet bilgileri alinamadi:', err);
        alert('Bir hata olustu, lutfen tekrar deneyin.');
      });
  }

  function injectCustomSettingsButton() {
    if (!window.location.pathname || window.location.pathname.indexOf('/cart') === -1) return;

    var checkoutBtn = document.querySelector('button[name="checkout"], input[name="checkout"], a[href*="/checkout"]');
    if (!checkoutBtn) return;

    var host = checkoutBtn.parentElement;
    if (!host) return;
    if (host.querySelector('[data-open-custom-checkout-settings]')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button button--secondary';
    btn.setAttribute('data-open-custom-checkout-settings', '1');
    btn.style.width = '100%';
    btn.style.marginBottom = '10px';
    btn.textContent = 'Teslimat & Abonelik Ayarlari';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      redirectToOurCheckout();
    });

    host.insertBefore(btn, checkoutBtn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      trackPurchaseType();
      interceptCheckout();
      injectCustomSettingsButton();
      setTimeout(injectCustomSettingsButton, 600);
    });
  } else {
    trackPurchaseType();
    interceptCheckout();
    injectCustomSettingsButton();
    setTimeout(injectCustomSettingsButton, 600);
  }
})();
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
