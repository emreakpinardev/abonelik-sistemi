'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PortalContent() {
    const searchParams = useSearchParams();
    const emailFromUrl = searchParams.get('email') || '';

    const [email] = useState(emailFromUrl);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [noSub, setNoSub] = useState(false);

    useEffect(() => {
        if (emailFromUrl) {
            fetchSubscriptions(emailFromUrl);
        } else {
            setLoading(false);
            setNoSub(true);
        }
    }, [emailFromUrl]);

    async function fetchSubscriptions(targetEmail) {
        setLoading(true);
        setMsg(null);
        try {
            const res = await fetch(`/api/subscription/status?email=${encodeURIComponent(targetEmail)}`);
            const data = await res.json();
            if (data.subscriptions && data.subscriptions.length > 0) {
                setSubscriptions(data.subscriptions);
            } else {
                setNoSub(true);
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Bağlantı hatası: ' + err.message });
        }
        setLoading(false);
    }

    async function handleUpdateFreq(subId, newFreq) {
        try {
            const res = await fetch('/api/subscription/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: subId, email, frequency: newFreq }),
            });
            const data = await res.json();
            if (data.success) {
                setMsg({ type: 'success', text: 'Teslimat sıklığı güncellendi!' });
                fetchSubscriptions(email);
            } else {
                setMsg({ type: 'error', text: 'Hata: ' + data.error });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Hata: ' + err.message });
        }
    }

    async function handleCancel(subId) {
        if (!confirm('Aboneliğinizi iptal etmek istediğinize emin misiniz?')) return;
        try {
            const res = await fetch('/api/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: subId }),
            });
            const data = await res.json();
            if (data.success) {
                setMsg({ type: 'success', text: 'Abonelik iptal edildi.' });
                fetchSubscriptions(email);
            } else {
                setMsg({ type: 'error', text: 'Hata: ' + data.error });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Hata: ' + err.message });
        }
    }

    async function handleUpdatePayment(subId) {
        setMsg({ type: 'info', text: 'Ödeme sayfasına yönlendiriliyorsunuz...' });
        try {
            const res = await fetch('/api/subscription/update-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: subId, email }),
            });
            const data = await res.json();
            if (data.paymentPageUrl) {
                window.open(data.paymentPageUrl, '_blank');
                setMsg({ type: 'success', text: 'Ödeme sayfası yeni sekmede açıldı. 1 TL doğrulama ücreti alınıp otomatik iade edilecektir.' });
            } else {
                setMsg({ type: 'error', text: data.error || 'Ödeme güncellemesi başarısız.' });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Bağlantı hatası: ' + err.message });
        }
    }

    // Loading spinner
    if (loading) {
        return (
            <div style={st.page}>
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
                <div style={st.loadingBox}>
                    <span className="material-icons-outlined" style={{ fontSize: 48, color: '#16a34a', animation: 'spin 1s linear infinite' }}>autorenew</span>
                    <p style={{ color: '#6b7280', marginTop: 12, fontSize: 14 }}>Abonelikleriniz yükleniyor...</p>
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // No subscription
    if (noSub) {
        return (
            <div style={st.page}>
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
                <div style={st.container}>
                    <div style={st.emptyCard}>
                        <span className="material-icons-outlined" style={{ fontSize: 56, color: '#d1d5db', marginBottom: 12 }}>inventory_2</span>
                        <h2 style={st.emptyTitle}>Abonelik Bulunamadı</h2>
                        <p style={st.emptyDesc}>
                            {emailFromUrl
                                ? 'Bu hesaba ait aktif bir abonelik bulunamadı.'
                                : 'Abonelik bilgilerinizi görüntülemek için lütfen hesabınıza giriş yapın.'}
                        </p>
                        {!emailFromUrl && (
                            <a href="/account/login" style={st.btnGreen}>
                                <span className="material-icons-outlined" style={{ fontSize: 18, marginRight: 6, verticalAlign: 'middle' }}>login</span>
                                Giriş Yap
                            </a>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE');
    const otherSubs = subscriptions.filter(s => s.status !== 'ACTIVE');
    const allPayments = subscriptions.flatMap(sub => (sub.payments || []).map(p => ({ ...p, planName: sub.plan?.name })));
    allPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <div style={st.page}>
            <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />

            <div style={st.container}>
                {msg && <MsgBox msg={msg} />}

                {/* Tabs */}
                <div style={st.tabs}>
                    <TabBtn active={activeTab === 'overview'} icon="local_shipping" label="Abonelikler" onClick={() => setActiveTab('overview')} />
                    <TabBtn active={activeTab === 'payments'} icon="receipt_long" label="Ödeme Geçmişi" onClick={() => setActiveTab('payments')} />
                    <TabBtn active={activeTab === 'invoices'} icon="description" label="Faturalar" onClick={() => setActiveTab('invoices')} />
                    <TabBtn active={activeTab === 'settings'} icon="credit_card" label="Kart Ayarları" onClick={() => setActiveTab('settings')} />
                </div>

                {/* ===== TAB: Overview ===== */}
                {activeTab === 'overview' && (
                    <>
                        {activeSubs.length > 0 && <SectionLabel text="Aktif Abonelikler" />}
                        {activeSubs.map(sub => (
                            <SubCard key={sub.id} sub={sub} onUpdateFreq={handleUpdateFreq} onCancel={handleCancel} onUpdatePayment={handleUpdatePayment} />
                        ))}
                        {otherSubs.length > 0 && <SectionLabel text="Geçmiş Abonelikler" style={{ marginTop: 28 }} />}
                        {otherSubs.map(sub => <SubCard key={sub.id} sub={sub} />)}
                    </>
                )}

                {/* ===== TAB: Payments ===== */}
                {activeTab === 'payments' && (
                    <div style={st.card}>
                        <div style={st.cardTitleRow}>
                            <span className="material-icons-outlined" style={{ fontSize: 20, color: '#16a34a', marginRight: 8 }}>receipt_long</span>
                            <h3 style={st.cardTitleText}>Ödeme Geçmişi</h3>
                        </div>
                        {allPayments.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={st.table}>
                                    <thead>
                                        <tr>
                                            <th style={st.th}>Tarih</th>
                                            <th style={st.th}>Paket</th>
                                            <th style={st.th}>Tutar</th>
                                            <th style={st.th}>Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allPayments.map(p => (
                                            <tr key={p.id} style={st.tr}>
                                                <td style={st.td}>{formatDate(p.createdAt)}</td>
                                                <td style={st.td}>{p.planName || '-'}</td>
                                                <td style={{ ...st.td, fontWeight: 600 }}>{p.amount} ₺</td>
                                                <td style={st.td}>
                                                    <StatusBadge success={p.status === 'SUCCESS'} label={p.status === 'SUCCESS' ? 'Başarılı' : 'Başarısız'} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState icon="payments" text="Henüz ödeme kaydı bulunmuyor." />
                        )}
                    </div>
                )}

                {/* ===== TAB: Invoices ===== */}
                {activeTab === 'invoices' && (
                    <div style={st.card}>
                        <div style={st.cardTitleRow}>
                            <span className="material-icons-outlined" style={{ fontSize: 20, color: '#16a34a', marginRight: 8 }}>description</span>
                            <h3 style={st.cardTitleText}>Faturalarım</h3>
                        </div>
                        {allPayments.filter(p => p.status === 'SUCCESS').length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={st.table}>
                                    <thead>
                                        <tr>
                                            <th style={st.th}>Fatura No</th>
                                            <th style={st.th}>Tarih</th>
                                            <th style={st.th}>Paket</th>
                                            <th style={st.th}>Tutar</th>
                                            <th style={st.th}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allPayments.filter(p => p.status === 'SUCCESS').map((p, i) => (
                                            <tr key={p.id} style={st.tr}>
                                                <td style={{ ...st.td, fontWeight: 500 }}>INV-{String(allPayments.filter(x => x.status === 'SUCCESS').length - i).padStart(4, '0')}</td>
                                                <td style={st.td}>{formatDate(p.createdAt)}</td>
                                                <td style={st.td}>{p.planName || '-'}</td>
                                                <td style={{ ...st.td, fontWeight: 600 }}>{p.amount} ₺</td>
                                                <td style={st.td}>
                                                    <button onClick={() => handleDownloadInvoice(p, allPayments.filter(x => x.status === 'SUCCESS').length - i)} style={st.btnSmall}>
                                                        <span className="material-icons-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>download</span>
                                                        İndir
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState icon="description" text="Henüz fatura bulunmuyor." />
                        )}
                    </div>
                )}

                {/* ===== TAB: Settings ===== */}
                {activeTab === 'settings' && (
                    <div style={st.card}>
                        <div style={st.cardTitleRow}>
                            <span className="material-icons-outlined" style={{ fontSize: 20, color: '#16a34a', marginRight: 8 }}>credit_card</span>
                            <h3 style={st.cardTitleText}>Ödeme Yöntemi</h3>
                        </div>
                        <p style={st.settingsDesc}>
                            Kayıtlı kart bilgilerinizi güncelleyebilirsiniz. Güncelleme sırasında 1 ₺ doğrulama ücreti alınır ve <strong>otomatik olarak iade edilir</strong>.
                        </p>
                        {activeSubs.map(sub => (
                            <div key={sub.id} style={st.paymentRow}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span className="material-icons-outlined" style={{ fontSize: 28, color: '#6b7280' }}>credit_card</span>
                                    <div>
                                        <div style={st.paymentName}>{sub.plan?.name || 'Abonelik'}</div>
                                        <div style={st.paymentPrice}>{sub.plan?.price} ₺ / {getFreqLabel(sub.plan)}</div>
                                    </div>
                                </div>
                                <button onClick={() => handleUpdatePayment(sub.id)} style={st.btnOutline}>
                                    <span className="material-icons-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>sync</span>
                                    Kartı Güncelle
                                </button>
                            </div>
                        ))}
                        {activeSubs.length === 0 && (
                            <EmptyState icon="credit_card_off" text="Aktif aboneliğiniz bulunmuyor." />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ===== Invoice Download =====
function handleDownloadInvoice(payment, invoiceNum) {
    const invoiceNo = `INV-${String(invoiceNum).padStart(4, '0')}`;
    const date = new Date(payment.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${invoiceNo}</title>
<style>
body{font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:40px;color:#1e293b;max-width:700px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:20px;border-bottom:2px solid #e5e7eb}
.logo{font-size:22px;font-weight:700;color:#16a34a}
.invoice-label{font-size:28px;font-weight:700;color:#374151}
.meta{text-align:right;color:#6b7280;font-size:13px;line-height:1.8}
.section{margin-bottom:24px}
.section-title{font-size:12px;text-transform:uppercase;color:#9ca3af;letter-spacing:1px;margin-bottom:8px;font-weight:600}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{text-align:left;padding:12px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px}
td{padding:12px;border-bottom:1px solid #f3f4f6;font-size:14px}
.total-row td{font-weight:700;font-size:16px;border-top:2px solid #e5e7eb;padding-top:16px}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center}
@media print{body{padding:20px}}
</style></head><body>
<div class="header">
<div><div class="logo">Skycrops</div><div style="color:#6b7280;font-size:13px;margin-top:4px">Abonelik Faturası</div></div>
<div class="meta"><div class="invoice-label">${invoiceNo}</div>Tarih: ${date}</div>
</div>
<div class="section"><div class="section-title">Ödeme Detayları</div></div>
<table><thead><tr><th>Açıklama</th><th>Tutar</th></tr></thead>
<tbody><tr><td>${payment.planName || 'Abonelik'}</td><td>${payment.amount} ₺</td></tr>
<tr class="total-row"><td>Toplam</td><td>${payment.amount} ₺</td></tr></tbody></table>
<div class="footer">Bu belge elektronik olarak oluşturulmuştur. • Skycrops Abonelik Sistemi</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) setTimeout(() => { w.print(); }, 500);
}

// ===== Sub Components =====
function TabBtn({ active, icon, label, onClick }) {
    return (
        <button onClick={onClick} style={active ? st.tabActive : st.tab}>
            <span className="material-icons-outlined" style={{ fontSize: 18, display: 'block', marginBottom: 2 }}>{icon}</span>
            <span style={{ fontSize: 12 }}>{label}</span>
        </button>
    );
}

function SectionLabel({ text, style: extraStyle }) {
    return <div style={{ ...st.sectionLabel, ...extraStyle }}>{text}</div>;
}

function SubCard({ sub, onUpdateFreq, onCancel, onUpdatePayment }) {
    const isActive = sub.status === 'ACTIVE';
    return (
        <div style={st.card}>
            <div style={st.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-icons-outlined" style={{ fontSize: 24, color: isActive ? '#16a34a' : '#9ca3af' }}>
                        {isActive ? 'check_circle' : 'cancel'}
                    </span>
                    <div>
                        <h3 style={st.subName}>{sub.plan?.name || 'Abonelik'}</h3>
                        <span style={st.subPrice}>{sub.plan?.price} ₺ / {getFreqLabel(sub.plan)}</span>
                    </div>
                </div>
                <Badge status={sub.status} />
            </div>

            <div style={st.infoGrid}>
                <InfoItem icon="event" label="Sonraki Ödeme" value={formatDate(sub.nextPaymentDate)} />
                <InfoItem icon="today" label="Başlangıç" value={formatDate(sub.startDate)} />
                <InfoItem icon="date_range" label="Dönem Sonu" value={formatDate(sub.currentPeriodEnd)} />
                <InfoItem icon="info" label="Durum" value={isActive ? 'Aktif' : sub.status === 'CANCELLED' ? 'İptal Edildi' : sub.status} />
            </div>

            {isActive && onUpdateFreq && (
                <div style={st.actionsBox}>
                    <div style={st.freqRow}>
                        <div style={{ flex: 1 }}>
                            <label style={st.freqLabel}>
                                <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>schedule</span>
                                Teslimat Sıklığı
                            </label>
                            <select style={st.select} defaultValue={getFreqValue(sub.plan)} onChange={(e) => onUpdateFreq(sub.id, e.target.value)}>
                                <option value="1_week">Haftada bir</option>
                                <option value="2_week">2 haftada bir</option>
                                <option value="3_week">3 haftada bir</option>
                                <option value="1_month">Ayda bir</option>
                                <option value="2_month">2 ayda bir</option>
                                <option value="3_month">3 ayda bir</option>
                            </select>
                        </div>
                    </div>
                    <div style={st.btnRow}>
                        {onUpdatePayment && (
                            <button onClick={() => onUpdatePayment(sub.id)} style={st.btnOutline}>
                                <span className="material-icons-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>credit_card</span>
                                Kart Güncelle
                            </button>
                        )}
                        <button onClick={() => onCancel(sub.id)} style={st.btnDanger}>
                            <span className="material-icons-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>cancel</span>
                            İptal Et
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoItem({ icon, label, value }) {
    return (
        <div style={st.infoItem}>
            <span className="material-icons-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>{icon}</span>
            <div>
                <div style={st.infoLabel}>{label}</div>
                <div style={st.infoValue}>{value}</div>
            </div>
        </div>
    );
}

function Badge({ status }) {
    const map = {
        ACTIVE: { bg: '#dcfce7', color: '#166534', icon: 'check_circle', label: 'Aktif' },
        CANCELLED: { bg: '#fee2e2', color: '#991b1b', icon: 'cancel', label: 'İptal' },
        PAUSED: { bg: '#fef3c7', color: '#92400e', icon: 'pause_circle', label: 'Durduruldu' },
    };
    const c = map[status] || { bg: '#f1f5f9', color: '#475569', icon: 'help', label: status };
    return (
        <span style={{ background: c.bg, color: c.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>{c.icon}</span>
            {c.label}
        </span>
    );
}

function StatusBadge({ success, label }) {
    return (
        <span style={{
            background: success ? '#dcfce7' : '#fee2e2',
            color: success ? '#166534' : '#991b1b',
            padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 4
        }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>{success ? 'check_circle' : 'error'}</span>
            {label}
        </span>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <span className="material-icons-outlined" style={{ fontSize: 48, color: '#e5e7eb', display: 'block', marginBottom: 12 }}>{icon}</span>
            <p style={{ fontSize: 14, margin: 0 }}>{text}</p>
        </div>
    );
}

function MsgBox({ msg }) {
    const map = {
        error: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: 'error' },
        success: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: 'check_circle' },
        info: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: 'info' },
    };
    const c = map[msg.type] || map.info;
    return (
        <div style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons-outlined" style={{ fontSize: 20 }}>{c.icon}</span>
            {msg.text}
        </div>
    );
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getFreqValue(plan) {
    if (!plan) return '1_month';
    if (plan.interval === 'WEEKLY') return plan.intervalCount + '_week';
    if (plan.interval === 'QUARTERLY') return '3_month';
    return plan.intervalCount + '_month';
}
function getFreqLabel(plan) {
    const map = { '1_week': 'Haftalık', '2_week': '2 Hafta', '3_week': '3 Hafta', '1_month': 'Aylık', '2_month': '2 Ay', '3_month': '3 Ay' };
    return map[getFreqValue(plan)] || 'Aylık';
}

// ===== STYLES =====
const st = {
    page: { minHeight: '50vh', background: '#ffffff', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: '#1e293b', padding: 0 },
    container: { maxWidth: 680, margin: '0 auto', padding: '24px 20px' },

    loadingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' },

    emptyCard: { background: '#fff', borderRadius: 16, padding: '48px 32px', textAlign: 'center', border: '1px solid #e5e7eb' },
    emptyTitle: { fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#1e293b' },
    emptyDesc: { fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
    btnGreen: { display: 'inline-flex', alignItems: 'center', padding: '12px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' },

    // Tabs
    tabs: { display: 'flex', gap: 2, marginBottom: 24, background: '#f9fafb', borderRadius: 12, padding: 4, border: '1px solid #f3f4f6' },
    tab: { flex: 1, padding: '10px 0', background: 'transparent', color: '#9ca3af', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.2s' },
    tabActive: { flex: 1, padding: '10px 0', background: '#fff', color: '#16a34a', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },

    sectionLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },

    // Card
    card: { background: '#fff', borderRadius: 14, padding: 24, marginBottom: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' },
    cardTitleRow: { display: 'flex', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f3f4f6' },
    cardTitleText: { fontSize: 16, fontWeight: 600, margin: 0, color: '#1e293b' },
    subName: { fontSize: 15, fontWeight: 600, margin: '0 0 2px', color: '#1e293b' },
    subPrice: { fontSize: 13, color: '#16a34a', fontWeight: 500 },

    // Info Grid
    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 },
    infoItem: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#f9fafb', borderRadius: 8 },
    infoLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 },
    infoValue: { fontSize: 14, fontWeight: 600, color: '#374151' },

    // Actions
    actionsBox: { background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #f3f4f6' },
    freqRow: { display: 'flex', gap: 12, marginBottom: 14 },
    freqLabel: { display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 },
    select: { width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 14, cursor: 'pointer' },
    btnRow: { display: 'flex', gap: 10 },
    btnOutline: { flex: 1, padding: '10px 16px', background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    btnDanger: { padding: '10px 16px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    btnSmall: { padding: '6px 12px', background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center' },

    // Table
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #f3f4f6', fontWeight: 600 },
    td: { padding: '12px', fontSize: 14, color: '#374151', borderBottom: '1px solid #f9fafb' },
    tr: {},

    // Settings
    settingsDesc: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 },
    paymentRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f9fafb', borderRadius: 10, marginBottom: 10, border: '1px solid #f3f4f6' },
    paymentName: { fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 2 },
    paymentPrice: { fontSize: 13, color: '#16a34a' },
};

export default function CustomerPortalPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Yükleniyor...</div>}>
            <PortalContent />
        </Suspense>
    );
}
