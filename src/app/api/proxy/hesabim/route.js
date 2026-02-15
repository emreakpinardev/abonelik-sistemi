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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Eger email varsa abonelikleri getir (AJAX cagrisi)
    const email = searchParams.get('email');
    const action = searchParams.get('action');

    if (action === 'fetch' && email) {
        try {
            const subscriptions = await prisma.subscription.findMany({
                where: { customerEmail: email.toLowerCase() },
                include: {
                    plan: true,
                    payments: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return NextResponse.json({ subscriptions });
        } catch (err) {
            return NextResponse.json({ error: err.message }, { status: 500 });
        }
    }

    // Ana sayfa HTML'i dondur (Liquid uyumlu)
    const html = generatePortalHTML(appUrl);

    return new NextResponse(html, {
        headers: { 'Content-Type': 'application/liquid' },
    });
}

function generatePortalHTML(appUrl) {
    return `
<style>
    .hp-container {
        max-width: 720px;
        margin: 40px auto;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .hp-title {
        font-size: 26px;
        font-weight: 700;
        margin-bottom: 6px;
    }
    .hp-subtitle {
        color: #666;
        margin-bottom: 28px;
        font-size: 14px;
    }
    .hp-card {
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .hp-card h3 {
        font-size: 17px;
        margin: 0 0 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f0f0f0;
    }
    .hp-login-form {
        display: flex;
        gap: 10px;
        align-items: flex-end;
    }
    .hp-login-form input {
        flex: 1;
        padding: 11px 14px;
        border: 1.5px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
    }
    .hp-login-form input:focus {
        border-color: #5c6ac4;
    }
    .hp-btn {
        padding: 11px 22px;
        background: #5c6ac4;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap;
    }
    .hp-btn:hover { background: #4959bd; }
    .hp-btn:disabled { background: #ccc; cursor: not-allowed; }
    .hp-btn-danger {
        background: #e53935;
    }
    .hp-btn-danger:hover { background: #c62828; }
    .hp-btn-sm {
        padding: 7px 14px;
        font-size: 13px;
    }
    .hp-empty {
        text-align: center;
        padding: 32px;
        color: #888;
        font-size: 14px;
    }
    .hp-sub-card {
        border: 1px solid #e8e8e8;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 14px;
        background: #fafafa;
    }
    .hp-sub-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
    }
    .hp-sub-name {
        font-weight: 700;
        font-size: 16px;
    }
    .hp-badge {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    .hp-badge-active { background: #e8f5e9; color: #2e7d32; }
    .hp-badge-cancelled { background: #fce4ec; color: #c62828; }
    .hp-badge-paused { background: #fff3e0; color: #e65100; }
    .hp-badge-failed { background: #fce4ec; color: #c62828; }
    .hp-badge-pending { background: #e3f2fd; color: #1565c0; }
    .hp-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
    }
    .hp-info-item label {
        display: block;
        font-size: 12px;
        color: #888;
        margin-bottom: 2px;
    }
    .hp-info-item span {
        font-size: 14px;
        font-weight: 500;
    }
    .hp-freq-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding: 12px;
        background: #fff;
        border-radius: 8px;
        border: 1px solid #e8e8e8;
    }
    .hp-freq-row label {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
    }
    .hp-freq-row select {
        flex: 1;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
    }
    .hp-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }
    .hp-payments-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    .hp-payments-table th {
        text-align: left;
        padding: 8px;
        border-bottom: 2px solid #eee;
        font-size: 12px;
        color: #888;
        font-weight: 600;
    }
    .hp-payments-table td {
        padding: 8px;
        border-bottom: 1px solid #f0f0f0;
    }
    .hp-status-ok { color: #2e7d32; font-weight: 600; }
    .hp-status-fail { color: #c62828; font-weight: 600; }
    .hp-msg {
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 14px;
        font-size: 13px;
        display: none;
    }
    .hp-msg-success { background: #e8f5e9; color: #2e7d32; }
    .hp-msg-error { background: #fce4ec; color: #c62828; }
    .hp-loading {
        text-align: center;
        padding: 24px;
        color: #888;
    }
    @media (max-width: 600px) {
        .hp-info-grid { grid-template-columns: 1fr; }
        .hp-login-form { flex-direction: column; }
        .hp-freq-row { flex-direction: column; align-items: stretch; }
        .hp-actions { flex-direction: column; }
    }
</style>

<div class="hp-container">
    <div class="hp-title">Hesabim</div>
    <div class="hp-subtitle">Aboneliklerinizi yonetin, siklik degistirin, odeme gecmisinizi gorun</div>

    <div id="hp-msg" class="hp-msg"></div>

    <!-- GIRIS FORMU -->
    <div id="hp-login-card" class="hp-card">
        <h3>Giris Yapin</h3>
        <p style="font-size:13px;color:#666;margin-bottom:14px;">Abonelik olusturdugunuz e-posta adresini girin.</p>
        <div class="hp-login-form">
            <input type="email" id="hp-email" placeholder="ornek@email.com" />
            <button class="hp-btn" onclick="hpLogin()">Aboneliklerimi Gor</button>
        </div>
    </div>

    <!-- ICERIK ALANI -->
    <div id="hp-content" style="display:none;"></div>
</div>

<script>
    var HP_APP_URL = '${appUrl}';
    var HP_EMAIL = '';

    function hpShowMsg(text, type) {
        var el = document.getElementById('hp-msg');
        el.textContent = text;
        el.className = 'hp-msg hp-msg-' + type;
        el.style.display = 'block';
        setTimeout(function() { el.style.display = 'none'; }, 5000);
    }

    function hpLogin() {
        var email = document.getElementById('hp-email').value.trim();
        if (!email) { hpShowMsg('Lutfen e-posta girin', 'error'); return; }
        HP_EMAIL = email;
        hpFetchSubscriptions();
    }

    function hpFetchSubscriptions() {
        document.getElementById('hp-content').innerHTML = '<div class="hp-loading">Yukleniyor...</div>';
        document.getElementById('hp-content').style.display = 'block';
        document.getElementById('hp-login-card').style.display = 'none';

        fetch(HP_APP_URL + '/api/subscription/status?email=' + encodeURIComponent(HP_EMAIL))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var subs = data.subscriptions || [];
            if (subs.length === 0) {
                document.getElementById('hp-content').innerHTML =
                    '<div class="hp-card"><div class="hp-empty">Bu e-posta adresine ait abonelik bulunamadi.</div></div>' +
                    '<button class="hp-btn" onclick="hpLogout()">Farkli E-posta Dene</button>';
                return;
            }
            renderSubscriptions(subs);
        })
        .catch(function(err) {
            hpShowMsg('Baglanti hatasi: ' + err.message, 'error');
            document.getElementById('hp-login-card').style.display = 'block';
            document.getElementById('hp-content').style.display = 'none';
        });
    }

    function hpLogout() {
        HP_EMAIL = '';
        document.getElementById('hp-login-card').style.display = 'block';
        document.getElementById('hp-content').style.display = 'none';
        document.getElementById('hp-email').value = '';
    }

    function getStatusBadge(status) {
        var map = {
            'ACTIVE': '<span class="hp-badge hp-badge-active">Aktif</span>',
            'CANCELLED': '<span class="hp-badge hp-badge-cancelled">Iptal Edildi</span>',
            'PAUSED': '<span class="hp-badge hp-badge-paused">Durduruldu</span>',
            'PAYMENT_FAILED': '<span class="hp-badge hp-badge-failed">Odeme Hatasi</span>',
            'PENDING': '<span class="hp-badge hp-badge-pending">Beklemede</span>',
            'EXPIRED': '<span class="hp-badge hp-badge-cancelled">Suresi Doldu</span>',
        };
        return map[status] || '<span class="hp-badge">' + status + '</span>';
    }

    function getFreqValue(plan) {
        if (!plan) return '1_month';
        if (plan.interval === 'MINUTELY') return plan.intervalCount + '_minute';
        if (plan.interval === 'WEEKLY') return plan.intervalCount + '_week';
        if (plan.interval === 'QUARTERLY') return '3_month';
        if (plan.interval === 'YEARLY') return '12_month';
        return plan.intervalCount + '_month';
    }

    function formatDate(d) {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function renderSubscriptions(subs) {
        var html = '';

        for (var i = 0; i < subs.length; i++) {
            var s = subs[i];
            var plan = s.plan || {};
            var currentFreq = getFreqValue(plan);
            var isActive = s.status === 'ACTIVE';

            html += '<div class="hp-sub-card">';
            html += '<div class="hp-sub-header">';
            html += '<span class="hp-sub-name">' + (plan.name || 'Abonelik') + '</span>';
            html += getStatusBadge(s.status);
            html += '</div>';

            html += '<div class="hp-info-grid">';
            html += '<div class="hp-info-item"><label>Fiyat</label><span>' + (plan.price || 0) + ' TL</span></div>';
            html += '<div class="hp-info-item"><label>Sonraki Odeme</label><span>' + formatDate(s.nextPaymentDate) + '</span></div>';
            html += '<div class="hp-info-item"><label>Baslangic</label><span>' + formatDate(s.startDate) + '</span></div>';
            html += '<div class="hp-info-item"><label>Donem Sonu</label><span>' + formatDate(s.currentPeriodEnd) + '</span></div>';
            html += '</div>';

            // Siklik degistirme (sadece aktif aboneliklerde)
            if (isActive) {
                html += '<div class="hp-freq-row">';
                html += '<label>Teslimat Sikligi:</label>';
                html += '<select id="freq-' + s.id + '">';
                html += '<option value="1_minute"' + (currentFreq === '1_minute' ? ' selected' : '') + '>Dakikada bir</option>';
                html += '<option value="5_minute"' + (currentFreq === '5_minute' ? ' selected' : '') + '>5 dakikada bir</option>';
                html += '<option value="10_minute"' + (currentFreq === '10_minute' ? ' selected' : '') + '>10 dakikada bir</option>';
                html += '<option value="30_minute"' + (currentFreq === '30_minute' ? ' selected' : '') + '>30 dakikada bir</option>';
                html += '<option value="1_week"' + (currentFreq === '1_week' ? ' selected' : '') + '>Haftada bir</option>';
                html += '<option value="2_week"' + (currentFreq === '2_week' ? ' selected' : '') + '>2 haftada bir</option>';
                html += '<option value="1_month"' + (currentFreq === '1_month' ? ' selected' : '') + '>Ayda bir</option>';
                html += '<option value="2_month"' + (currentFreq === '2_month' ? ' selected' : '') + '>2 ayda bir</option>';
                html += '<option value="3_month"' + (currentFreq === '3_month' ? ' selected' : '') + '>3 ayda bir</option>';
                html += '</select>';
                html += '<button class="hp-btn hp-btn-sm" onclick="hpUpdateFreq(\\'' + s.id + '\\')">Guncelle</button>';
                html += '</div>';
            }

            // Islem butonlari
            html += '<div class="hp-actions">';
            if (isActive) {
                html += '<button class="hp-btn hp-btn-sm hp-btn-danger" onclick="hpCancel(\\'' + s.id + '\\')">Aboneligi Iptal Et</button>';
            }
            html += '</div>';

            // Odeme gecmisi
            var payments = s.payments || [];
            if (payments.length > 0) {
                html += '<div style="margin-top:16px;">';
                html += '<table class="hp-payments-table">';
                html += '<tr><th>Tarih</th><th>Tutar</th><th>Durum</th><th>Siparis</th></tr>';
                for (var j = 0; j < payments.length; j++) {
                    var p = payments[j];
                    html += '<tr>';
                    html += '<td>' + formatDate(p.createdAt) + '</td>';
                    html += '<td>' + p.amount + ' TL</td>';
                    html += '<td class="' + (p.status === 'SUCCESS' ? 'hp-status-ok' : 'hp-status-fail') + '">' + (p.status === 'SUCCESS' ? 'Basarili' : 'Basarisiz') + '</td>';
                    html += '<td>' + (p.shopifyOrderName || '-') + '</td>';
                    html += '</tr>';
                }
                html += '</table>';
                html += '</div>';
            }

            html += '</div>';
        }

        html += '<div style="margin-top:16px;"><button class="hp-btn" onclick="hpLogout()" style="background:#666;">Cikis Yap</button></div>';
        document.getElementById('hp-content').innerHTML = html;
    }

    function hpUpdateFreq(subId) {
        var sel = document.getElementById('freq-' + subId);
        if (!sel) return;
        var freq = sel.value;

        fetch(HP_APP_URL + '/api/subscription/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: subId, email: HP_EMAIL, frequency: freq }),
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                hpShowMsg('Siklik guncellendi: ' + data.newFrequency, 'success');
                hpFetchSubscriptions(); // Sayfayi yenile
            } else {
                hpShowMsg(data.error || 'Guncelleme basarisiz', 'error');
            }
        })
        .catch(function(err) { hpShowMsg('Hata: ' + err.message, 'error'); });
    }

    function hpCancel(subId) {
        if (!confirm('Aboneliginizi iptal etmek istediginize emin misiniz?')) return;

        fetch(HP_APP_URL + '/api/subscription/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: subId }),
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                hpShowMsg('Aboneliginiz iptal edildi', 'success');
                hpFetchSubscriptions();
            } else {
                hpShowMsg(data.error || 'Iptal basarisiz', 'error');
            }
        })
        .catch(function(err) { hpShowMsg('Hata: ' + err.message, 'error'); });
    }
</script>
`;
}
