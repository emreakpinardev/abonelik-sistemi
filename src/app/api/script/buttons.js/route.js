import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/script/buttons.js
 * Shopify magaza icin buton script'ini dondurur
 * APP_URL'yi otomatik olarak inject eder
 */
export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';

    const script = `
(function() {
    'use strict';

    var CHECKOUT_URL = '${appUrl}/checkout';

    // Sadece urun sayfalarinda calis
    var meta = document.querySelector('meta[property="og:type"][content="product"]');
    if (!meta && !window.location.pathname.includes('/products/')) return;

    function getProductInfo() {
        var info = { name: '', price: '', id: '', variantId: '', image: '' };

        var titleMeta = document.querySelector('meta[property="og:title"]');
        if (titleMeta) info.name = titleMeta.getAttribute('content');

        var priceMeta = document.querySelector('meta[property="product:price:amount"]');
        if (priceMeta) info.price = priceMeta.getAttribute('content');

        if (typeof ShopifyAnalytics !== 'undefined' && ShopifyAnalytics.meta) {
            info.id = ShopifyAnalytics.meta.product ? ShopifyAnalytics.meta.product.id : '';
        }

        var variantSelect = document.querySelector('select[name="id"], input[name="id"]');
        if (variantSelect) info.variantId = variantSelect.value;

        return info;
    }

    function createButtons() {
        var product = getProductInfo();
        if (!product.name && !window.location.pathname.includes('/products/')) return;

        // Zaten eklenmisse tekrar ekleme
        if (document.getElementById('iyzico-payment-buttons')) return;

        var container = document.createElement('div');
        container.id = 'iyzico-payment-buttons';
        container.style.cssText = 'margin: 16px 0; padding: 16px; border: 2px solid #5c6ac4; border-radius: 12px; background: linear-gradient(135deg, #f8f9ff 0%, #eef0ff 100%);';

        var header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #5c6ac4;';
        header.innerHTML = '\\ud83d\\udd12 iyzico ile G\\u00fcvenli \\u00d6deme';
        container.appendChild(header);

        var btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

        var singleBtn = document.createElement('a');
        var singleUrl = CHECKOUT_URL + '?type=single'
            + '&product_id=' + encodeURIComponent(product.id || '')
            + '&product_name=' + encodeURIComponent(product.name || '')
            + '&product_price=' + encodeURIComponent(product.price || '')
            + '&variant_id=' + encodeURIComponent(product.variantId || '');
        singleBtn.href = singleUrl;
        singleBtn.style.cssText = 'flex: 1; min-width: 140px; display: inline-block; padding: 12px 20px; background: #5c6ac4; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;';
        singleBtn.textContent = '\\ud83d\\udcb3 Sat\\u0131n Al' + (product.price ? ' - ' + product.price + ' \\u20ba' : '');
        btnContainer.appendChild(singleBtn);

        var subBtn = document.createElement('a');
        var subUrl = CHECKOUT_URL + '?type=subscription'
            + '&product_id=' + encodeURIComponent(product.id || '')
            + '&product_name=' + encodeURIComponent(product.name || '');
        subBtn.href = subUrl;
        subBtn.style.cssText = 'flex: 1; min-width: 140px; display: inline-block; padding: 12px 20px; background: #202223; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;';
        subBtn.textContent = '\\ud83d\\udd04 Abone Ol';
        btnContainer.appendChild(subBtn);

        container.appendChild(btnContainer);

        var note = document.createElement('div');
        note.style.cssText = 'margin-top: 10px; font-size: 11px; color: #666; text-align: center;';
        note.textContent = '\\ud83d\\udd12 256-bit SSL ile g\\u00fcvenli \\u00f6deme \\u2022 iyzico altyap\\u0131s\\u0131';
        container.appendChild(note);

        // Sepete ekle formundan sonra ekle
        var formEl = document.querySelector('form[action="/cart/add"]');
        if (formEl) {
            formEl.parentNode.insertBefore(container, formEl.nextSibling);
        } else {
            var mainContent = document.querySelector('main, .main-content, #MainContent, .product');
            if (mainContent) mainContent.appendChild(container);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButtons);
    } else {
        createButtons();
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
