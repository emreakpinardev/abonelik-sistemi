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
        // Seal veya diger plugin'lerin "Tek seferlik" / "Abonelik" butonlarini yakalabody
        var purchaseButtons = document.querySelectorAll('[data-selling-plan], .subscription-widget button, .purchase-option, .selling-plan-widget button, .seal-subscription-widget button');
        
        // Genel buton yalama - "Tek seferlik" veya "Abonelik" yazan butonlari bul
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('button, [role="button"], label, input[type="radio"]');
            if (!btn) return;

            var text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
            var value = (btn.value || '').toLowerCase();

            if (text.includes('tek seferlik') || text.includes('one-time') || text.includes('one time') || value === 'one-time') {
                sessionStorage.setItem('purchase_type', 'single');
                console.log('[SKYCROPS] Satin alma tipi: Tek Seferlik');
            } else if (text.includes('abonelik') || text.includes('subscription') || text.includes('subscribe') || value === 'subscription') {
                sessionStorage.setItem('purchase_type', 'subscription');
                console.log('[SKYCROPS] Satin alma tipi: Abonelik');
            }
        });

        // Varsayilan olarak secili olan butonu kontrol et
        setTimeout(function() {
            var activeBtn = document.querySelector('.purchase-option.active, .selling-plan-widget .active, [data-selling-plan].selected, .subscription-widget .active');
            if (activeBtn) {
                var text = (activeBtn.textContent || '').toLowerCase();
                if (text.includes('abonelik') || text.includes('subscription')) {
                    sessionStorage.setItem('purchase_type', 'subscription');
                } else {
                    sessionStorage.setItem('purchase_type', 'single');
                }
            }
        }, 1000);
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

    // ===== SEPET BILGILERINI AL VE CHECKOUT'A YONLENDIR =====
    function redirectToOurCheckout() {
        fetch('/cart.js')
            .then(function(res) { return res.json(); })
            .then(function(cart) {
                if (!cart.items || cart.items.length === 0) {
                    alert('Sepetiniz bos!');
                    return;
                }

                // Secili satin alma tipi
                var purchaseType = sessionStorage.getItem('purchase_type') || 'single';

                var cartData = {
                    items: cart.items.map(function(item) {
                        var img = item.image || '';
                        if (img && !img.startsWith('http')) img = 'https:' + img;

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

                console.log('[SKYCROPS] Checkout verisi:', cartData);

                var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cartData))));
                window.location.href = CHECKOUT_URL + '?cart=' + encodeURIComponent(encoded);
            })
            .catch(function(err) {
                console.error('Sepet bilgileri alinamadi:', err);
                alert('Bir hata olustu, lutfen tekrar deneyin.');
            });
    }

    // Basla
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
            'Cache-Control': 'public, max-age=300',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
