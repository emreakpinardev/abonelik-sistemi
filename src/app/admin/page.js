'use client';

import { useState, useEffect } from 'react';

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [activeTab, setActiveTab] = useState('subscriptions');
    const [subscriptions, setSubscriptions] = useState([]);
    const [stats, setStats] = useState({});
    const [filter, setFilter] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [showPlanForm, setShowPlanForm] = useState(false);
    const [plans, setPlans] = useState([]);
    const [planForm, setPlanForm] = useState({
        name: '',
        description: '',
        price: '',
        interval: 'MONTHLY',
        intervalCount: 1,
        shopifyProductId: '',
        shopifyVariantId: '',
    });

    // Oturum kontrolu
    useEffect(() => {
        const saved = sessionStorage.getItem('admin_auth');
        if (saved === 'true') setIsAuthenticated(true);
    }, []);

    async function handleLogin(e) {
        e.preventDefault();
        setAuthError('');
        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (data.success) {
                setIsAuthenticated(true);
                sessionStorage.setItem('admin_auth', 'true');
            } else {
                setAuthError('Şifre yanlış');
            }
        } catch (err) {
            setAuthError('Bağlantı hatası');
        }
    }

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchData();
        fetchPlans();
    }, [filter, isAuthenticated]);

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/subscriptions?status=${filter}`);
            const data = await res.json();
            setSubscriptions(data.subscriptions || []);
            setStats(data.stats || {});
        } catch (err) {
            console.error('Veri yükleme hatası:', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchPlans() {
        try {
            const res = await fetch('/api/subscription/create');
            const data = await res.json();
            setPlans(data.plans || []);
        } catch (err) {
            console.error('Plan yükleme hatası:', err);
        }
    }

    async function handleCancelSubscription(id) {
        if (!confirm('Bu aboneliği iptal etmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetch('/api/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: id }),
            });
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                alert(data.error || 'İptal başarısız');
            }
        } catch (err) {
            alert('İptal hatası: ' + err.message);
        }
    }

    async function handleCreatePlan(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/subscription/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(planForm),
            });
            const data = await res.json();
            if (data.success) {
                setShowPlanForm(false);
                setPlanForm({
                    name: '', description: '', price: '', interval: 'MONTHLY',
                    intervalCount: 1, shopifyProductId: '', shopifyVariantId: '',
                });
                fetchPlans();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert('Plan oluşturma hatası: ' + err.message);
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    }

    function getStatusBadge(status) {
        const map = {
            ACTIVE: { class: 'badge-active', text: 'Aktif' },
            PENDING: { class: 'badge-pending', text: 'Bekliyor' },
            CANCELLED: { class: 'badge-cancelled', text: 'İptal' },
            PAYMENT_FAILED: { class: 'badge-failed', text: 'Ödeme Hatası' },
            PAUSED: { class: 'badge-pending', text: 'Duraklatıldı' },
            EXPIRED: { class: 'badge-cancelled', text: 'Sona Erdi' },
        };
        const info = map[status] || { class: 'badge-pending', text: status };
        return <span className={`badge ${info.class}`}>{info.text}</span>;
    }

    return (
        <div className="page">
            <div className="container">
                {!isAuthenticated ? (
                    <div style={{ maxWidth: 380, margin: '80px auto', textAlign: 'center' }}>
                        <div className="card" style={{ padding: 32 }}>
                            <h2 style={{ marginBottom: 8 }}>🔒 Admin Girişi</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>Devam etmek için şifrenizi girin</p>
                            <form onSubmit={handleLogin}>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Şifre"
                                    style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 16, outline: 'none' }}
                                    autoFocus
                                />
                                {authError && <p style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{authError}</p>}
                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Giriş Yap</button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="page-header">
                            <h1>⚙️ Abonelik Yönetimi</h1>
                            <p>iyzico + Shopify abonelik sistemi admin paneli</p>
                        </div>

                        {/* İstatistikler */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-value">{stats.byStatus?.ACTIVE || 0}</div>
                                <div className="stat-label">Aktif Abonelik</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{stats.byStatus?.PENDING || 0}</div>
                                <div className="stat-label">Bekleyen</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{stats.byStatus?.CANCELLED || 0}</div>
                                <div className="stat-label">İptal Edilen</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">
                                    {(stats.totalRevenue || 0).toLocaleString('tr-TR')}₺
                                </div>
                                <div className="stat-label">Toplam Gelir</div>
                            </div>
                        </div>

                        {/* Sekmeler */}
                        <div className="filter-bar">
                            <button
                                className={`filter-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
                                onClick={() => setActiveTab('subscriptions')}
                            >
                                📋 Abonelikler
                            </button>
                            <button
                                className={`filter-btn ${activeTab === 'plans' ? 'active' : ''}`}
                                onClick={() => setActiveTab('plans')}
                            >
                                📦 Planlar
                            </button>
                        </div>

                        {/* Abonelikler Tab */}
                        {activeTab === 'subscriptions' && (
                            <>
                                {/* Filtreler */}
                                <div className="filter-bar">
                                    {['ALL', 'ACTIVE', 'PENDING', 'CANCELLED', 'PAYMENT_FAILED'].map((s) => (
                                        <button
                                            key={s}
                                            className={`filter-btn ${filter === s ? 'active' : ''}`}
                                            onClick={() => setFilter(s)}
                                        >
                                            {s === 'ALL' ? 'Tümü' : s === 'ACTIVE' ? 'Aktif' : s === 'PENDING' ? 'Bekleyen' : s === 'CANCELLED' ? 'İptal' : 'Ödeme Hatası'}
                                        </button>
                                    ))}
                                </div>

                                {loading ? (
                                    <div className="loading"><div className="spinner"></div></div>
                                ) : subscriptions.length === 0 ? (
                                    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>Henüz abonelik bulunmuyor</p>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Müşteri</th>
                                                    <th>Plan</th>
                                                    <th>Durum</th>
                                                    <th>Başlangıç</th>
                                                    <th>Sonraki Ödeme</th>
                                                    <th>İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subscriptions.map((sub) => (
                                                    <tr key={sub.id}>
                                                        <td>
                                                            <div>
                                                                <strong>{sub.customerName}</strong>
                                                                <br />
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                                    {sub.customerEmail}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span>{sub.plan?.name}</span>
                                                            <br />
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                                {sub.plan?.price?.toLocaleString('tr-TR')}₺
                                                            </span>
                                                        </td>
                                                        <td>{getStatusBadge(sub.status)}</td>
                                                        <td>{formatDate(sub.startDate)}</td>
                                                        <td>{formatDate(sub.nextPaymentDate)}</td>
                                                        <td>
                                                            {sub.status === 'ACTIVE' && (
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => handleCancelSubscription(sub.id)}
                                                                >
                                                                    İptal
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Planlar Tab */}
                        {activeTab === 'plans' && (
                            <>
                                <div style={{ marginBottom: 24 }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowPlanForm(!showPlanForm)}
                                    >
                                        {showPlanForm ? '✕ Kapat' : '+ Yeni Plan Ekle'}
                                    </button>
                                </div>

                                {showPlanForm && (
                                    <div className="card" style={{ marginBottom: 24 }}>
                                        <div className="card-header">
                                            <h3>Yeni Abonelik Planı</h3>
                                        </div>
                                        <form onSubmit={handleCreatePlan}>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label>Plan Adı *</label>
                                                    <input
                                                        type="text"
                                                        value={planForm.name}
                                                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                                                        placeholder="Aylık Premium"
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Fiyat (₺) *</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={planForm.price}
                                                        onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                                                        placeholder="299.00"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label>Açıklama</label>
                                                <input
                                                    type="text"
                                                    value={planForm.description}
                                                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                                                    placeholder="Her ay otomatik teslimat"
                                                />
                                            </div>

                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label>Ödeme Periyodu</label>
                                                    <select
                                                        value={planForm.interval}
                                                        onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}
                                                    >
                                                        <option value="MINUTELY">Dakikalik</option>
                                                        <option value="WEEKLY">Haftalık</option>
                                                        <option value="MONTHLY">Aylık</option>
                                                        <option value="QUARTERLY">3 Aylık</option>
                                                        <option value="YEARLY">Yıllık</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>Shopify Variant ID</label>
                                                    <input
                                                        type="text"
                                                        value={planForm.shopifyVariantId}
                                                        onChange={(e) => setPlanForm({ ...planForm, shopifyVariantId: e.target.value })}
                                                        placeholder="Shopify ürün varyant ID"
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label>Shopify Product ID</label>
                                                <input
                                                    type="text"
                                                    value={planForm.shopifyProductId}
                                                    onChange={(e) => setPlanForm({ ...planForm, shopifyProductId: e.target.value })}
                                                    placeholder="Shopify ürün ID (opsiyonel)"
                                                />
                                            </div>

                                            <button type="submit" className="btn btn-primary">
                                                ✓ Planı Oluştur
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {/* Mevcut Planlar */}
                                {plans.length === 0 ? (
                                    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>
                                            Henüz plan oluşturulmamış. Yukarıdan yeni plan ekleyin.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="plans-grid">
                                        {plans.map((plan) => (
                                            <div key={plan.id} className="plan-card">
                                                <div className="plan-name">{plan.name}</div>
                                                {plan.description && (
                                                    <div className="plan-desc">{plan.description}</div>
                                                )}
                                                <div className="plan-price">
                                                    {plan.price.toLocaleString('tr-TR')}₺
                                                    <span>
                                                        /{plan.interval === 'MONTHLY' ? 'ay' :
                                                            plan.interval === 'QUARTERLY' ? '3 ay' :
                                                                plan.interval === 'YEARLY' ? 'yıl' :
                                                                    plan.interval === 'WEEKLY' ? 'hafta' :
                                                                        plan.interval === 'MINUTELY' ? 'dakika' : 'ay'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                                    {plan.shopifyVariantId ? `Variant: ${plan.shopifyVariantId}` : 'Shopify bağlanmamış'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
