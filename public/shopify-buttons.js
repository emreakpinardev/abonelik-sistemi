/**
 * Shopify Magaza Script - iyzico Odeme Butonlari (Sürüm 2 - Toggle Tasarım)
 */
(function () {
    'use strict';

    var APP_URL = '{{APP_URL}}';
    var CHECKOUT_URL = APP_URL + '/checkout';
    var PLANS_API = APP_URL + '/api/plans';

    // Sadece urun sayfalarinda calis
    var meta = document.querySelector('meta[property="og:type"][content="product"]');
    if (!meta && !window.location.pathname.includes('/products/')) return;

    var state = {
        type: 'one-time', // 'one-time' | 'subscription'
        selectedPlanId: null,
        product: null,
        plans: []
    };

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

        // Listen for variant changes if possible (basic implementation)
        return info;
    }

    function init() {
        var product = getProductInfo();
        if (!product.name) return;
        state.product = product;

        // Planlari API'den cek
        fetch(PLANS_API + (product.id ? '?productId=' + product.id : ''))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                state.plans = data.plans || [];
                if (state.plans.length > 0) {
                    state.selectedPlanId = state.plans[0].id; // Default to first plan
                }
                render();
            })
            .catch(function () {
                state.plans = [];
                render();
            });
    }

    function render() {
        var existing = document.getElementById('iyzico-payment-wrapper');
        if (existing) existing.remove();

        var container = document.createElement('div');
        container.id = 'iyzico-payment-wrapper';

        // Inject CSS
        var style = document.createElement('style');
        style.textContent = `
            .iy-container { margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; font-family: inherit; background: #fff; overflow: hidden; }
            .iy-option { display: flex; padding: 16px; cursor: pointer; border-bottom: 1px solid #e5e7eb; transition: all 0.2s; position: relative; }
            .iy-option:last-child { border-bottom: none; }
            .iy-option.active { background: #f0fdf4; border-left: 4px solid #166534; padding-left: 12px; }
            .iy-radio { margin-top: 4px; margin-right: 12px; accent-color: #166534; width: 18px; height: 18px; }
            .iy-content { flex: 1; }
            .iy-title { font-weight: 600; font-size: 15px; color: #111; display: block; margin-bottom: 2px; }
            .iy-price { font-weight: 700; font-size: 15px; color: #111; float: right; }
            .iy-desc { font-size: 13px; color: #666; display: block; }
            
            .iy-plans-wrapper { padding: 0 0 12px 30px; margin-top: 10px; display: none; }
            .iy-option.active .iy-plans-wrapper { display: block; }
            
            .iy-plan-select { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; margin-top: 5px; outline: none; }
            .iy-plan-item { display: flex; align-items: center; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 6px; background: #fff; font-size: 13px; cursor: pointer; }
            .iy-plan-item.selected { border-color: #166534; background: #dcfce7; color: #166534; font-weight: 600; }
            
            .iy-submit-btn {
                display: block; width: 100%; padding: 14px; margin-top: 16px;
                background: #111; color: #fff; text-align: center; text-decoration: none;
                border-radius: 8px; font-weight: 600; font-size: 15px; transition: background 0.2s;
            }
            .iy-submit-btn:hover { background: #000; }
            
            .iy-badge { background: #166534; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; text-transform: uppercase; }
        `;
        container.appendChild(style);

        var wrapper = document.createElement('div');
        wrapper.className = 'iy-container';

        // --- OPTION 1: ONE-TIME ---
        var optOneTime = document.createElement('div');
        optOneTime.className = 'iy-option ' + (state.type === 'one-time' ? 'active' : '');
        optOneTime.onclick = function () { state.type = 'one-time'; render(); };

        optOneTime.innerHTML = `
            <input type="radio" name="purchase_type" class="iy-radio" ${state.type === 'one-time' ? 'checked' : ''}>
            <div class="iy-content">
                <span class="iy-price">${state.product.price} TL</span>
                <span class="iy-title">Tek Seferlik Satın Al</span>
                <span class="iy-desc">Standart sipariş</span>
            </div>
        `;
        wrapper.appendChild(optOneTime);

        // --- OPTION 2: SUBSCRIPTION ---
        if (state.plans.length > 0) {
            var optSub = document.createElement('div');
            optSub.className = 'iy-option ' + (state.type === 'subscription' ? 'active' : '');

            // Selection logic
            var subContent = document.createElement('div');
            subContent.className = 'iy-content';

            // Find active plan price for display
            var activePlan = state.plans.find(p => p.id === state.selectedPlanId) || state.plans[0];

            subContent.innerHTML = `
                <span class="iy-price">${activePlan.price} TL <span style="font-size:12px;font-weight:400;color:#666">/${getFreqLabel(activePlan.interval, activePlan.intervalCount).toLowerCase()}</span></span>
                <span class="iy-title">Abone Ol & Kazan <span class="iy-badge">TASARRUF ET</span></span>
                <span class="iy-desc">Düzenli gönderim, istediğin zaman iptal et.</span>
            `;

            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'purchase_type';
            radio.className = 'iy-radio';
            radio.checked = state.type === 'subscription';

            // Click handling involves preventing bubbling if clicking internal elements
            optSub.onclick = function (e) {
                if (!e.target.closest('.iy-plan-item')) {
                    state.type = 'subscription';
                    render();
                }
            };

            optSub.prepend(radio);
            optSub.appendChild(subContent);

            // Plan Selector (Only visible if active)
            if (state.type === 'subscription') {
                var plansWrapper = document.createElement('div');
                plansWrapper.className = 'iy-plans-wrapper';

                var label = document.createElement('div');
                label.textContent = 'Teslimat Sıklığı:';
                label.style.cssText = 'font-size:12px;font-weight:600;margin:6px 0;';
                plansWrapper.appendChild(label);

                state.plans.forEach(function (plan) {
                    var item = document.createElement('div');
                    item.className = 'iy-plan-item ' + (state.selectedPlanId === plan.id ? 'selected' : '');
                    item.onclick = function (e) {
                        e.stopPropagation(); // Prevent toggling parent
                        state.selectedPlanId = plan.id;
                        state.type = 'subscription'; // ensure type is subscription
                        render();
                    };

                    var freq = getFreqLabel(plan.interval, plan.intervalCount);
                    item.innerHTML = `
                        <div style="flex:1"><b>${plan.name}</b></div>
                        <div>${plan.price} TL / ${freq}</div>
                    `;
                    plansWrapper.appendChild(item);
                });

                subContent.appendChild(plansWrapper);
            }

            wrapper.appendChild(optSub);
        }

        container.appendChild(wrapper);

        // --- SUBMIT BUTTON ---
        var submitBtn = document.createElement('a');
        submitBtn.className = 'iy-submit-btn';

        if (state.type === 'one-time') {
            submitBtn.textContent = 'Satın Al — ' + state.product.price + ' TL';
            submitBtn.href = CHECKOUT_URL + '?type=single&product_id=' + encodeURIComponent(state.product.id) +
                '&product_name=' + encodeURIComponent(state.product.name) +
                '&product_price=' + encodeURIComponent(state.product.price) +
                '&variant_id=' + encodeURIComponent(state.product.variantId);
        } else {
            var plan = state.plans.find(p => p.id === state.selectedPlanId) || state.plans[0];
            var freq = getFreqLabel(plan.interval, plan.intervalCount);
            submitBtn.textContent = 'Abone Ol — ' + plan.price + ' TL';
            submitBtn.href = CHECKOUT_URL + '?type=subscription' +
                '&plan_id=' + encodeURIComponent(plan.id) +
                '&product_id=' + encodeURIComponent(state.product.id) +
                '&product_name=' + encodeURIComponent(state.product.name) +
                '&product_price=' + encodeURIComponent(plan.price) +
                '&variant_id=' + encodeURIComponent(state.product.variantId || plan.shopifyVariantId || '') +
                '&subscription_frequency=' + encodeURIComponent(getFreqValue(plan.interval, plan.intervalCount)) +
                '&subscription_frequency_label=' + encodeURIComponent(freq);
        }

        container.appendChild(submitBtn);

        // Add Secure Note
        var note = document.createElement('div');
        note.style.cssText = 'margin-top:10px;font-size:11px;color:#9ca3af;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px;';
        note.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> iyzico ile güvenli ödeme';
        container.appendChild(note);

        // Inject
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
        if (interval === 'WEEKLY') return count === 1 ? 'Haftalık' : count + ' Hafta';
        if (interval === 'MONTHLY') return count === 1 ? 'Aylık' : count + ' Ay';
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
