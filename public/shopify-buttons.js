/**
 * Shopify Magaza Script - iyzico Odeme Butonlari
 * Bu script Shopify magzanin her sayfasina yuklenir
 * Urun sayfalarinda "Abone Ol" ve "Satin Al" butonlari ekler
 */
(function () {
    'use strict';

    // Checkout sayfasi URL'si
    var CHECKOUT_URL = '{{APP_URL}}/checkout';

    // Sadece urun sayfalarinda calis
    var meta = document.querySelector('meta[property="og:type"][content="product"]');
    if (!meta && !window.location.pathname.includes('/products/')) return;

    // Shopify urun bilgilerini al
    function getProductInfo() {
        var info = {
            name: '',
            price: '',
            id: '',
            variantId: '',
            image: ''
        };

        // Meta tag'lerden bilgi cek
        var titleMeta = document.querySelector('meta[property="og:title"]');
        if (titleMeta) info.name = titleMeta.getAttribute('content');

        var priceMeta = document.querySelector('meta[property="product:price:amount"]');
        if (priceMeta) info.price = priceMeta.getAttribute('content');

        var imageMeta = document.querySelector('meta[property="og:image"]');
        if (imageMeta) info.image = imageMeta.getAttribute('content');

        // Shopify global degiskenlerden
        if (typeof ShopifyAnalytics !== 'undefined' && ShopifyAnalytics.meta) {
            info.id = ShopifyAnalytics.meta.product ? ShopifyAnalytics.meta.product.id : '';
        }

        // Variant secili ise
        var variantSelect = document.querySelector('select[name="id"], input[name="id"]');
        if (variantSelect) info.variantId = variantSelect.value;

        return info;
    }

    // Buton container olustur
    function createButtons() {
        var product = getProductInfo();
        if (!product.name) return;

        var container = document.createElement('div');
        container.id = 'iyzico-payment-buttons';
        container.style.cssText = 'margin: 16px 0; padding: 16px; border: 2px solid #5c6ac4; border-radius: 12px; background: linear-gradient(135deg, #f8f9ff 0%, #eef0ff 100%);';

        // Baslik
        var header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #5c6ac4;';
        header.innerHTML = '🔒 iyzico ile Güvenli Ödeme';
        container.appendChild(header);

        // Butonlar
        var btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

        // Tek seferlik satin al butonu
        var singleBtn = document.createElement('a');
        singleBtn.href = CHECKOUT_URL + '?type=single&product_id=' + encodeURIComponent(product.id) + '&product_name=' + encodeURIComponent(product.name) + '&product_price=' + encodeURIComponent(product.price) + '&variant_id=' + encodeURIComponent(product.variantId);
        singleBtn.style.cssText = 'flex: 1; min-width: 140px; display: inline-block; padding: 12px 20px; background: #5c6ac4; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background 0.2s; cursor: pointer;';
        singleBtn.textContent = '💳 Satın Al - ' + product.price + ' ₺';
        singleBtn.onmouseover = function () { this.style.background = '#4959bd'; };
        singleBtn.onmouseout = function () { this.style.background = '#5c6ac4'; };
        btnContainer.appendChild(singleBtn);

        // Abonelik butonu
        var subBtn = document.createElement('a');
        subBtn.href = CHECKOUT_URL + '?type=subscription&product_id=' + encodeURIComponent(product.id) + '&product_name=' + encodeURIComponent(product.name);
        subBtn.style.cssText = 'flex: 1; min-width: 140px; display: inline-block; padding: 12px 20px; background: #202223; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background 0.2s; cursor: pointer;';
        subBtn.textContent = '🔄 Abone Ol';
        subBtn.onmouseover = function () { this.style.background = '#333'; };
        subBtn.onmouseout = function () { this.style.background = '#202223'; };
        btnContainer.appendChild(subBtn);

        container.appendChild(btnContainer);

        // Guvenli odeme notu
        var note = document.createElement('div');
        note.style.cssText = 'margin-top: 10px; font-size: 11px; color: #666; text-align: center;';
        note.textContent = '🔒 256-bit SSL ile güvenli ödeme • iyzico altyapısı';
        container.appendChild(note);

        // Sayfaya ekle - sepete ekle butonunun altina
        var formEl = document.querySelector('form[action="/cart/add"]');
        if (formEl) {
            formEl.parentNode.insertBefore(container, formEl.nextSibling);
        } else {
            // Alternatif: product description'dan sonra
            var productDesc = document.querySelector('.product-single__description, .product__description, [class*="product"] [class*="description"]');
            if (productDesc) {
                productDesc.parentNode.insertBefore(container, productDesc.nextSibling);
            } else {
                // Son cale: main content'e ekle
                var mainContent = document.querySelector('main, .main-content, #MainContent');
                if (mainContent) mainContent.appendChild(container);
            }
        }
    }

    // Sayfa yuklendiginde butonlari ekle
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButtons);
    } else {
        createButtons();
    }
})();
