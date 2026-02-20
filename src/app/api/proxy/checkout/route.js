import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Shopify App Proxy signature dogrulama
function verifyProxySignature(query) {
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!secret) return true; // Development'da atla

    const { signature, ...params } = query;
    if (!signature) return false;

    const sorted = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('');
    const computed = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
    return computed === signature;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);

    // Query parametrelerini al
    const type = searchParams.get('type') || 'subscription'; // 'single' veya 'subscription'
    const productId = searchParams.get('product_id') || '';
    const productName = searchParams.get('product_name') || '';
    const productPrice = searchParams.get('product_price') || '';
    const variantId = searchParams.get('variant_id') || '';

    // Planlari veritabanindan cek (abonelik icin)
    let plans = [];
    if (type === 'subscription') {
        plans = await prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' },
        });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Shopify Liquid template dondur
    const html = generateCheckoutHTML(type, plans, productId, productName, productPrice, variantId, appUrl);

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'application/liquid',
        },
    });
}

function generateCheckoutHTML(type, plans, productId, productName, productPrice, variantId, appUrl) {
    const planOptions = plans.map(plan => `
        <div class="plan-card" data-plan-id="${plan.id}" data-plan-price="${plan.price}" data-plan-name="${plan.name}" onclick="selectPlan(this)">
            <h3>${plan.name}</h3>
            <div class="plan-price">${plan.price} ₺<span>/${plan.interval === 'MONTHLY' ? 'ay' : plan.interval === 'YEARLY' ? 'yıl' : 'dönem'}</span></div>
            ${plan.description ? `<p>${plan.description}</p>` : ''}
        </div>
    `).join('');

    return `
<style>
    .iyzico-checkout-container {
        max-width: 640px;
        margin: 40px auto;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .iyzico-checkout-container h1 {
        text-align: center;
        margin-bottom: 8px;
        font-size: 28px;
    }
    .iyzico-checkout-container .subtitle {
        text-align: center;
        color: #666;
        margin-bottom: 32px;
    }
    .checkout-card {
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .checkout-card h2 {
        font-size: 18px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #eee;
    }
    .plan-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }
    .plan-card {
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
    }
    .plan-card:hover { border-color: #5c6ac4; }
    .plan-card.selected {
        border-color: #5c6ac4;
        background: #f4f5ff;
    }
    .plan-card h3 { margin: 0 0 8px; font-size: 16px; }
    .plan-price {
        font-size: 24px;
        font-weight: bold;
        color: #5c6ac4;
    }
    .plan-price span {
        font-size: 14px;
        color: #888;
        font-weight: normal;
    }
    .form-group {
        margin-bottom: 14px;
    }
    .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 6px;
        color: #333;
    }
    .form-group input, .form-group select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
    }
    .form-group input:focus {
        outline: none;
        border-color: #5c6ac4;
        box-shadow: 0 0 0 2px rgba(92,106,196,0.15);
    }
    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    .btn-pay {
        width: 100%;
        padding: 14px;
        background: #5c6ac4;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        margin-top: 10px;
    }
    .btn-pay:hover { background: #4959bd; }
    .btn-pay:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
    .product-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: #f9f9f9;
        border-radius: 10px;
        margin-bottom: 20px;
    }
    .product-info .name { font-weight: 600; font-size: 16px; }
    .product-info .price { font-size: 20px; font-weight: bold; color: #5c6ac4; }
    .iyzico-form-area {
        min-height: 200px;
    }
    .loading-spinner {
        text-align: center;
        padding: 40px;
        color: #666;
    }
    .error-msg {
        background: #fff0f0;
        color: #c41e3a;
        padding: 12px;
        border-radius: 8px;
        margin-top: 10px;
        display: none;
    }
    .secure-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #e8f5e9;
        color: #2e7d32;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        float: right;
    }
</style>

<div class="iyzico-checkout-container">
    <h1>💳 Güvenli Ödeme</h1>
    <p class="subtitle">${type === 'single' ? 'Ödemenizi güvenle tamamlayın' : 'Abonelik planınızı seçin ve ödemenizi yapın'}</p>

    <div id="checkout-form-area">
        ${type === 'single' ? `
        <!-- TEK SEFERLIK ODEME -->
        <div class="checkout-card">
            <div class="product-info">
                <div class="name" id="product-name">${productName || 'Ürün'}</div>
                <div class="price" id="product-price">${productPrice ? productPrice + ' ₺' : ''}</div>
            </div>
        </div>
        ` : `
        <!-- ABONELIK PLANLARI -->
        <div class="checkout-card">
            <h2>📦 Plan Seçin</h2>
            <div class="plan-cards">
                ${planOptions}
            </div>
        </div>
        `}

        <!-- MUSTERI BILGILERI -->
        <div class="checkout-card">
            <h2>👤 Bilgileriniz</h2>
            <div class="form-group">
                <label>Ad Soyad</label>
                <input type="text" id="customerName" placeholder="Adınız Soyadınız" required>
            </div>
            <div class="form-group">
                <label>E-posta</label>
                <input type="email" id="customerEmail" placeholder="ornek@email.com" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Telefon</label>
                    <input type="tel" id="customerPhone" placeholder="+90 5XX XXX XX XX" required>
                </div>
                <div class="form-group">
                    <label>Şehir</label>
                    <input type="text" id="customerCity" placeholder="İstanbul" required>
                </div>
            </div>
            <div class="form-group">
                <label>Adres</label>
                <input type="text" id="customerAddress" placeholder="Açık adresiniz" required>
            </div>

            <div id="error-msg" class="error-msg"></div>

            <button class="btn-pay" id="btn-pay" onclick="startPayment()">
                ${type === 'single' ? '💳 Ödeme Yap' : '💳 Aboneliği Başlat'}
            </button>
        </div>
    </div>

    <!-- IYZICO ODEME FORMU BURAYA GELECEK -->
    <div id="iyzico-form-container" class="checkout-card" style="display:none;">
        <h2>🔒 Kart Bilgileri <span class="secure-badge">🔒 SSL</span></h2>
        <div id="iyzico-form-area" class="iyzico-form-area"></div>
    </div>
</div>

<script>
    var APP_URL = '${appUrl}';
    var PAYMENT_TYPE = '${type}';
    var PRODUCT_ID = '${productId}';
    var PRODUCT_PRICE = '${productPrice}';
    var VARIANT_ID = '${variantId}';
    var selectedPlanId = null;

    function selectPlan(el) {
        document.querySelectorAll('.plan-card').forEach(function(c) {
            c.classList.remove('selected');
        });
        el.classList.add('selected');
        selectedPlanId = el.getAttribute('data-plan-id');
    }

    function showError(msg) {
        var el = document.getElementById('error-msg');
        el.textContent = msg;
        el.style.display = 'block';
    }

    function hideError() {
        document.getElementById('error-msg').style.display = 'none';
    }

    function startPayment() {
        hideError();

        var name = document.getElementById('customerName').value.trim();
        var email = document.getElementById('customerEmail').value.trim();
        var phone = document.getElementById('customerPhone').value.trim();
        var city = document.getElementById('customerCity').value.trim();
        var address = document.getElementById('customerAddress').value.trim();

        if (!name || !email || !phone || !city || !address) {
            showError('Lütfen tüm alanları doldurun');
            return;
        }

        if (PAYMENT_TYPE === 'subscription' && !selectedPlanId) {
            showError('Lütfen bir plan seçin');
            return;
        }

        var btn = document.getElementById('btn-pay');
        btn.disabled = true;
        btn.textContent = '⏳ İşleniyor...';

        var payload = {
            type: PAYMENT_TYPE,
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            customerCity: city,
            customerAddress: address,
        };

        if (PAYMENT_TYPE === 'subscription') {
            payload.planId = selectedPlanId;
        } else {
            payload.productId = PRODUCT_ID;
            payload.productPrice = PRODUCT_PRICE;
            payload.variantId = VARIANT_ID;
        }

        fetch(APP_URL + '/api/iyzico/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success && data.checkoutFormContent) {
                // Formu goster
                document.getElementById('checkout-form-area').style.display = 'none';
                var container = document.getElementById('iyzico-form-container');
                container.style.display = 'block';
                var formArea = document.getElementById('iyzico-form-area');
                formArea.innerHTML = data.checkoutFormContent;

                // Script'leri calistir
                var scripts = formArea.querySelectorAll('script');
                scripts.forEach(function(oldScript) {
                    var newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(function(attr) {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    if (oldScript.textContent) {
                        newScript.textContent = oldScript.textContent;
                    }
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            } else {
                showError(data.error || 'Ödeme başlatılamadı');
                btn.disabled = false;
                btn.textContent = PAYMENT_TYPE === 'single' ? '💳 Ödeme Yap' : '💳 Aboneliği Başlat';
            }
        })
        .catch(function(err) {
            showError('Bir hata oluştu: ' + err.message);
            btn.disabled = false;
            btn.textContent = PAYMENT_TYPE === 'single' ? '💳 Ödeme Yap' : '💳 Aboneliği Başlat';
        });
    }

    // İlk planı otomatik sec
    var firstPlan = document.querySelector('.plan-card');
    if (firstPlan) selectPlan(firstPlan);
</script>
`;
}
