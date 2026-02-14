'use client';

import { useState } from 'react';

export default function CustomerPortalPage() {
    const [email, setEmail] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    async function handleLogin(e) {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        setMsg(null);

        try {
            const res = await fetch(`/api/subscription/status?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (data.subscriptions && data.subscriptions.length > 0) {
                setSubscriptions(data.subscriptions);
                setIsLoggedIn(true);
            } else {
                setMsg({ type: 'error', text: 'Bu e-posta adresine ait abonelik bulunamadi.' });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Baglanti hatasi: ' + err.message });
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
                alert('Siklik guncellendi!');
                handleLogin({ preventDefault: () => { } }); // Refresh
            } else {
                alert('Hata: ' + data.error);
            }
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    }

    async function handleCancel(subId) {
        if (!confirm('Aboneliginizi iptal etmek istediginize emin misiniz?')) return;
        try {
            const res = await fetch('/api/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: subId }),
            });
            const data = await res.json();
            if (data.success) {
                alert('Abonelik iptal edildi.');
                handleLogin({ preventDefault: () => { } });
            } else {
                alert('Hata: ' + data.error);
            }
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Müşteri Paneli</h1>
                <p style={styles.subtitle}>Aboneliklerinizi yönetin</p>
            </div>

            {msg && (
                <div style={{ ...styles.msg, background: msg.type === 'error' ? '#fee2e2' : '#dcfce7', color: msg.type === 'error' ? '#991b1b' : '#166534' }}>
                    {msg.text}
                </div>
            )}

            {!isLoggedIn ? (
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Giriş Yapın</h3>
                    <p style={styles.desc}>Abonelik oluştururken kullandığınız e-posta adresini girin.</p>
                    <form onSubmit={handleLogin} style={styles.form}>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ornek@email.com"
                            style={styles.input}
                            required
                        />
                        <button type="submit" style={styles.btn} disabled={loading}>
                            {loading ? 'Yükleniyor...' : 'Aboneliklerimi Gör'}
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    {subscriptions.map(sub => (
                        <div key={sub.id} style={styles.card}>
                            <div style={styles.subHeader}>
                                <h3 style={styles.subTitle}>{sub.plan?.name || 'Abonelik'}</h3>
                                <Badge status={sub.status} />
                            </div>

                            <div style={styles.grid}>
                                <Item label="Fiyat" value={`${sub.plan?.price} TL`} />
                                <Item label="Sonraki Ödeme" value={formatDate(sub.nextPaymentDate)} />
                                <Item label="Başlangıç" value={formatDate(sub.startDate)} />
                                <Item label="Dönem Sonu" value={formatDate(sub.currentPeriodEnd)} />
                            </div>

                            {sub.status === 'ACTIVE' && (
                                <div style={styles.actionRow}>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.label}>Teslimat Sıklığı:</label>
                                        <select
                                            style={styles.select}
                                            defaultValue={getFreqValue(sub.plan)}
                                            onChange={(e) => handleUpdateFreq(sub.id, e.target.value)}
                                        >
                                            <option value="1_week">Haftada bir</option>
                                            <option value="2_week">2 haftada bir</option>
                                            <option value="3_week">3 haftada bir</option>
                                            <option value="1_month">Ayda bir</option>
                                            <option value="2_month">2 ayda bir</option>
                                            <option value="3_month">3 ayda bir</option>
                                        </select>
                                    </div>
                                    <button onClick={() => handleCancel(sub.id)} style={styles.btnDanger}>
                                        İptal Et
                                    </button>
                                </div>
                            )}

                            {sub.payments && sub.payments.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <h4 style={{ fontSize: 14, marginBottom: 8 }}>Ödeme Geçmişi</h4>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr>
                                                <th style={styles.th}>Tarih</th>
                                                <th style={styles.th}>Tutar</th>
                                                <th style={styles.th}>Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sub.payments.map(p => (
                                                <tr key={p.id}>
                                                    <td style={styles.td}>{formatDate(p.createdAt)}</td>
                                                    <td style={styles.td}>{p.amount} TL</td>
                                                    <td style={styles.td}>
                                                        {p.status === 'SUCCESS' ? '✅ Başarılı' : '❌ Başarısız'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                    <button onClick={() => setIsLoggedIn(false)} style={styles.btnSec}>Çıkış Yap</button>
                </>
            )}
        </div>
    );
}

function Item({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
            <div style={{ fontWeight: 500 }}>{value}</div>
        </div>
    );
}

function Badge({ status }) {
    const colors = {
        ACTIVE: { bg: '#dcfce7', text: '#166534', label: 'Aktif' },
        CANCELLED: { bg: '#fee2e2', text: '#991b1b', label: 'İptal' },
        PAUSED: { bg: '#ffedd5', text: '#9a3412', label: 'Durduruldu' },
    };
    const c = colors[status] || { bg: '#f3f4f6', text: '#374151', label: status };
    return (
        <span style={{
            background: c.bg, color: c.text, padding: '4px 10px',
            borderRadius: 20, fontSize: 12, fontWeight: 600
        }}>
            {c.label}
        </span>
    );
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('tr-TR');
}

function getFreqValue(plan) {
    if (!plan) return '1_month';
    if (plan.interval === 'WEEKLY') return plan.intervalCount + '_week';
    if (plan.interval === 'QUARTERLY') return '3_month';
    if (plan.interval === 'YEARLY') return '12_month';
    return plan.intervalCount + '_month';
}

const styles = {
    container: { maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui' },
    header: { marginBottom: 30, textAlign: 'center' },
    title: { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: '#111' },
    subtitle: { color: '#666' },
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    cardTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
    desc: { fontSize: 14, color: '#666', marginBottom: 20 },
    form: { display: 'flex', gap: 10 },
    input: { flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 6 },
    btn: { padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' },
    btnDanger: { padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
    btnSec: { padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 10 },
    subHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f3f4f6', paddingBottom: 12 },
    subTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
    actionRow: { display: 'flex', alignItems: 'flex-end', gap: 12, background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 20 },
    label: { display: 'block', fontSize: 12, color: '#666', marginBottom: 4 },
    select: { width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #d1d5db' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { textAlign: 'left', padding: '8px', borderBottom: '2px solid #e5e7eb', color: '#666' },
    td: { padding: '8px', borderBottom: '1px solid #f3f4f6' },
    msg: { padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 14, fontWeight: 500 },
};
