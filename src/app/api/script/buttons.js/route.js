import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';

    const script = `
(function() {
    'use strict';

    var CHECKOUT_URL = '${appUrl}/checkout';

    // ===== URUN SAYFASINDA SATIN ALMA TIPINI + FREKANSINI YAKALA =====
    function trackPurchaseType() {
        // HER TIKLAMADA kontrol et
        document.addEventListener('click', function(e) {
            var el = e.target;
            var checkEls = [el];
            var parent = el.parentElement;
            for (var i = 0; i < 5 && parent; i++) {
                checkEls.push(parent);
                parent = parent.parentElement;
            }

            for (var j = 0; j < checkEls.length; j++) {
                var text = (checkEls[j].textContent || '').trim().toLowerCase();
                if (text.length > 50) continue;

                // Satin alma tipi
                if (text === 'tek seferlik' || text === 'one-time' || text === 'one time' || text.includes('tek seferlik')) {
                    sessionStorage.setItem('purchase_type', 'single');
                    sessionStorage.removeItem('subscription_frequency');
                    console.log('[SKYCROPS] ✅ Tip: TEK SEFERLIK');
                    break;
                } else if (text === 'abonelik' || text === 'subscription' || text === 'subscribe' || text.includes('abonelik')) {
                    sessionStorage.setItem('purchase_type', 'subscription');
                    console.log('[SKYCROPS] ✅ Tip: ABONELIK');
                    break;
                }

                // Frekans secimi
                if (text.includes('hafta') || text.includes('week') || text.includes('ay') || text.includes('month') || text.includes('gün') || text.includes('day')) {
                    detectFrequencyFromText(text);
                }
            }
        }, true);

        // Select (dropdown) degisimlerini izle
        document.addEventListener('change', function(e) {
            if (e.target.tagName === 'SELECT') {
                var selectedText = (e.target.options[e.target.selectedIndex]?.text || '').toLowerCase();
                var selectedValue = (e.target.value || '').toLowerCase();
                console.log('[SKYCROPS] 📋 Select değişti:', selectedText, selectedValue);
                detectFrequencyFromText(selectedText) || detectFrequencyFromText(selectedValue);
            }
        }, true);

        // Sayfa yuklendiginde kontrol et
        setTimeout(function() {
            detectCurrentSelection();
            detectCurrentFrequency();
        }, 1500);

        setInterval(function() {
            detectCurrentSelection();
            detectCurrentFrequency();
        }, 2000);
    }

    function detectFrequencyFromText(text) {
        if (!text) return false;
        text = text.toLowerCase().trim();

        // "her hafta", "1 hafta", "haftada bir", "weekly", "every week", "every 1 week"
        if (/^(her hafta|1 hafta|haftada bir|weekly|every week|every 1 week|1 week)/i.test(text) || text === 'hafta' || text === 'haftada 1' || text === '1 haftada bir') {
            setFrequency('1_week', 'Haftada bir');
            return true;
        }
        // "2 hafta", "2 haftada bir", "every 2 weeks", "bi-weekly"
        if (/^(2 hafta|iki hafta|2 haftada|every 2 week|bi.?weekly)/i.test(text) || text === '2 haftada bir' || text === 'iki haftada bir') {
            setFrequency('2_week', '2 haftada bir');
            return true;
        }
        // "3 hafta", "3 haftada bir", "every 3 weeks"
        if (/^(3 hafta|üç hafta|3 haftada|every 3 week)/i.test(text) || text === '3 haftada bir' || text === 'üç haftada bir') {
            setFrequency('3_week', '3 haftada bir');
            return true;
        }
        // "4 hafta", "4 haftada bir", "monthly", "aylık", "ayda bir", "every month", "her ay"
        if (/^(4 hafta|4 haftada|monthly|aylık|ayda bir|every month|her ay|1 ay)/i.test(text) || text === 'ayda bir' || text === 'aylik') {
            setFrequency('1_month', 'Ayda bir');
            return true;
        }
        // "2 ay", "2 ayda bir", "every 2 months"
        if (/^(2 ay|iki ay|2 ayda|every 2 month)/i.test(text)) {
            setFrequency('2_month', '2 ayda bir');
            return true;
        }
        // "3 ay", "3 ayda bir", "every 3 months", "quarterly"
        if (/^(3 ay|üç ay|3 ayda|every 3 month|quarterly)/i.test(text)) {
            setFrequency('3_month', '3 ayda bir');
            return true;
        }
        return false;
    }

    function setFrequency(code, label) {
        sessionStorage.setItem('subscription_frequency', code);
        sessionStorage.setItem('subscription_frequency_label', label);
        console.log('[SKYCROPS] 📅 Frekans:', label, '(' + code + ')');
    }

    function detectCurrentSelection() {
        var allElements = document.querySelectorAll('.active, .selected, [aria-selected="true"], [aria-checked="true"], [data-active], .is-active, input:checked');
        for (var i = 0; i < allElements.length; i++) {
            var text = (allElements[i].textContent || '').trim().toLowerCase();
            if (text.length > 50) continue;

            if (text.includes('abonelik') || text.includes('subscription')) {
                if (sessionStorage.getItem('purchase_type') !== 'subscription') {
                    sessionStorage.setItem('purchase_type', 'subscription');
                    console.log('[SKYCROPS] 🔍 Otomatik tespit: ABONELIK');
                }
                return;
            }
            if (text.includes('tek seferlik') || text.includes('one-time')) {
                if (sessionStorage.getItem('purchase_type') !== 'single') {
                    sessionStorage.setItem('purchase_type', 'single');
                    console.log('[SKYCROPS] 🔍 Otomatik tespit: TEK SEFERLIK');
                }
                return;
            }
        }
    }

    function detectCurrentFrequency() {
        // Already have frequency - skip
        if (sessionStorage.getItem('subscription_frequency')) return;

        // Aktif/secili dropdown'lari kontrol et
        var selects = document.querySelectorAll('select');
        for (var i = 0; i < selects.length; i++) {
            var sel = selects[i];
            var text = (sel.options[sel.selectedIndex]?.text || '').toLowerCase();
            if (detectFrequencyFromText(text)) return;
        }

        // Aktif butonlari/radio'lari kontrol et
        var allActive = document.querySelectorAll('.active, .selected, [aria-selected="true"], input[type="radio"]:checked');
        for (var j = 0; j < allActive.length; j++) {
            var t = (allActive[j].textContent || allActive[j].value || '').toLowerCase();
            if (t.includes('hafta') || t.includes('ay') || t.includes('week') || t.includes('month')) {
                if (detectFrequencyFromText(t)) return;
            }
        }
    }

    // ===== CHECKOUT BUTONLARINI YAKALA =====
    function interceptCheckout() {
        document.addEventListener('click', function(e) {
            var target = e.target.closest('a[href*="/checkout"], button[name="checkout"], input[name="checkout"], form[action*="/checkout"] button[type="submit"], .shopify-payment-button button, [data-shopify-checkout]');
            if (!target) return;

            var href = target.getAttribute('href') || '';
            var isCheckoutLink = href.includes('/checkout');
            var isCheckoutButton = target.name === 'checkout' || target.closest('form[action*="/checkout"]');
            var isShopifyPayButton = target.closest('.shopify-payment-button');

            if (isCheckoutLink || isCheckoutButton || isShopifyPayButton) {
                e.preventDefault();
                e.stopPropagation();
                redirectToOurCheckout();
                return false;
            }
        }, true);

        document.addEventListener('submit', function(e) {
            var form = e.target;
            if (form.action && form.action.includes('/checkout')) {
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

                console.log('[SKYCROPS] 🛒 Checkout - Tip:', purchaseType, '| Frekans:', frequencyLabel || 'yok');

                var mappedItems = cart.items.map(function(item) {
                        var img = item.image || '';
                        if (img && !img.startsWith('http')) img = 'https:' + img;

                        var hasSP = !!item.selling_plan_allocation;
                        var hasProp = item.properties && (
                            item.properties._subscription ||
                            item.properties.shipping_interval_unit_type ||
                            item.properties._seal_subscription
                        );

                        if (hasSP || hasProp) {
                            purchaseType = 'subscription';
                        }

                        var propPlanPrice = null;
                        if (item.properties && item.properties._plan_price) {
                            var raw = String(item.properties._plan_price).replace(',', '.').replace(/[^\d.]/g, '');
                            var parsed = parseFloat(raw);
                            if (!isNaN(parsed) && parsed > 0) propPlanPrice = parsed;
                        }

                        var effectiveUnitPrice = propPlanPrice !== null ? propPlanPrice : (item.price / 100);
                        var effectiveLinePrice = (effectiveUnitPrice * item.quantity);

                        // Seal frekans bilgisi property'de olabilir
                        if (item.properties) {
                            var sp = item.properties;
                            if (sp.shipping_interval_unit_type && sp.shipping_interval_frequency) {
                                var unit = sp.shipping_interval_unit_type.toLowerCase();
                                var freq = parseInt(sp.shipping_interval_frequency);
                                if (unit.includes('week') || unit.includes('hafta')) {
                                    frequency = freq + '_week';
                                    frequencyLabel = freq + ' haftada bir';
                                } else if (unit.includes('month') || unit.includes('ay')) {
                                    frequency = freq + '_month';
                                    frequencyLabel = freq + ' ayda bir';
                                }
                            }
                        }

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
                                name: item.selling_plan_allocation.selling_plan.name,
                            } : null
                        };
                    });

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
                    shop_url: window.location.origin,
                    shop_name: window.Shopify?.shop || window.location.hostname,
                    // Musteri sehir/ilce bilgileri
                    customer_city: (function() {
                        // 1. Shopify kargo hesaplayicisi inputu
                        var cityInput = document.querySelector('#address_province, [name="address[province]"], [name="checkout[shipping_address][province]"], select[data-bind="province"]');
                        if (cityInput) {
                            if (cityInput.tagName === 'SELECT') return cityInput.options[cityInput.selectedIndex]?.text || '';
                            return cityInput.value || '';
                        }
                        // 2. Giriş yapmış müşterinin adresi
                        if (window.__st && window.__st.p === 'cart') {
                            var addrCity = document.querySelector('.address-city, [data-address-city]');
                            if (addrCity) return addrCity.textContent?.trim() || '';
                        }
                        // 3. SessionStorage'dan
                        return sessionStorage.getItem('customer_city') || '';
                    })(),
                    customer_district: (function() {
                        var distInput = document.querySelector('#address_city, [name="address[city]"], [name="checkout[shipping_address][city]"]');
                        if (distInput) return distInput.value || '';
                        return sessionStorage.getItem('customer_district') || '';
                    })(),
                    // Site logosu
                    shop_logo: (function() {
                        var logo = document.querySelector('.header__heading-logo, .site-header__logo-image, header img[src*="logo"], .header-logo img, .logo img, a.header__logo img');
                        if (logo) {
                            var src = logo.src || logo.getAttribute('data-src') || '';
                            if (src && !src.startsWith('http')) src = 'https:' + src;
                            return src;
                        }
                        return '';
                    })(),
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
            trackPurchaseType();
            interceptCheckout();
        });
    } else {
        trackPurchaseType();
        interceptCheckout();
    }
})();
`;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
