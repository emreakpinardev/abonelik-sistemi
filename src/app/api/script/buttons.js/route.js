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

    if (/^(gunluk|günlük|gunde bir|günde bir|her gun|her gün|daily|every day|every 1 day|1 gun|1 gün)/i.test(text)) {
      setFrequency('1_day', '1 gunde bir');
      return true;
    }
    if (/^(2 gun|2 gün|iki gun|iki gün|2 gunde|2 günde|every 2 day)/i.test(text)) {
      setFrequency('2_day', '2 gunde bir');
      return true;
    }
    if (/^(3 gun|3 gün|uc gun|üç gün|3 gunde|3 günde|every 3 day)/i.test(text)) {
      setFrequency('3_day', '3 gunde bir');
      return true;
    }
    if (/^(dakikalik|dakikada bir|her dakika|minutely|every minute|1 minute|1 dakika)/i.test(text)) {
      setFrequency('1_minute', '1 dakikada bir');
      return true;
    }
    if (/^(5 dakika|5 dakikada|every 5 minute)/i.test(text)) {
      setFrequency('5_minute', '5 dakikada bir');
      return true;
    }
    if (/^(10 dakika|10 dakikada|every 10 minute)/i.test(text)) {
      setFrequency('10_minute', '10 dakikada bir');
      return true;
    }
    if (/^(30 dakika|30 dakikada|every 30 minute)/i.test(text)) {
      setFrequency('30_minute', '30 dakikada bir');
      return true;
    }
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
    if (/^(4 hafta|4 haftada|every 4 week|4 weekly)/i.test(text) || text === '4 haftada bir') {
      setFrequency('4_week', '4 haftada bir');
      return true;
    }
    if (/^(monthly|aylik|ayda bir|every month|her ay|1 ay)/i.test(text) || text === 'ayda bir') {
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
      if (v.includes('hafta') || v.includes('week') || v.includes('ay') || v.includes('month') || v.includes('gun') || v.includes('gün') || v.includes('day') || v.includes('dakika') || v.includes('minute')) {
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

        if (text.includes('hafta') || text.includes('week') || text.includes('ay') || text.includes('month') || text.includes('dakika') || text.includes('minute')) {
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

    var m1 = t.match(/(\\d+)\\s*(hafta|week|weeks|weekly|ay|month|months|monthly|gun|gün|day|days|daily|dakika|min|minute|minutes|minutely)/i);
    if (m1) {
      var n = parseInt(m1[1], 10) || 1;
      // Guard against plan/variant IDs accidentally parsed as frequency.
      var token = String(m1[2] || '').toLowerCase();
      var isMinute = /(dakika|min|minute|minutes|minutely)/i.test(token);
      var isDay = /(gun|gün|day|days|daily)/i.test(token);
      var max = isMinute ? 1440 : isDay ? 365 : 12;
      if (n < 1 || n > max) n = 1;
      if (isMinute) return { code: n + '_minute', label: n + ' dakikada bir' };
      if (isDay) return { code: n + '_day', label: n + ' gunde bir' };
      if (/(hafta|week|weekly)/i.test(m1[2])) return { code: n + '_week', label: n + ' haftada bir' };
      return { code: n + '_month', label: n + ' ayda bir' };
    }

    // "weekly 3" / "monthly 2" / "daily 2" / "minutely 5" style labels
    var m2 = t.match(/(weekly|monthly|daily|minutely)\\s*(\\d+)/i);
    if (m2) {
      var n2 = parseInt(m2[2], 10) || 1;
      var isM2Minute = /minutely/i.test(m2[1]);
      var isM2Day = /daily/i.test(m2[1]);
      var max2 = isM2Minute ? 1440 : isM2Day ? 365 : 12;
      if (n2 < 1 || n2 > max2) n2 = 1;
      if (isM2Minute) return { code: n2 + '_minute', label: n2 + ' dakikada bir' };
      if (isM2Day) return { code: n2 + '_day', label: n2 + ' gunde bir' };
      if (/weekly/i.test(m2[1])) return { code: n2 + '_week', label: n2 + ' haftada bir' };
      return { code: n2 + '_month', label: n2 + ' ayda bir' };
    }

    if (t.indexOf('gunde bir') !== -1 || t.indexOf('günde bir') !== -1 || t.indexOf('her gun') !== -1 || t.indexOf('her gün') !== -1 || t.indexOf('every day') !== -1 || t.indexOf('daily') !== -1 || t.indexOf('gunluk') !== -1 || t.indexOf('günlük') !== -1) return { code: '1_day', label: '1 gunde bir' };
    if (t.indexOf('dakikada bir') !== -1 || t.indexOf('every minute') !== -1 || t.indexOf('minutely') !== -1) return { code: '1_minute', label: '1 dakikada bir' };
    if (t.indexOf('haftada bir') !== -1 || t.indexOf('every week') !== -1) return { code: '1_week', label: '1 haftada bir' };
    if (t.indexOf('2 haftada bir') !== -1) return { code: '2_week', label: '2 haftada bir' };
    if (t.indexOf('3 haftada bir') !== -1) return { code: '3_week', label: '3 haftada bir' };
    if (t.indexOf('ayda bir') !== -1 || t.indexOf('every month') !== -1) return { code: '1_month', label: '1 ayda bir' };
    if (t.indexOf('weekly') !== -1) return { code: '1_week', label: '1 haftada bir' };
    if (t.indexOf('monthly') !== -1) return { code: '1_month', label: '1 ayda bir' };
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

  // Remove legacy button injected by older script versions.
  function cleanupLegacySettingsButtons() {
    try {
      document.querySelectorAll('[data-open-custom-checkout-settings]').forEach(function(el) { el.remove(); });
      document.querySelectorAll('button, a').forEach(function(el) {
        var txt = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (txt.includes('teslimat') && txt.includes('abonelik') && txt.includes('ayar')) {
          el.remove();
        }
      });
    } catch (_) {}
  }

  function redirectToOurCheckout() {
    detectCurrentSelection();
    detectCurrentFrequency();
    function normalizeDeliveryKey(v) {
      return String(v || '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'g')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/\\s+/g, ' ')
        .trim();
    }
    function inferDeliveryFromItems(items) {
      var out = { date: '', day: '', dayName: '' };
      if (!Array.isArray(items)) return out;
      for (var i = 0; i < items.length; i++) {
        var props = (items[i] && items[i].properties) || {};
        var keys = Object.keys(props);
        for (var j = 0; j < keys.length; j++) {
          var rawKey = keys[j];
          var key = normalizeDeliveryKey(rawKey);
          var value = String(props[rawKey] == null ? '' : props[rawKey]).trim();
          if (!value) continue;
          if (!out.date && (key === 'delivery date' || key === 'delivery_date' || key === 'teslimat tarihi' || key === 'teslimat_tarihi')) out.date = value;
          if (!out.day && (key === 'delivery day' || key === 'delivery_day')) out.day = value;
          if (!out.dayName && (key === 'teslimat gunu' || key === 'teslimat_gunu' || key === 'delivery day name' || key === 'delivery_day_name')) out.dayName = value;
        }
      }
      return out;
    }
    var readDeliveryField = function(selectors) {
      for (var i = 0; i < selectors.length; i += 1) {
        var el = document.querySelector(selectors[i]);
        if (el && typeof el.value === 'string' && el.value.trim()) return el.value.trim();
      }
      return '';
    };
    var deliveryDateTop = readDeliveryField([
      'input[name="properties[Delivery date]"]',
      'input[name="properties[delivery_date]"]',
      'input[name="properties[Teslimat tarihi]"]',
      'input[name="properties[teslimat_tarihi]"]',
      'input[id^="delivery-date-"]'
    ]);
    var deliveryDayTop = readDeliveryField([
      'input[name="properties[delivery_day]"]',
      'input[name="properties[Delivery day]"]',
      'input[id^="delivery-day-en-"]'
    ]);
    var deliveryDayNameTop = readDeliveryField([
      'input[name="properties[Teslimat Günü]"]',
      'input[name="properties[Teslimat Gunu]"]',
      'input[name="properties[teslimat_gunu]"]',
      'input[id^="delivery-day-name-"]'
    ]);

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

        // priority: variant/selling_plan > properties > sku/text > session
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
              var maxFreq = (unit.indexOf('minute') !== -1 || unit.indexOf('dakika') !== -1 || unit.indexOf('min') !== -1) ? 1440 : ((unit.indexOf('day') !== -1 || unit.indexOf('gun') !== -1 || unit.indexOf('gün') !== -1) ? 365 : 12);
              if (freq < 1 || freq > maxFreq) freq = 1;
              if (unit.indexOf('week') !== -1 || unit.indexOf('hafta') !== -1) pick(freq + '_week', freq + ' haftada bir', 2);
              if (unit.indexOf('month') !== -1 || unit.indexOf('ay') !== -1) pick(freq + '_month', freq + ' ayda bir', 2);
              if (unit.indexOf('day') !== -1 || unit.indexOf('gun') !== -1 || unit.indexOf('gün') !== -1) pick(freq + '_day', freq + ' gunde bir', 2);
              if (unit.indexOf('minute') !== -1 || unit.indexOf('dakika') !== -1 || unit.indexOf('min') !== -1) pick(freq + '_minute', freq + ' dakikada bir', 2);
            }

            try {
              Object.keys(item.properties).forEach(function(k) {
                var v = item.properties[k];
                if (v == null) return;
                var d = deriveFromText(String(k) + ' ' + String(v));
                if (d) pick(d.code, d.label, 2);
              });
            } catch (_) {}
          }

          if (item.selling_plan_allocation && item.selling_plan_allocation.selling_plan) {
            var d1 = deriveFromText(item.selling_plan_allocation.selling_plan.name || '');
            if (d1) pick(d1.code, d1.label, 4);
          }

          // Fallback for subscription variants like "Subscription 3 weekly"
          if (item.variant_title) {
            var dVariant = deriveFromText(item.variant_title || '');
            if (dVariant) pick(dVariant.code, dVariant.label, 5);
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
        var freqMatch = String(frequency || '').match(/^(\\d+)_(week|month|day|minute)$/i);
        if (freqMatch) {
          var safeCount = parseInt(freqMatch[1], 10) || 1;
          var safeUnit = String(freqMatch[2]).toLowerCase();
          var safeMax = safeUnit === 'minute' ? 1440 : (safeUnit === 'day' ? 365 : 12);
          if (safeCount < 1 || safeCount > safeMax) safeCount = 1;
          frequency = safeCount + '_' + safeUnit;
          if (!frequencyLabel || /^\\d{6,}/.test(String(frequencyLabel).trim())) {
            frequencyLabel = safeCount + (safeUnit === 'week' ? ' haftada bir' : safeUnit === 'day' ? ' gunde bir' : safeUnit === 'minute' ? ' dakikada bir' : ' ayda bir');
          }
        } else if (purchaseType === 'subscription') {
          var fallback = deriveFromText(frequencyLabel || '');
          if (fallback) {
            frequency = fallback.code;
            frequencyLabel = fallback.label;
          } else if (/hafta|week/i.test(String(frequencyLabel || ''))) {
            frequency = '1_week';
            frequencyLabel = '1 haftada bir';
          } else if (/gun|gün|day|daily/i.test(String(frequencyLabel || ''))) {
            frequency = '1_day';
            frequencyLabel = '1 gunde bir';
          } else if (/dakika|minute|min/i.test(String(frequencyLabel || ''))) {
            frequency = '1_minute';
            frequencyLabel = '1 dakikada bir';
          } else if (/(^|\\s)ay|month/i.test(String(frequencyLabel || ''))) {
            frequency = '1_month';
            frequencyLabel = '1 ayda bir';
          }
        }

        var effectiveTotal = mappedItems.reduce(function(sum, item) {
          return sum + (parseFloat(item.line_price) || 0);
        }, 0);
        var inferredDelivery = inferDeliveryFromItems(mappedItems);
        var effectiveDeliveryDate = deliveryDateTop || inferredDelivery.date || sessionStorage.getItem('delivery_date') || '';
        var effectiveDeliveryDay = deliveryDayTop || inferredDelivery.day || sessionStorage.getItem('delivery_day') || '';
        var effectiveDeliveryDayName = deliveryDayNameTop || inferredDelivery.dayName || sessionStorage.getItem('delivery_day_name') || '';
        if (effectiveDeliveryDate) sessionStorage.setItem('delivery_date', effectiveDeliveryDate);
        if (effectiveDeliveryDay) sessionStorage.setItem('delivery_day', effectiveDeliveryDay);
        if (effectiveDeliveryDayName) sessionStorage.setItem('delivery_day_name', effectiveDeliveryDayName);

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
          delivery_date: effectiveDeliveryDate,
          delivery_day: effectiveDeliveryDay,
          delivery_day_name: effectiveDeliveryDayName,
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      cleanupLegacySettingsButtons();
      trackPurchaseType();
      interceptCheckout();
      setTimeout(cleanupLegacySettingsButtons, 300);
    });
  } else {
    cleanupLegacySettingsButtons();
    trackPurchaseType();
    interceptCheckout();
    setTimeout(cleanupLegacySettingsButtons, 300);
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
