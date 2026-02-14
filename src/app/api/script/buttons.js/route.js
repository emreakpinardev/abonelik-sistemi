import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';

    const script = `
(function() {
    'use strict';

    var CHECKOUT_URL = '${appUrl}/checkout';

    // ===== URUN SAYFASINDA SATIN ALMA TIPINI YAKALA =====
    function trackPurchaseType() {
        // HER TIKLAMADA kontrol et - en genis yakalama
        document.addEventListener('click', function(e) {
            var el = e.target;
            // Tiklanan element veya parent'larinden birinin text'ini kontrol et
            var checkEls = [el];
            var parent = el.parentElement;
            for (var i = 0; i < 5 && parent; i++) {
                checkEls.push(parent);
                parent = parent.parentElement;
            }

            for (var j = 0; j < checkEls.length; j++) {
                var text = (checkEls[j].textContent || '').trim().toLowerCase();
                // Sadece kisa text'leri kontrol et (uzun paragraflar degil)
                if (text.length > 50) continue;

                if (text === 'tek seferlik' || text === 'one-time' || text === 'one time' || text.includes('tek seferlik')) {
                    sessionStorage.setItem('purchase_type', 'single');
                    console.log('[SKYCROPS] ✅ Satin alma tipi: TEK SEFERLIK');
                    break;
                } else if (text === 'abonelik' || text === 'subscription' || text === 'subscribe' || text.includes('abonelik')) {
                    sessionStorage.setItem('purchase_type', 'subscription');
                    console.log('[SKYCROPS] ✅ Satin alma tipi: ABONELIK');
                    break;
                }
            }
        }, true);

        // Sayfa yuklendiginde mevcut secimi kontrol et
        setTimeout(function() {
            detectCurrentSelection();
        }, 1500);

        // Her 2 saniyede kontrol et (SPA sayfalar icin)
        setInterval(function() {
            detectCurrentSelection();
        }, 2000);
    }

    function detectCurrentSelection() {
        // Aktif/secili buton veya etiketi bul
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

    // ===== REDIRECT ONCESI SON KONTROL =====
    function redirectToOurCheckout() {
        // Redirect oncesi sayfadaki secimi bir kez daha kontrol et
        detectCurrentSelection();

        fetch('/cart.js')
            .then(function(res) { return res.json(); })
            .then(function(cart) {
                if (!cart.items || cart.items.length === 0) {
                    alert('Sepetiniz bos!');
                    return;
                }

                var purchaseType = sessionStorage.getItem('purchase_type') || 'single';
                console.log('[SKYCROPS] 🛒 Checkout yonlendirmesi - Tip:', purchaseType);

                var cartData = {
                    items: cart.items.map(function(item) {
                        var img = item.image || '';
                        if (img && !img.startsWith('http')) img = 'https:' + img;

                        // Selling plan varsa abonelik
                        var hasSP = !!item.selling_plan_allocation;
                        // Properties'de abonelik bilgisi varsa
                        var hasProp = item.properties && (
                            item.properties._subscription ||
                            item.properties.shipping_interval_unit_type ||
                            item.properties._seal_subscription
                        );

                        if (hasSP || hasProp) {
                            purchaseType = 'subscription';
                        }

                        return {
                            id: item.product_id,
                            variant_id: item.variant_id,
                            name: item.product_title,
                            variant: item.variant_title || '',
                            price: (item.price / 100).toFixed(2),
                            line_price: (item.line_price / 100).toFixed(2),
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
                    }),
                    total: (cart.total_price / 100).toFixed(2),
                    total_discount: ((cart.total_discount || 0) / 100).toFixed(2),
                    currency: cart.currency,
                    item_count: cart.item_count,
                    purchase_type: purchaseType,
                    shop_url: window.location.origin,
                    shop_name: window.Shopify?.shop || window.location.hostname
                };

                console.log('[SKYCROPS] 📦 Gonderilen veri:', JSON.stringify(cartData));

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
