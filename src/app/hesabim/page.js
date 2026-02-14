'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PortalContent() {
    const searchParams = useSearchParams();
    const emailFromUrl = searchParams.get('email') || '';

    const [email, setEmail] = useState(emailFromUrl);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // overview | payments | settings

    // Auto-login if email comes from Shopify
    useEffect(() => {
        if (emailFromUrl) {
            fetchSubscriptions(emailFromUrl);
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
                setIsLoggedIn(true);
                setEmail(targetEmail);
            } else {
                setMsg({ type: 'error', text: 'Bu e-posta adresine ait abonelik bulunamadı.' });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Bağlantı hatası: ' + err.message });
        }
        setLoading(false);
    }

    async function handleLogin(e) {
        e.preventDefault();
        if (!email) return;
        fetchSubscriptions(email);
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
                setMsg({ type: 'success', text: '✅ Teslimat sıklığı güncellendi!' });
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
                setMsg({ type: 'success', text: '✅ Abonelik iptal edildi.' });
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
            } else if (data.success) {
                setMsg({ type: 'success', text: '✅ Ödeme bilgileri güncellendi.' });
            } else {
                setMsg({ type: 'error', text: data.error || 'Ödeme güncellemesi başarısız.' });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Bağlantı hatası: ' + err.message });
        }
    }

    // ---------- LOGIN SCREEN ----------
    if (!isLoggedIn) {
        return (
            <div style={s.page}>
                <div style={s.container}>
                    <div style={s.loginCard}>
                        <div style={s.loginIcon}>🌱</div>
                        <h2 style={s.loginTitle}>Abonelik Paneli</h2>
                        <p style={s.loginDesc}>Aboneliklerinizi görüntüleyin ve yönetin</p>

                        {msg && <MsgBox msg={msg} />}

                        <form onSubmit={handleLogin} style={{ width: '100%' }}>
                            <label style={s.inputLabel}>E-posta Adresiniz</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@email.com"
                                style={s.input}
                                required
                            />
                            <button type="submit" style={s.btnPrimary} disabled={loading}>
                                {loading ? (
                                    <span>⏳ Yükleniyor...</span>
                                ) : (
                                    <span>Giriş Yap</span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // ---------- DASHBOARD ----------
    const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE');
    const otherSubs = subscriptions.filter(s => s.status !== 'ACTIVE');

    return (
        <div style={s.page}>
            <div style={s.container}>
                {/* Header */}
                <div style={s.dashHeader}>
                    <div>
                        <h2 style={s.dashTitle}>Hoş Geldiniz 👋</h2>
                        <p style={s.dashEmail}>{email}</p>
                    </div>
                    <button onClick={() => { setIsLoggedIn(false); setSubscriptions([]); }} style={s.btnLogout}>
                        Çıkış
                    </button>
                </div>

                {msg && <MsgBox msg={msg} />}

                {/* Tabs */}
                <div style={s.tabs}>
                    {[
                        { key: 'overview', label: '📦 Abonelikler' },
                        { key: 'payments', label: '💳 Ödeme Geçmişi' },
                        { key: 'settings', label: '⚙️ Ayarlar' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={activeTab === tab.key ? s.tabActive : s.tab}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB: Overview */}
                {activeTab === 'overview' && (
                    <>
                        {activeSubs.length > 0 && (
                            <div style={s.sectionLabel}>Aktif Abonelikler</div>
                        )}
                        {activeSubs.map(sub => (
                            <SubCard
                                key={sub.id}
                                sub={sub}
                                onUpdateFreq={handleUpdateFreq}
                                onCancel={handleCancel}
                                onUpdatePayment={handleUpdatePayment}
                            />
                        ))}

                        {otherSubs.length > 0 && (
                            <div style={{ ...s.sectionLabel, marginTop: 30 }}>Geçmiş Abonelikler</div>
                        )}
                        {otherSubs.map(sub => (
                            <SubCard key={sub.id} sub={sub} />
                        ))}
                    </>
                )}

                {/* TAB: Payments */}
                {activeTab === 'payments' && (
                    <div style={s.card}>
                        <h3 style={s.cardTitle}>Ödeme Geçmişi</h3>
                        {subscriptions.some(sub => sub.payments?.length > 0) ? (
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        <th style={s.th}>Tarih</th>
                                        <th style={s.th}>Paket</th>
                                        <th style={s.th}>Tutar</th>
                                        <th style={s.th}>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscriptions.flatMap(sub =>
                                        (sub.payments || []).map(p => (
                                            <tr key={p.id}>
                                                <td style={s.td}>{formatDate(p.createdAt)}</td>
                                                <td style={s.td}>{sub.plan?.name || '-'}</td>
                                                <td style={s.td}>{p.amount} ₺</td>
                                                <td style={s.td}>
                                                    <span style={p.status === 'SUCCESS' ? s.badgeSuccess : s.badgeFail}>
                                                        {p.status === 'SUCCESS' ? 'Başarılı' : 'Başarısız'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <p style={s.emptyText}>Henüz ödeme kaydı bulunmuyor.</p>
                        )}
                    </div>
                )}

                {/* TAB: Settings */}
                {activeTab === 'settings' && (
                    <div style={s.card}>
                        <h3 style={s.cardTitle}>Ödeme Yöntemi</h3>
                        <p style={s.settingsDesc}>
                            Kayıtlı kart bilgilerinizi güncelleyebilirsiniz. "Kartımı Güncelle" butonuna tıklayarak yeni kart bilgilerinizi girebilirsiniz.
                        </p>
                        {activeSubs.map(sub => (
                            <div key={sub.id} style={s.paymentUpdateRow}>
                                <div>
                                    <div style={s.paymentPlanName}>{sub.plan?.name || 'Abonelik'}</div>
                                    <div style={s.paymentPlanPrice}>{sub.plan?.price} ₺ / {getFreqLabel(sub.plan)}</div>
                                </div>
                                <button onClick={() => handleUpdatePayment(sub.id)} style={s.btnUpdate}>
                                    💳 Kartımı Güncelle
                                </button>
                            </div>
                        ))}
                        {activeSubs.length === 0 && (
                            <p style={s.emptyText}>Aktif aboneliğiniz bulunmuyor.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------- SUB COMPONENTS ----------

function SubCard({ sub, onUpdateFreq, onCancel, onUpdatePayment }) {
    const isActive = sub.status === 'ACTIVE';

    return (
        <div style={s.card}>
            <div style={s.cardHeader}>
                <div>
                    <h3 style={s.subName}>{sub.plan?.name || 'Abonelik'}</h3>
                    <span style={s.subPrice}>{sub.plan?.price} ₺ / {getFreqLabel(sub.plan)}</span>
                </div>
                <Badge status={sub.status} />
            </div>

            <div style={s.infoGrid}>
                <InfoItem icon="📅" label="Sonraki Ödeme" value={formatDate(sub.nextPaymentDate)} />
                <InfoItem icon="📆" label="Başlangıç" value={formatDate(sub.startDate)} />
                <InfoItem icon="🔄" label="Dönem Sonu" value={formatDate(sub.currentPeriodEnd)} />
                <InfoItem icon="📊" label="Durum" value={sub.status === 'ACTIVE' ? 'Aktif' : sub.status === 'CANCELLED' ? 'İptal' : sub.status} />
            </div>

            {isActive && onUpdateFreq && (
                <div style={s.actionsContainer}>
                    <div style={s.freqSection}>
                        <label style={s.freqLabel}>Teslimat Sıklığı</label>
                        <select
                            style={s.select}
                            defaultValue={getFreqValue(sub.plan)}
                            onChange={(e) => onUpdateFreq(sub.id, e.target.value)}
                        >
                            <option value="1_week">Haftada bir</option>
                            <option value="2_week">2 haftada bir</option>
                            <option value="3_week">3 haftada bir</option>
                            <option value="1_month">Ayda bir</option>
                            <option value="2_month">2 ayda bir</option>
                            <option value="3_month">3 ayda bir</option>
                        </select>
                    </div>
                    <div style={s.btnRow}>
                        {onUpdatePayment && (
                            <button onClick={() => onUpdatePayment(sub.id)} style={s.btnUpdate}>
                                💳 Kart Güncelle
                            </button>
                        )}
                        <button onClick={() => onCancel(sub.id)} style={s.btnDanger}>
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
        <div style={s.infoItem}>
            <span style={s.infoIcon}>{icon}</span>
            <div>
                <div style={s.infoLabel}>{label}</div>
                <div style={s.infoValue}>{value}</div>
            </div>
        </div>
    );
}

function Badge({ status }) {
    const map = {
        ACTIVE: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Aktif' },
        CANCELLED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'İptal' },
        PAUSED: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Durduruldu' },
    };
    const c = map[status] || { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: status };
    return (
        <span style={{ background: c.bg, color: c.color, padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            {c.label}
        </span>
    );
}

function MsgBox({ msg }) {
    const bgMap = { error: 'rgba(239,68,68,0.12)', success: 'rgba(34,197,94,0.12)', info: 'rgba(59,130,246,0.12)' };
    const colorMap = { error: '#ef4444', success: '#22c55e', info: '#3b82f6' };
    return (
        <div style={{ background: bgMap[msg.type] || bgMap.info, color: colorMap[msg.type] || colorMap.info, padding: 14, borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500, border: `1px solid ${colorMap[msg.type] || colorMap.info}22` }}>
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
    if (plan.interval === 'YEARLY') return '12_month';
    return plan.intervalCount + '_month';
}

function getFreqLabel(plan) {
    if (!plan) return 'Aylık';
    const map = { '1_week': 'Haftalık', '2_week': '2 Hafta', '3_week': '3 Hafta', '1_month': 'Aylık', '2_month': '2 Ay', '3_month': '3 Ay' };
    return map[getFreqValue(plan)] || 'Aylık';
}

// ---------- STYLES ----------
const s = {
    page: { minHeight: '100vh', background: 'transparent', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: '#e2e8f0', padding: '0' },
    container: { maxWidth: 640, margin: '0 auto', padding: '20px 16px' },

    // Login
    loginCard: { background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(148,163,184,0.1)' },
    loginIcon: { fontSize: 48, marginBottom: 16 },
    loginTitle: { fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#f1f5f9' },
    loginDesc: { fontSize: 14, color: '#94a3b8', marginBottom: 28 },
    inputLabel: { display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 6, textAlign: 'left' },
    input: { width: '100%', padding: '12px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, color: '#f1f5f9', fontSize: 15, outline: 'none', marginBottom: 16, boxSizing: 'border-box' },
    btnPrimary: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },

    // Dashboard Header
    dashHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    dashTitle: { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#f1f5f9' },
    dashEmail: { fontSize: 13, color: '#64748b' },
    btnLogout: { padding: '8px 16px', background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, cursor: 'pointer', fontSize: 13 },

    // Tabs
    tabs: { display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(15,23,42,0.4)', borderRadius: 12, padding: 4 },
    tab: { flex: 1, padding: '10px 0', background: 'transparent', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.2s' },
    tabActive: { flex: 1, padding: '10px 0', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

    sectionLabel: { fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

    // Cards
    card: { background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: 24, marginBottom: 16, border: '1px solid rgba(148,163,184,0.08)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#f1f5f9' },
    subName: { fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: '#f1f5f9' },
    subPrice: { fontSize: 13, color: '#22c55e', fontWeight: 500 },

    // Info Grid
    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
    infoItem: { display: 'flex', gap: 10, alignItems: 'flex-start' },
    infoIcon: { fontSize: 18, lineHeight: 1 },
    infoLabel: { fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 14, fontWeight: 500, color: '#e2e8f0' },

    // Actions
    actionsContainer: { background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 16 },
    freqSection: { marginBottom: 14 },
    freqLabel: { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500 },
    select: { width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 14 },
    btnRow: { display: 'flex', gap: 10 },
    btnUpdate: { flex: 1, padding: '10px 16px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
    btnDanger: { padding: '10px 16px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },

    // Table
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(148,163,184,0.1)' },
    td: { padding: '12px', fontSize: 14, color: '#cbd5e1', borderBottom: '1px solid rgba(148,163,184,0.06)' },
    badgeSuccess: { background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 },
    badgeFail: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 },

    // Settings
    settingsDesc: { fontSize: 14, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 },
    paymentUpdateRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'rgba(15,23,42,0.4)', borderRadius: 10, marginBottom: 10 },
    paymentPlanName: { fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 },
    paymentPlanPrice: { fontSize: 13, color: '#22c55e' },

    emptyText: { textAlign: 'center', color: '#64748b', padding: 20, fontSize: 14 },
};

export default function CustomerPortalPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Yükleniyor...</div>}>
            <PortalContent />
        </Suspense>
    );
}
