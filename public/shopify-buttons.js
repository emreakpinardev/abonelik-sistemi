/**
 * Shopify Magaza Script - iyzico Odeme Butonlari
 * Bu script Shopify magazanin her sayfasina yuklenir
 * Urun sayfalarinda abonelik planlari ve "Satin Al" butonlari gosterir
 * Planlar admin panelinden yonetilir ve API'den dinamik olarak yuklenir
 */
(function () {
    'use strict';

    var APP_URL = '{{APP_URL}}';
    var CHECKOUT_URL = APP_URL + '/checkout';
    var PLANS_API = APP_URL + '/api/plans';

    // Sadece urun sayfalarinda calis
    var meta = document.querySelector('meta[property="og:type"][content="product"]');
    if (!meta && !window.location.pathname.includes('/products/')) return;

    function getProductInfo() {
        var info = { name: '', price: '', id: '', variantId: '', image: '' };

        var titleMeta = document.querySelector('meta[property="og:title"]');
        if (titleMeta) info.name = titleMeta.getAttribute('content');

        var priceMeta = document.querySelector('meta[property="product:price:amount"]');
        if (priceMeta) info.price = priceMeta.getAttribute('content');

        var imageMeta = document.querySelector('meta[property="og:image"]');
        if (imageMeta) info.image = imageMeta.getAttribute('content');

        if (typeof ShopifyAnalytics !== 'undefined' && ShopifyAnalytics.meta) {
            info.id = ShopifyAnalytics.meta.product ? ShopifyAnalytics.meta.product.id : '';
        }

        var variantSelect = document.querySelector('select[name="id"], input[name="id"]');
        if (variantSelect) info.variantId = variantSelect.value;

        return info;
    }

    function createButtons() {
        var product = getProductInfo();
        if (!product.name) return;

        // Planlari API'den cek
        fetch(PLANS_API + (product.id ? '?productId=' + product.id : ''))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var plans = data.plans || [];
                renderUI(product, plans);
            })
            .catch(function () {
                // API'ye ulasilamazsa fallback: tek seferlik buton
                renderUI(product, []);
            });
    }

    function renderUI(product, plans) {
        // Eski container varsa kaldir
        var existing = document.getElementById('iyzico-payment-buttons');
        if (existing) existing.remove();

        var container = document.createElement('div');
        container.id = 'iyzico-payment-buttons';
        container.style.cssText = 'margin:16px 0;padding:20px;border:1.5px solid #e5e7eb;border-radius:14px;background:#fff;font-family:Inter,system-ui,sans-serif;';

        // Baslik
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px;font-weight:600;color:#16a34a;';
        header.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Güvenli Ödeme Seçenekleri';
        container.appendChild(header);

        // Tek seferlik satin al butonu
        var singleBtn = document.createElement('a');
        singleBtn.href = CHECKOUT_URL + '?type=single&product_id=' + encodeURIComponent(product.id) +
            '&product_name=' + encodeURIComponent(product.name) +
            '&product_price=' + encodeURIComponent(product.price) +
            '&variant_id=' + encodeURIComponent(product.variantId);
        singleBtn.style.cssText = 'display:block;padding:13px 20px;background:#1e293b;color:white;text-align:center;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:12px;transition:background 0.2s;';
        singleBtn.textContent = '💳 Satın Al — ' + product.price + ' ₺';
        singleBtn.onmouseover = function () { this.style.background = '#334155'; };
        singleBtn.onmouseout = function () { this.style.background = '#1e293b'; };
        container.appendChild(singleBtn);

        // Abonelik planlari
        if (plans.length > 0) {
            var subHeader = document.createElement('div');
            subHeader.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;';
            subHeader.textContent = '🔄 Abonelik Seçenekleri';
            container.appendChild(subHeader);

            plans.forEach(function (plan) {
                var planBtn = document.createElement('a');
                var freq = getFreqLabel(plan.interval, plan.intervalCount);

                planBtn.href = CHECKOUT_URL + '?type=subscription' +
                    '&plan_id=' + encodeURIComponent(plan.id) +
                    '&product_id=' + encodeURIComponent(product.id) +
                    '&product_name=' + encodeURIComponent(product.name) +
                    '&product_price=' + encodeURIComponent(plan.price) +
                    '&variant_id=' + encodeURIComponent(product.variantId || plan.shopifyVariantId || '') +
                    '&subscription_frequency=' + encodeURIComponent(getFreqValue(plan.interval, plan.intervalCount)) +
                    '&subscription_frequency_label=' + encodeURIComponent(freq);

                planBtn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#f0fdf4;border:1.5px solid #bbf7d0;color:#166534;text-decoration:none;border-radius:10px;font-size:14px;margin-bottom:6px;transition:all 0.2s;';

                var leftSpan = document.createElement('span');
                leftSpan.style.cssText = 'font-weight:600;';
                leftSpan.textContent = plan.name;

                var rightSpan = document.createElement('span');
                rightSpan.style.cssText = 'font-weight:700;font-size:15px;';
                rightSpan.textContent = plan.price.toLocaleString('tr-TR') + ' ₺/' + freq.toLowerCase();

                planBtn.appendChild(leftSpan);
                planBtn.appendChild(rightSpan);

                planBtn.onmouseover = function () { this.style.background = '#dcfce7'; this.style.borderColor = '#86efac'; };
                planBtn.onmouseout = function () { this.style.background = '#f0fdf4'; this.style.borderColor = '#bbf7d0'; };

                container.appendChild(planBtn);
            });
        } else {
            // Fallback: genel abonelik butonu (plan yoksa)
            var subBtn = document.createElement('a');
            subBtn.href = CHECKOUT_URL + '?type=subscription&product_id=' + encodeURIComponent(product.id) +
                '&product_name=' + encodeURIComponent(product.name);
            subBtn.style.cssText = 'display:block;padding:13px 20px;background:#f0fdf4;border:1.5px solid #bbf7d0;color:#166534;text-align:center;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;transition:all 0.2s;';
            subBtn.textContent = '🔄 Abone Ol';
            subBtn.onmouseover = function () { this.style.background = '#dcfce7'; };
            subBtn.onmouseout = function () { this.style.background = '#f0fdf4'; };
            container.appendChild(subBtn);
        }

        // Guvenli odeme notu
        var note = document.createElement('div');
        note.style.cssText = 'margin-top:10px;font-size:11px;color:#9ca3af;text-align:center;';
        note.textContent = '🔒 256-bit SSL ile güvenli ödeme • iyzico altyapısı';
        container.appendChild(note);

        // Sayfaya ekle
        var formEl = document.querySelector('form[action="/cart/add"]');
        if (formEl) {
            formEl.parentNode.insertBefore(container, formEl.nextSibling);
        } else {
            var productDesc = document.querySelector('.product-single__description, .product__description, [class*="product"] [class*="description"]');
            if (productDesc) {
                productDesc.parentNode.insertBefore(container, productDesc.nextSibling);
            } else {
                var mainContent = document.querySelector('main, .main-content, #MainContent');
                if (mainContent) mainContent.appendChild(container);
            }
        }
    }

    function getFreqLabel(interval, count) {
        if (interval === 'WEEKLY') {
            if (count === 1) return 'Haftalık';
            return count + ' Hafta';
        }
        if (interval === 'MONTHLY') {
            if (count === 1) return 'Aylık';
            return count + ' Ay';
        }
        if (interval === 'QUARTERLY') return '3 Aylık';
        if (interval === 'YEARLY') return 'Yıllık';
        return 'Aylık';
    }

    function getFreqValue(interval, count) {
        if (interval === 'WEEKLY') return count + '_week';
        if (interval === 'MONTHLY') return count + '_month';
        if (interval === 'QUARTERLY') return '3_month';
        if (interval === 'YEARLY') return '12_month';
        return '1_month';
    }

    // Sayfa yuklendiginde butonlari ekle
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButtons);
    } else {
        createButtons();
    }
})();
