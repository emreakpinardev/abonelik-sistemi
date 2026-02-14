'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('products'); // products, subscriptions, settings
  const [loading, setLoading] = useState(true);

  // Data States
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]); // All plans (flat list)
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [shopDomain, setShopDomain] = useState('');
  const [envStatus, setEnvStatus] = useState({});

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null); // For plan editing
  const [newPlanForm, setNewPlanForm] = useState({ interval: 'WEEKLY', intervalCount: 1, price: '' });

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      fetchProducts(),
      fetchPlans(),
      fetchSubscriptions(),
      fetchStats(),
      fetchEnv()
    ]);
    setLoading(false);
  }

  // --- API CALLS ---
  async function fetchProducts() {
    try {
      const res = await fetch('/api/shopify/products');
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (e) { console.error(e); }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      if (data.plans) setPlans(data.plans);
    } catch (e) { console.error(e); }
  }

  async function fetchSubscriptions() {
    try {
      const res = await fetch('/api/subscriptions');
      const data = await res.json();
      if (data.subscriptions) setSubscriptions(data.subscriptions);
    } catch (e) { console.error(e); }
  }

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data) setStats(data);
    } catch (e) { console.error(e); }
  }

  async function fetchEnv() {
    try {
      const res = await fetch('/api/settings/env');
      const data = await res.json();
      if (data) {
        setShopDomain(data.SHOPIFY_STORE_DOMAIN || '');
        setEnvStatus(data);
      }
    } catch (e) { console.error(e); }
  }

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      sessionStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
      loadData();
    } else {
      alert('Hatalı şifre');
    }
  };

  // --- ACTIONS ---

  async function handleCreatePlan() {
    if (!selectedProduct) return alert("Lütfen bir ürün seçin");
    if (!newPlanForm.price) return alert("Lütfen fiyat girin");

    const planName = `${intervalLabel(newPlanForm.interval, newPlanForm.intervalCount)} Abonelik`; // Auto name

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planName,
          description: newPlanForm.interval === 'WEEKLY' ? 'Haftalık yenilenir' : 'Aylık yenilenir',
          price: newPlanForm.price,
          interval: newPlanForm.interval,
          intervalCount: newPlanForm.intervalCount,
          shopifyProductId: selectedProduct.id.toString(), // String ID
          isTemplate: false,
          groupName: selectedProduct.title
        })
      });
      const data = await res.json();
      if (data.success) {
        // alert('Plan eklendi!');
        fetchPlans(); // Refresh
        setNewPlanForm({ ...newPlanForm, price: '' }); // Reset price only
      } else {
        alert('Hata: ' + (data.message || data.error));
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  }

  async function handleDeletePlan(planId) {
    if (!confirm('Planı silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`/api/plans?id=${planId}`, { method: 'DELETE' });
      fetchPlans();
    } catch (err) { alert(err.message); }
  }

  async function handleCancelSubscription(id) {
    if (!confirm('Aboneliği iptal etmek istediğinize emin misiniz?')) return;
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

  function startOAuth() {
    if (!shopDomain.trim()) { alert('Mağaza domainini girin'); return; }
    const domain = shopDomain.includes('.myshopify.com') ? shopDomain.trim() : shopDomain.trim() + '.myshopify.com';
    window.open('/api/auth?shop=' + encodeURIComponent(domain), '_blank');
  }

  // --- HELPERS ---
  function intervalLabel(interval, count) {
    const map = { WEEKLY: 'Haftada', MONTHLY: 'Ayda', QUARTERLY: '3 Ayda', YEARLY: 'Yılda' };
    const unit = map[interval] || 'Ayda';
    return `${count} ${unit} 1`; // "1 Ayda 1", "2 Haftada 1"
  }

  function statusBadge(status) {
    const map = {
      ACTIVE: { bg: '#dcfce7', color: '#166534', text: 'Aktif' },
      PENDING: { bg: '#fef3c7', color: '#92400e', text: 'Bekliyor' },
      CANCELLED: { bg: '#fee2e2', color: '#991b1b', text: 'İptal' },
    };
    const c = map[status] || { bg: '#f1f5f9', color: '#475569', text: status };
    return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{c.text}</span>;
  }

  // --- RENDER ---
  if (!isAuthenticated) {
    return (
      <div style={st.page}>
        <div style={st.loginBox}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>Yönetici Girişi</h2>
          <form onSubmit={handleLogin}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" style={st.input} autoFocus />
            <button type="submit" style={st.btnPrimary}>Giriş Yap</button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered Products
  const filteredProducts = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Selected Product's Plans
  const selectedPlans = selectedProduct ? plans.filter(p => p.shopifyProductId === selectedProduct.id.toString()) : [];

  return (
    <div style={st.page}>
      <div style={st.container}>
        {/* Header */}
        <div style={st.header}>
          <h1 style={st.title}>Abonelik Yönetimi</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://admin.shopify.com" target="_blank" style={st.btnSmall}>Shopify Admin</a>
            <button onClick={() => { sessionStorage.removeItem('admin_auth'); setIsAuthenticated(false); }} style={st.btnSmall}>Çıkış</button>
          </div>
        </div>

        {/* Stats */}
        <div style={st.statsGrid}>
          <StatCard icon="check_circle" label="Aktif" value={stats.byStatus?.ACTIVE || 0} color="#16a34a" />
          <StatCard icon="payments" label="Gelir" value={`${(stats.totalRevenue || 0).toLocaleString('tr-TR')}₺`} color="#2563eb" />
          <StatCard icon="inventory_2" label="Ürün" value={products.length} color="#6366f1" />
          <StatCard icon="layers" label="Plan" value={plans.length} color="#8b5cf6" />
        </div>

        {/* Tabs */}
        <div style={st.tabs}>
          <TabBtn active={activeTab === 'products'} icon="inventory" label="Ürünler & Planlar" onClick={() => setActiveTab('products')} />
          <TabBtn active={activeTab === 'subscriptions'} icon="people" label="Aboneler" onClick={() => setActiveTab('subscriptions')} />
          <TabBtn active={activeTab === 'settings'} icon="settings" label="Ayarlar" onClick={() => setActiveTab('settings')} />
        </div>

        {/* TAB 1: PRODUCTS & PLANS */}
        {activeTab === 'products' && (
          <div style={{ display: 'flex', gap: 20, height: '600px' }}>
            {/* LEFT: Product List */}
            <div style={{ width: '30%', ...st.card, display: 'flex', flexDirection: 'column' }}>
              <h3 style={st.cardTitle}>1. Ürün Seçin</h3>
              <input style={st.input} placeholder="Ürün Ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div style={{ flex: 1, overflowY: 'auto', marginTop: 10, paddingRight: 5 }}>
                {loading ? <p>Yükleniyor...</p> : filteredProducts.map(p => (
                  <div key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    style={{
                      ...st.productItem,
                      backgroundColor: selectedProduct?.id === p.id ? '#f0fdf4' : 'transparent',
                      borderColor: selectedProduct?.id === p.id ? '#16a34a' : '#eee'
                    }}>
                    {p.image && <img src={p.image} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Plan MAnager */}
            <div style={{ flex: 1, ...st.card, display: 'flex', flexDirection: 'column' }}>
              {!selectedProduct ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  Planları yönetmek için soldan bir ürün seçin.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 15, alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 15, marginBottom: 15 }}>
                    {selectedProduct.image && <img src={selectedProduct.image} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />}
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18 }}>{selectedProduct.title}</h2>
                      <p style={{ margin: '5px 0 0', fontSize: 13, color: '#666' }}>ID: {selectedProduct.id}</p>
                    </div>
                  </div>

                  {/* Add New Plan Form */}
                  <div style={{ background: '#f9fafb', padding: 15, borderRadius: 8, marginBottom: 20, border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Yeni Plan Ekle</h4>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <div style={{ width: 100 }}>
                        <label style={st.label}>Sıklık</label>
                        <select style={st.select} value={newPlanForm.interval} onChange={e => setNewPlanForm({ ...newPlanForm, interval: e.target.value })}>
                          <option value="WEEKLY">Haftalık</option>
                          <option value="MONTHLY">Aylık</option>
                          <option value="QUARTERLY">3 Aylık</option>
                          <option value="YEARLY">Yıllık</option>
                        </select>
                      </div>
                      <div style={{ width: 80 }}>
                        <label style={st.label}>Her</label>
                        <input type="number" min="1" style={st.input} value={newPlanForm.intervalCount} onChange={e => setNewPlanForm({ ...newPlanForm, intervalCount: e.target.value })} />
                      </div>
                      <div style={{ width: 120 }}>
                        <label style={st.label}>Fiyat (TL)</label>
                        <input type="number" style={st.input} placeholder="Fiyat" value={newPlanForm.price} onChange={e => setNewPlanForm({ ...newPlanForm, price: e.target.value })} />
                      </div>
                      <button onClick={handleCreatePlan} style={st.btnPrimary}>Ekle</button>
                    </div>
                  </div>

                  {/* Existing Plans */}
                  <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Mevcut Abonelik Seçenekleri</h4>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {selectedPlans.length === 0 ? (
                      <p style={{ color: '#999', fontSize: 13 }}>Henüz plan eklenmemiş.</p>
                    ) : (
                      <table style={st.table}>
                        <thead><tr><th style={st.th}>İsim</th><th style={st.th}>Süre</th><th style={st.th}>Fiyat</th><th style={st.th}>İşlem</th></tr></thead>
                        <tbody>
                          {selectedPlans.map(p => (
                            <tr key={p.id}>
                              <td style={st.td}>{p.name}</td>
                              <td style={st.td}>{p.intervalCount} {p.interval === 'WEEKLY' ? 'Hafta' : p.interval === 'MONTHLY' ? 'Ay' : p.interval}</td>
                              <td style={st.td}><b>{p.price} TL</b></td>
                              <td style={st.td}>
                                <button onClick={() => handleDeletePlan(p.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Sil</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIPTIONS */}
        {activeTab === 'subscriptions' && (
          <div style={st.card}>
            <h2 style={st.sectionTitle}>Abonelik Listesi</h2>
            <table style={st.table}>
              <thead><tr><th style={st.th}>Müşteri</th><th style={st.th}>Ürün/Plan</th><th style={st.th}>Durum</th><th style={st.th}>İşlem</th></tr></thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td style={st.td}>{sub.customerName}<br /><span style={{ fontSize: 11, color: '#999' }}>{sub.customerEmail}</span></td>
                    <td style={st.td}>{sub.plan?.name || '-'}<br /><span style={{ fontSize: 11, color: '#666' }}>{sub.shopifyProductId}</span></td>
                    <td style={st.td}>{statusBadge(sub.status)}</td>
                    <td style={st.td}>
                      {sub.status === 'ACTIVE' && <button onClick={() => handleCancelSubscription(sub.id)} style={{ color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}>İptal</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={st.card}>
            <h3>Ayarlar</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={shopDomain} onChange={e => setShopDomain(e.target.value)} placeholder="magaza.myshopify.com" style={st.input} />
              <button onClick={startOAuth} style={st.btnPrimary}>Shopify Bağlan</button>
            </div>
            <p style={{ fontSize: 13, color: '#666', marginTop: 10 }}>Widget kurulumu artık otomatik yapılmıyor. Tema entegrasyonu manuel yapıldı.</p>
          </div>
        )}

      </div>
    </div>
  );
}

// Sub Components & Styles
function TabBtn({ active, icon, label, onClick }) {
  return <button onClick={onClick} style={active ? st.tabActive : st.tab}><span className="material-icons-outlined" style={{ fontSize: 18, marginRight: 6 }}>{icon}</span>{label}</button>;
}
function StatCard({ icon, label, value, color }) {
  return <div style={{ ...st.statCard, borderTop: `4px solid ${color}` }}><span className="material-icons-outlined" style={{ fontSize: 24, color }}>{icon}</span><div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div><div style={{ fontSize: 12, color: '#999' }}>{label}</div></div>;
}

const st = {
  page: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'sans-serif', color: '#333' },
  container: { maxWidth: 1200, margin: '0 auto', padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  loginBox: { maxWidth: 350, margin: '100px auto', background: '#fff', padding: 30, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center' },
  card: { background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 20, border: '1px solid #eee' },
  input: { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 0, boxSizing: 'border-box', height: 40 },
  select: { padding: 0, paddingLeft: 10, border: '1px solid #ddd', borderRadius: 6, height: 40, width: '100%' },
  btnPrimary: { background: '#16a34a', color: '#fff', border: 'none', padding: '0 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, height: 40 },
  btnSmall: { background: '#fff', border: '1px solid #ddd', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 },
  tabs: { display: 'flex', gap: 5, marginBottom: 20, background: '#e5e7eb', padding: 4, borderRadius: 8 },
  tab: { flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabActive: { flex: 1, padding: '10px', border: 'none', background: '#fff', cursor: 'pointer', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 20 },
  statCard: { background: '#fff', padding: 15, borderRadius: 8, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 10px', fontSize: 15, fontWeight: 600, borderBottom: '1px solid #eee', paddingBottom: 10 },
  productItem: { display: 'flex', gap: 10, padding: 10, borderBottom: '1px solid #eee', alignItems: 'center', cursor: 'pointer', borderLeft: '3px solid transparent' },
  label: { display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: 10, background: '#f5f5f5', borderBottom: '1px solid #ddd' },
  td: { padding: 10, borderBottom: '1px solid #eee' },
};
