'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [shopDomain, setShopDomain] = useState('');
  const [envStatus, setEnvStatus] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '', description: '', price: '', interval: 'MONTHLY',
    intervalCount: 1, shopifyProductId: '', shopifyVariantId: '',
  });

  useEffect(() => {
    // Shopify Admin iframe kontrolü (Cookie engeline takılmamak için)
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    const host = params.get('host');

    if (shop || host) {
      setIsAuthenticated(true);
      // Session storage denemesi (calisirsa guzel, calismazsa sorun degil)
      try { sessionStorage.setItem('admin_auth', 'true'); } catch (e) { }
      return;
    }

    // Normal tarayici girisi
    const saved = sessionStorage.getItem('admin_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPlans();
    fetchSubscriptions();
    fetchEnvStatus();
  }, [isAuthenticated, filter]);

  async function handleLogin(e) {
    e.preventDefault();
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
    } catch {
      setAuthError('Bağlantı hatası');
    }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error('Plan yükleme hatası:', err);
    }
  }

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions?status=${filter}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setStats(data.stats || {});
    } catch (err) {
      console.error('Veri yükleme hatası:', err);
    }
    setLoading(false);
  }

  async function fetchEnvStatus() {
    try {
      const res = await fetch('/api/settings/status');
      if (res.ok) setEnvStatus(await res.json());
    } catch { }
  }

  function startOAuth() {
    if (!shopDomain.trim()) { alert('Mağaza domainini girin'); return; }
    const domain = shopDomain.includes('.myshopify.com') ? shopDomain.trim() : shopDomain.trim() + '.myshopify.com';
    window.open('/api/auth?shop=' + encodeURIComponent(domain), '_blank');
  }

  function openPlanForm(plan = null) {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name, description: plan.description || '', price: plan.price.toString(),
        interval: plan.interval, intervalCount: plan.intervalCount || 1,
        shopifyProductId: plan.shopifyProductId || '', shopifyVariantId: plan.shopifyVariantId || '',
      });
    } else {
      setEditingPlan(null);
      setPlanForm({ name: '', description: '', price: '', interval: 'MONTHLY', intervalCount: 1, shopifyProductId: '', shopifyVariantId: '' });
    }
    setShowPlanForm(true);
  }

  async function handleSavePlan(e) {
    e.preventDefault();
    try {
      if (editingPlan) {
        const res = await fetch('/api/plans', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPlan.id, ...planForm }),
        });
        const data = await res.json();
        if (!data.success) { alert(data.error); return; }
      } else {
        const res = await fetch('/api/subscription/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planForm),
        });
        const data = await res.json();
        if (!data.success) { alert(data.error); return; }
      }
      setShowPlanForm(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  }

  async function handleDeletePlan(plan) {
    if (!confirm(`"${plan.name}" planını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/plans?id=${plan.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (data.deactivated) alert(data.message);
        fetchPlans();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
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
      if (data.success) fetchSubscriptions();
      else alert(data.error || 'İptal başarısız');
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  }

  function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function intervalLabel(interval, count) {
    const map = { WEEKLY: 'Hafta', MONTHLY: 'Ay', QUARTERLY: '3 Ay', YEARLY: 'Yıl' };
    const unit = map[interval] || 'Ay';
    if (count && count > 1 && (interval === 'WEEKLY' || interval === 'MONTHLY')) return `${count} ${unit}`;
    return unit;
  }
  function statusBadge(status) {
    const map = {
      ACTIVE: { bg: '#dcfce7', color: '#166534', text: 'Aktif' },
      PENDING: { bg: '#fef3c7', color: '#92400e', text: 'Bekliyor' },
      CANCELLED: { bg: '#fee2e2', color: '#991b1b', text: 'İptal' },
      PAYMENT_FAILED: { bg: '#fee2e2', color: '#991b1b', text: 'Ödeme Hatası' },
      PAUSED: { bg: '#fef3c7', color: '#92400e', text: 'Duraklatıldı' },
    };
    const c = map[status] || { bg: '#f1f5f9', color: '#475569', text: status };
    return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{c.text}</span>;
  }

  // ===== LOGIN =====
  if (!isAuthenticated) {
    return (
      <div style={st.page}>
        <div style={st.loginBox}>
          <span className="material-icons-outlined" style={{ fontSize: 40, color: '#16a34a', marginBottom: 12 }}>admin_panel_settings</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Abonelik Yönetimi</h2>
          <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 20 }}>Devam etmek için şifrenizi girin</p>
          <form onSubmit={handleLogin}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifre" style={st.input} autoFocus />
            {authError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{authError}</p>}
            <button type="submit" style={st.btnPrimary}>Giriş Yap</button>
          </form>
        </div>
      </div>
    );
  }

  // ===== DASHBOARD =====
  return (
    <div style={st.page}>
      <div style={st.container}>
        {/* Header */}
        <div style={st.header}>
          <div>
            <h1 style={st.title}>
              <span className="material-icons-outlined" style={{ fontSize: 28, verticalAlign: 'middle', marginRight: 8, color: '#16a34a' }}>dashboard</span>
              Abonelik Yönetimi
            </h1>
            <p style={st.subtitle}>iyzico + Shopify abonelik sistemi</p>
          </div>
          <button onClick={() => { sessionStorage.removeItem('admin_auth'); setIsAuthenticated(false); }}
            style={{ ...st.btnSmall, background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
            <span className="material-icons-outlined" style={{ fontSize: 16, marginRight: 4 }}>logout</span>
            Çıkış
          </button>
        </div>

        {/* Stats */}
        <div style={st.statsGrid}>
          <StatCard icon="check_circle" label="Aktif" value={stats.byStatus?.ACTIVE || 0} color="#16a34a" />
          <StatCard icon="pending" label="Bekleyen" value={stats.byStatus?.PENDING || 0} color="#f59e0b" />
          <StatCard icon="cancel" label="İptal" value={stats.byStatus?.CANCELLED || 0} color="#ef4444" />
          <StatCard icon="payments" label="Toplam Gelir" value={`${(stats.totalRevenue || 0).toLocaleString('tr-TR')}₺`} color="#2563eb" />
        </div>

        {/* Tabs */}
        <div style={st.tabs}>
          <TabBtn active={activeTab === 'plans'} icon="inventory_2" label="Planlar" onClick={() => setActiveTab('plans')} />
          <TabBtn active={activeTab === 'subscriptions'} icon="people" label="Abonelikler" onClick={() => setActiveTab('subscriptions')} />
          <TabBtn active={activeTab === 'settings'} icon="settings" label="Ayarlar" onClick={() => setActiveTab('settings')} />
        </div>

        {/* ===== PLANS TAB ===== */}
        {activeTab === 'plans' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={st.sectionTitle}>Abonelik Planları</h2>
              <button onClick={() => openPlanForm()} style={st.btnPrimary}>
                <span className="material-icons-outlined" style={{ fontSize: 18, marginRight: 4, verticalAlign: 'middle' }}>add</span>
                Yeni Plan
              </button>
            </div>

            {/* Plan Form */}
            {showPlanForm && (
              <div style={st.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                    {editingPlan ? 'Planı Düzenle' : 'Yeni Plan Oluştur'}
                  </h3>
                  <button onClick={() => setShowPlanForm(false)} style={{ ...st.btnSmall, background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
                <form onSubmit={handleSavePlan}>
                  <div style={st.formRow}>
                    <div style={st.formGroup}>
                      <label style={st.label}>Plan Adı *</label>
                      <input type="text" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                        placeholder="Haftalık Teslimat" required style={st.input} />
                    </div>
                    <div style={st.formGroup}>
                      <label style={st.label}>Fiyat (₺) *</label>
                      <input type="number" step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                        placeholder="199.00" required style={st.input} />
                    </div>
                  </div>
                  <div style={st.formGroup}>
                    <label style={st.label}>Açıklama</label>
                    <input type="text" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                      placeholder="Her hafta kapınıza taze ürünler" style={st.input} />
                  </div>
                  <div style={st.formRow}>
                    <div style={st.formGroup}>
                      <label style={st.label}>Teslimat Sıklığı</label>
                      <select value={planForm.interval} onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })} style={st.select}>
                        <option value="WEEKLY">Haftalık</option>
                        <option value="MONTHLY">Aylık</option>
                        <option value="QUARTERLY">3 Aylık</option>
                        <option value="YEARLY">Yıllık</option>
                      </select>
                    </div>
                    <div style={st.formGroup}>
                      <label style={st.label}>Her Kaç Dönemde Bir</label>
                      <input type="number" min="1" max="12" value={planForm.intervalCount}
                        onChange={(e) => setPlanForm({ ...planForm, intervalCount: parseInt(e.target.value) || 1 })}
                        style={st.input} />
                    </div>
                  </div>
                  <div style={st.formRow}>
                    <div style={st.formGroup}>
                      <label style={st.label}>Shopify Product ID</label>
                      <input type="text" value={planForm.shopifyProductId} onChange={(e) => setPlanForm({ ...planForm, shopifyProductId: e.target.value })}
                        placeholder="Ürünle eşleştirin" style={st.input} />
                    </div>
                    <div style={st.formGroup}>
                      <label style={st.label}>Shopify Variant ID</label>
                      <input type="text" value={planForm.shopifyVariantId} onChange={(e) => setPlanForm({ ...planForm, shopifyVariantId: e.target.value })}
                        placeholder="Varyant ID" style={st.input} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="submit" style={st.btnPrimary}>
                      <span className="material-icons-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>save</span>
                      {editingPlan ? 'Güncelle' : 'Oluştur'}
                    </button>
                    <button type="button" onClick={() => setShowPlanForm(false)}
                      style={{ ...st.btnSmall, background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', padding: '10px 20px' }}>İptal</button>
                  </div>
                </form>
              </div>
            )}

            {/* Plans List */}
            {plans.length === 0 ? (
              <div style={{ ...st.card, textAlign: 'center', padding: 48 }}>
                <span className="material-icons-outlined" style={{ fontSize: 48, color: '#e5e7eb', display: 'block', marginBottom: 12 }}>inventory_2</span>
                <p style={{ color: '#9ca3af', fontSize: 14 }}>Henüz plan oluşturulmamış</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {plans.map(plan => (
                  <div key={plan.id} style={st.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span className="material-icons-outlined" style={{ fontSize: 22, color: '#16a34a' }}>local_offer</span>
                          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{plan.name}</h3>
                        </div>
                        {plan.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>{plan.description}</p>}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <InfoChip icon="payments" text={`${plan.price.toLocaleString('tr-TR')} ₺`} />
                          <InfoChip icon="schedule" text={`Her ${intervalLabel(plan.interval, plan.intervalCount)}`} />
                          {plan.shopifyProductId && <InfoChip icon="store" text={`Product: ${plan.shopifyProductId}`} />}
                          {plan.shopifyVariantId && <InfoChip icon="inventory" text={`Variant: ${plan.shopifyVariantId}`} />}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openPlanForm(plan)} style={st.iconBtn} title="Düzenle">
                          <span className="material-icons-outlined" style={{ fontSize: 18, color: '#2563eb' }}>edit</span>
                        </button>
                        <button onClick={() => handleDeletePlan(plan)} style={st.iconBtn} title="Sil">
                          <span className="material-icons-outlined" style={{ fontSize: 18, color: '#dc2626' }}>delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== SUBSCRIPTIONS TAB ===== */}
        {activeTab === 'subscriptions' && (
          <>
            <h2 style={st.sectionTitle}>Abonelikler</h2>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {['ALL', 'ACTIVE', 'PENDING', 'CANCELLED', 'PAYMENT_FAILED'].map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  style={filter === s ? st.filterActive : st.filterBtn}>
                  {s === 'ALL' ? 'Tümü' : s === 'ACTIVE' ? 'Aktif' : s === 'PENDING' ? 'Bekleyen' : s === 'CANCELLED' ? 'İptal' : 'Ödeme Hatası'}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <span className="material-icons-outlined" style={{ fontSize: 36, color: '#16a34a', animation: 'spin 1s linear infinite' }}>autorenew</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : subscriptions.length === 0 ? (
              <div style={{ ...st.card, textAlign: 'center', padding: 48 }}>
                <span className="material-icons-outlined" style={{ fontSize: 48, color: '#e5e7eb' }}>people</span>
                <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 12 }}>Abonelik bulunamadı</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={st.table}>
                  <thead>
                    <tr>
                      <th style={st.th}>Müşteri</th>
                      <th style={st.th}>Plan</th>
                      <th style={st.th}>Durum</th>
                      <th style={st.th}>Başlangıç</th>
                      <th style={st.th}>Sonraki Ödeme</th>
                      <th style={st.th}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map(sub => (
                      <tr key={sub.id}>
                        <td style={st.td}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{sub.customerName}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{sub.customerEmail}</div>
                        </td>
                        <td style={st.td}>
                          <div style={{ fontSize: 14 }}>{sub.plan?.name || '-'}</div>
                          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>{sub.plan?.price?.toLocaleString('tr-TR')}₺</div>
                        </td>
                        <td style={st.td}>{statusBadge(sub.status)}</td>
                        <td style={st.td}>{fmtDate(sub.startDate)}</td>
                        <td style={st.td}>{fmtDate(sub.nextPaymentDate)}</td>
                        <td style={st.td}>
                          {sub.status === 'ACTIVE' && (
                            <button onClick={() => handleCancelSubscription(sub.id)}
                              style={{ ...st.btnSmall, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
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

        {/* ===== SETTINGS TAB ===== */}
        {activeTab === 'settings' && (
          <>
            <h2 style={st.sectionTitle}>Sistem Ayarları</h2>

            {/* Shopify Connection */}
            <div style={st.card}>
              <h3 style={st.cardTitle}>
                <span className="material-icons-outlined" style={{ fontSize: 20, color: '#16a34a', marginRight: 6, verticalAlign: 'middle' }}>store</span>
                Shopify Bağlantısı
              </h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <input type="text" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="magaza-adi.myshopify.com" style={{ ...st.input, flex: 1, marginBottom: 0 }} />
                <button onClick={startOAuth} style={st.btnPrimary}>Bağlan</button>
              </div>
              {envStatus && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <StatusRow label="Mağaza" value={envStatus.shopDomain} ok={envStatus.hasShopDomain} />
                  <StatusRow label="Access Token" value={envStatus.hasAccessToken ? `Tanımlı (***${envStatus.tokenLast4})` : 'Tanımlanmamış'} ok={envStatus.hasAccessToken} />
                  <StatusRow label="API Bağlantısı" value={envStatus.apiConnected ? 'Başarılı' : 'Yok'} ok={envStatus.apiConnected} />
                </div>
              )}
            </div>

            {/* iyzico */}
            <div style={st.card}>
              <h3 style={st.cardTitle}>
                <span className="material-icons-outlined" style={{ fontSize: 20, color: '#2563eb', marginRight: 6, verticalAlign: 'middle' }}>credit_card</span>
                iyzico Ödeme
              </h3>
              {envStatus && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <StatusRow label="API Key" value={envStatus.hasIyzicoKey ? 'Tanımlı' : 'Eksik'} ok={envStatus.hasIyzicoKey} />
                  <StatusRow label="Secret Key" value={envStatus.hasIyzicoSecret ? 'Tanımlı' : 'Eksik'} ok={envStatus.hasIyzicoSecret} />
                  <StatusRow label="Ortam" value={envStatus.iyzicoEnv} ok={envStatus.iyzicoEnv === 'LIVE'} />
                </div>
              )}
            </div>

            {/* System */}
            <div style={st.card}>
              <h3 style={st.cardTitle}>
                <span className="material-icons-outlined" style={{ fontSize: 20, color: '#6b7280', marginRight: 6, verticalAlign: 'middle' }}>dns</span>
                Sistem
              </h3>
              {envStatus && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <StatusRow label="Uygulama URL" value={envStatus.appUrl || '-'} ok={!!envStatus.appUrl} />
                  <StatusRow label="Veritabanı" value={envStatus.dbConnected ? 'Bağlı' : 'Yok'} ok={envStatus.dbConnected} />
                  <StatusRow label="Cron Secret" value={envStatus.hasCronSecret ? 'Tanımlı' : 'Eksik'} ok={envStatus.hasCronSecret} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== SUB COMPONENTS =====
function TabBtn({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} style={active ? st.tabActive : st.tab}>
      <span className="material-icons-outlined" style={{ fontSize: 18, marginRight: 6, verticalAlign: 'middle' }}>{icon}</span>
      {label}
    </button>
  );
}
function StatCard({ icon, label, value, color }) {
  return (
    <div style={st.statCard}>
      <span className="material-icons-outlined" style={{ fontSize: 28, color, display: 'block', marginBottom: 6 }}>{icon}</span>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{label}</div>
    </div>
  );
}
function InfoChip({ icon, text }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '4px 10px', borderRadius: 6, border: '1px solid #f3f4f6' }}>
      <span className="material-icons-outlined" style={{ fontSize: 14 }}>{icon}</span>
      {text}
    </span>
  );
}
function StatusRow({ label, value, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#16a34a' : '#ef4444', flexShrink: 0 }}></span>
      <div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{value || '-'}</div>
      </div>
    </div>
  );
}

// ===== STYLES =====
const st = {
  page: { minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: '#1e293b' },
  container: { maxWidth: 900, margin: '0 auto', padding: '24px 20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center' },
  subtitle: { fontSize: 13, color: '#9ca3af', margin: 0 },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#1e293b' },

  loginBox: { maxWidth: 380, margin: '80px auto', textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },

  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#fff', borderRadius: 10, padding: 4, border: '1px solid #e5e7eb' },
  tab: { flex: 1, padding: '10px 16px', background: 'transparent', color: '#9ca3af', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabActive: { flex: 1, padding: '10px 16px', background: '#f9fafb', color: '#16a34a', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },

  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  cardTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 14px', color: '#1e293b', display: 'flex', alignItems: 'center' },

  formRow: { display: 'flex', gap: 12 },
  formGroup: { flex: 1, marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', marginBottom: 0 },
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#1e293b', cursor: 'pointer', background: '#fff' },

  btnPrimary: { padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' },
  btnSmall: { padding: '6px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' },
  iconBtn: { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' },

  filterBtn: { padding: '6px 14px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  filterActive: { padding: '6px 14px', background: '#16a34a', color: '#fff', border: '1px solid #16a34a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' },
  th: { textAlign: 'left', padding: '10px 14px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #f3f4f6', fontWeight: 600, background: '#f9fafb' },
  td: { padding: '12px 14px', fontSize: 14, color: '#374151', borderBottom: '1px solid #f9fafb' },
};
