import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/script/buttons.js
 * Shopify checkout butonlarini yakalar ve bizim checkout'a yonlendirir
 * Sepet bilgilerini /cart.js'den okur ve URL ile tasir
 */
export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';

    const script = `
(function() {
    'use strict';

    var CHECKOUT_URL = '${appUrl}/checkout';

    // Checkout linklerini ve butonlarini yakala
    function interceptCheckout() {
        // 1. Tum checkout link ve butonlarini bul
        document.addEventListener('click', function(e) {
            var target = e.target.closest('a[href*="/checkout"], button[name="checkout"], input[name="checkout"], a[href*="cart"], form[action*="/checkout"] button[type="submit"], .shopify-payment-button button, [data-shopify-checkout]');
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

        // 2. Form submit'lerini de yakala
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

    // Shopify sepetin bilgilerini al ve bizim checkout'a yonlendir
    function redirectToOurCheckout() {
        // Shopify cart API'den sepet bilgilerini al
        fetch('/cart.js')
            .then(function(res) { return res.json(); })
            .then(function(cart) {
                if (!cart.items || cart.items.length === 0) {
                    alert('Sepetiniz bos!');
                    return;
                }

                // Sepet bilgilerini encode et
                var cartData = {
                    items: cart.items.map(function(item) {
                        return {
                            id: item.product_id,
                            variant_id: item.variant_id,
                            name: item.product_title,
                            variant: item.variant_title || '',
                            price: (item.price / 100).toFixed(2),
                            quantity: item.quantity,
                            image: item.image || ''
                        };
                    }),
                    total: (cart.total_price / 100).toFixed(2),
                    currency: cart.currency,
                    item_count: cart.item_count
                };

                // Base64 encode ile URL'ye ekle
                var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cartData))));
                window.location.href = CHECKOUT_URL + '?cart=' + encodeURIComponent(encoded);
            })
            .catch(function(err) {
                console.error('Sepet bilgileri alinamadi:', err);
                alert('Bir hata olustu, lutfen tekrar deneyin.');
            });
    }

    // Sayfa yuklendiginde calistir
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', interceptCheckout);
    } else {
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
