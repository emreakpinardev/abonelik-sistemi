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

    // Loading
    if (loading) {
        return (
            <div style={st.page}>
                <div style={st.loadingBox}>
                    <div style={st.spinner}></div>
                    <p style={{ color: '#64748b', marginTop: 16 }}>Abonelikleriniz yükleniyor...</p>
                </div>
            </div>
        );
    }

    // No subscription found
    if (noSub) {
        return (
            <div style={st.page}>
                <div style={st.container}>
                    <div style={st.emptyCard}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                        <h2 style={st.emptyTitle}>Abonelik Bulunamadı</h2>
                        <p style={st.emptyDesc}>
                            {emailFromUrl
                                ? 'Bu hesaba ait aktif bir abonelik bulunamadı.'
                                : 'Abonelik bilgilerinizi görüntülemek için lütfen hesabınıza giriş yapın.'}
                        </p>
                        {!emailFromUrl && (
                            <a href="/account/login" style={st.btnPrimary}>Giriş Yap</a>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Dashboard
    const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE');
    const otherSubs = subscriptions.filter(s => s.status !== 'ACTIVE');

    return (
        <div style={st.page}>
            <div style={st.container}>
                {msg && <MsgBox msg={msg} />}

                {/* Tabs */}
                <div style={st.tabs}>
                    {[
                        { key: 'overview', label: '📦 Abonelikler' },
                        { key: 'payments', label: '💳 Ödeme Geçmişi' },
                        { key: 'settings', label: '⚙️ Ayarlar' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={activeTab === tab.key ? st.tabActive : st.tab}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB: Overview */}
                {activeTab === 'overview' && (
                    <>
                        {activeSubs.length > 0 && (
                            <div style={st.sectionLabel}>Aktif Abonelikler</div>
                        )}
                        {activeSubs.map(sub => (
                            <SubCard key={sub.id} sub={sub} onUpdateFreq={handleUpdateFreq} onCancel={handleCancel} onUpdatePayment={handleUpdatePayment} />
                        ))}
                        {otherSubs.length > 0 && (
                            <div style={{ ...st.sectionLabel, marginTop: 24 }}>Geçmiş Abonelikler</div>
                        )}
                        {otherSubs.map(sub => (
                            <SubCard key={sub.id} sub={sub} />
                        ))}
                    </>
                )}

                {/* TAB: Payments */}
                {activeTab === 'payments' && (
                    <div style={st.card}>
                        <h3 style={st.cardTitle}>Ödeme Geçmişi</h3>
                        {subscriptions.some(sub => sub.payments?.length > 0) ? (
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
                                        {subscriptions.flatMap(sub =>
                                            (sub.payments || []).map(p => (
                                                <tr key={p.id}>
                                                    <td style={st.td}>{formatDate(p.createdAt)}</td>
                                                    <td style={st.td}>{sub.plan?.name || '-'}</td>
                                                    <td style={st.td}><strong>{p.amount} ₺</strong></td>
                                                    <td style={st.td}>
                                                        <span style={p.status === 'SUCCESS' ? st.badgeSuccess : st.badgeFail}>
                                                            {p.status === 'SUCCESS' ? 'Başarılı' : 'Başarısız'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={st.emptyText}>Henüz ödeme kaydı bulunmuyor.</p>
                        )}
                    </div>
                )}

                {/* TAB: Settings */}
                {activeTab === 'settings' && (
                    <div style={st.card}>
                        <h3 style={st.cardTitle}>Ödeme Yöntemi</h3>
                        <p style={st.settingsDesc}>Kayıtlı kart bilgilerinizi güncelleyebilirsiniz.</p>
                        {activeSubs.map(sub => (
                            <div key={sub.id} style={st.paymentRow}>
                                <div>
                                    <div style={st.paymentName}>{sub.plan?.name || 'Abonelik'}</div>
                                    <div style={st.paymentPrice}>{sub.plan?.price} ₺ / {getFreqLabel(sub.plan)}</div>
                                </div>
                                <button onClick={() => handleUpdatePayment(sub.id)} style={st.btnUpdate}>
                                    💳 Kartımı Güncelle
                                </button>
                            </div>
                        ))}
                        {activeSubs.length === 0 && (
                            <p style={st.emptyText}>Aktif aboneliğiniz bulunmuyor.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SubCard({ sub, onUpdateFreq, onCancel, onUpdatePayment }) {
    const isActive = sub.status === 'ACTIVE';
    return (
        <div style={st.card}>
            <div style={st.cardHeader}>
                <div>
                    <h3 style={st.subName}>{sub.plan?.name || 'Abonelik'}</h3>
                    <span style={st.subPrice}>{sub.plan?.price} ₺ / {getFreqLabel(sub.plan)}</span>
                </div>
                <Badge status={sub.status} />
            </div>
            <div style={st.infoGrid}>
                <InfoItem label="Sonraki Ödeme" value={formatDate(sub.nextPaymentDate)} />
                <InfoItem label="Başlangıç" value={formatDate(sub.startDate)} />
                <InfoItem label="Dönem Sonu" value={formatDate(sub.currentPeriodEnd)} />
                <InfoItem label="Durum" value={isActive ? 'Aktif' : sub.status === 'CANCELLED' ? 'İptal Edildi' : sub.status} />
            </div>
            {isActive && onUpdateFreq && (
                <div style={st.actionsBox}>
                    <div style={st.freqSection}>
                        <label style={st.freqLabel}>Teslimat Sıklığı</label>
                        <select style={st.select} defaultValue={getFreqValue(sub.plan)} onChange={(e) => onUpdateFreq(sub.id, e.target.value)}>
                            <option value="1_week">Haftada bir</option>
                            <option value="2_week">2 haftada bir</option>
                            <option value="3_week">3 haftada bir</option>
                            <option value="1_month">Ayda bir</option>
                            <option value="2_month">2 ayda bir</option>
                            <option value="3_month">3 ayda bir</option>
                        </select>
                    </div>
                    <div style={st.btnRow}>
                        {onUpdatePayment && (
                            <button onClick={() => onUpdatePayment(sub.id)} style={st.btnUpdate}>💳 Kart Güncelle</button>
                        )}
                        <button onClick={() => onCancel(sub.id)} style={st.btnDanger}>İptal Et</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div style={st.infoItem}>
            <div style={st.infoLabel}>{label}</div>
            <div style={st.infoValue}>{value}</div>
        </div>
    );
}

function Badge({ status }) {
    const map = {
        ACTIVE: { bg: '#dcfce7', color: '#166534', label: 'Aktif' },
        CANCELLED: { bg: '#fee2e2', color: '#991b1b', label: 'İptal' },
        PAUSED: { bg: '#fef3c7', color: '#92400e', label: 'Durduruldu' },
    };
    const c = map[status] || { bg: '#f1f5f9', color: '#475569', label: status };
    return <span style={{ background: c.bg, color: c.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{c.label}</span>;
}

function MsgBox({ msg }) {
    const bgMap = { error: '#fef2f2', success: '#f0fdf4', info: '#eff6ff' };
    const colorMap = { error: '#dc2626', success: '#16a34a', info: '#2563eb' };
    const borderMap = { error: '#fecaca', success: '#bbf7d0', info: '#bfdbfe' };
    return (
        <div style={{ background: bgMap[msg.type], color: colorMap[msg.type], border: `1px solid ${borderMap[msg.type]}`, padding: 14, borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
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

// ---- STYLES (White/Light Theme) ----
const st = {
    page: { minHeight: '60vh', background: 'transparent', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: '#1e293b', padding: 0 },
    container: { maxWidth: 640, margin: '0 auto', padding: '20px 16px' },

    loadingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' },
    spinner: { width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

    emptyCard: { background: '#fff', borderRadius: 16, padding: '48px 32px', textAlign: 'center', border: '1px solid #e2e8f0' },
    emptyTitle: { fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#1e293b' },
    emptyDesc: { fontSize: 14, color: '#64748b', marginBottom: 24 },

    tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 12, padding: 4 },
    tab: { flex: 1, padding: '10px 0', background: 'transparent', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
    tabActive: { flex: 1, padding: '10px 0', background: '#fff', color: '#16a34a', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },

    sectionLabel: { fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

    card: { background: '#fff', borderRadius: 14, padding: 24, marginBottom: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#1e293b' },
    subName: { fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: '#1e293b' },
    subPrice: { fontSize: 13, color: '#16a34a', fontWeight: 500 },

    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
    infoItem: { padding: '10px 12px', background: '#f8fafc', borderRadius: 8 },
    infoLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 },
    infoValue: { fontSize: 14, fontWeight: 600, color: '#334155' },

    actionsBox: { background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #f1f5f9' },
    freqSection: { marginBottom: 14 },
    freqLabel: { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 },
    select: { width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#334155', fontSize: 14 },
    btnRow: { display: 'flex', gap: 10 },
    btnPrimary: { display: 'inline-block', padding: '12px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' },
    btnUpdate: { flex: 1, padding: '10px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
    btnDanger: { padding: '10px 16px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },

    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #f1f5f9' },
    td: { padding: '12px', fontSize: 14, color: '#475569', borderBottom: '1px solid #f8fafc' },
    badgeSuccess: { background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 },
    badgeFail: { background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 },

    settingsDesc: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 },
    paymentRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f8fafc', borderRadius: 10, marginBottom: 10 },
    paymentName: { fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 2 },
    paymentPrice: { fontSize: 13, color: '#16a34a' },
    emptyText: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 14 },
};

export default function CustomerPortalPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Yükleniyor...</div>}>
            <PortalContent />
        </Suspense>
    );
}
