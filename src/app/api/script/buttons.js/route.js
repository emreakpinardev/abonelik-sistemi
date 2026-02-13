import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';

    const script = `
(function() {
    'use strict';

    var CHECKOUT_URL = '${appUrl}/checkout';

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
        fetch('/cart.js')
            .then(function(res) { return res.json(); })
            .then(function(cart) {
                if (!cart.items || cart.items.length === 0) {
                    alert('Sepetiniz bos!');
                    return;
                }

                var cartData = {
                    items: cart.items.map(function(item) {
                        // Resim URL'sini duzelt - Shopify bazen relative verir
                        var img = item.image || item.featured_image?.url || '';
                        if (img && !img.startsWith('http')) {
                            img = 'https:' + img;
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
                            taxable: item.taxable,
                            properties: item.properties || {},
                            // Abonelik tespiti - Seal, ReCharge vb. pluginler bu alanlari kullanir
                            selling_plan: item.selling_plan_allocation ? {
                                id: item.selling_plan_allocation.selling_plan.id,
                                name: item.selling_plan_allocation.selling_plan.name,
                                price: (item.selling_plan_allocation.price / 100).toFixed(2)
                            } : null
                        };
                    }),
                    total: (cart.total_price / 100).toFixed(2),
                    original_total: (cart.original_total_price / 100).toFixed(2),
                    total_discount: (cart.total_discount / 100).toFixed(2),
                    currency: cart.currency,
                    item_count: cart.item_count,
                    requires_shipping: cart.requires_shipping,
                    note: cart.note || '',
                    shop_url: window.location.origin,
                    shop_name: window.Shopify?.shop || window.location.hostname
                };

                // Abonelik var mi kontrol et
                var hasSubscription = cart.items.some(function(item) {
                    return item.selling_plan_allocation ||
                           (item.properties && item.properties._subscription) ||
                           (item.product_type && item.product_type.toLowerCase().includes('abonelik'));
                });
                cartData.has_subscription = hasSubscription;

                var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cartData))));
                window.location.href = CHECKOUT_URL + '?cart=' + encodeURIComponent(encoded);
            })
            .catch(function(err) {
                console.error('Sepet bilgileri alinamadi:', err);
                alert('Bir hata olustu, lutfen tekrar deneyin.');
            });
    }

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
