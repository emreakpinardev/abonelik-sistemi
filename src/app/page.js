'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('templates'); // templates, assignments, subscriptions, settings
  const [loading, setLoading] = useState(true);

  // Data States
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]); // All plans
  const [templates, setTemplates] = useState([]); // Template plans
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [shopDomain, setShopDomain] = useState('');
  const [envStatus, setEnvStatus] = useState({});
  const [oauthBusy, setOauthBusy] = useState(false);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]); // Multi select for assignment

  // Forms
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    description: '',
    interval: 'WEEKLY',
    intervalCount: 1
  });

  const [assignForm, setAssignForm] = useState({
    templateId: '',
    price: ''
  });

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
      fetchPlans(), // Fetches active=true
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
      if (data.plans) {
        setPlans(data.plans.filter(p => !p.isTemplate));
        setTemplates(data.plans.filter(p => p.isTemplate));
      }
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
      const res = await fetch('/api/settings/status');
      const data = await res.json();
      if (res.ok && data) {
        setShopDomain(data.shopDomain || '');
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

  // 1. Create Template (Global Type)
  async function handleCreateTemplate() {
    if (!newTemplateForm.name) return alert("Şablon adı girin");

    // Auto desc if empty
    const desc = newTemplateForm.description.trim() || `${newTemplateForm.intervalCount} ${newTemplateForm.interval === 'WEEKLY' ? 'Haftada' : 'Ayda'} 1 yenilenir`;

    try {
      const res = await fetch('/api/plans', {
        method: 'POST', // Logic supports creating single plan
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateForm.name,
          description: desc,
          price: 0, // Template doesn't need price
          interval: newTemplateForm.interval,
          intervalCount: newTemplateForm.intervalCount,
          isTemplate: true,
          groupName: 'Global', // Simplified grouping
          shopifyProductId: '' // Not linked to product
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchPlans();
        setNewTemplateForm({ ...newTemplateForm, name: '', description: '' });
      } else {
        alert('Hata: ' + (data.message || data.error));
      }
    } catch (err) { alert('Hata: ' + err.message); }
  }

  // 2. Assign Template to Products (Bulk Create)
  async function handleAssign() {
    if (selectedProductIds.length === 0) return alert("En az bir ürün seçin");
    if (!assignForm.templateId) return alert("Bir şablon seçin");
    if (!assignForm.price) return alert("Fiyat girin");

    const template = templates.find(t => t.id === assignForm.templateId);
    if (!template) return;

    try {
      // Use existing API support for assigning? 
      // Existing API 'assignTemplate' expects groupName.
      // But we can just use the SINGLE create loop here or update API.
      // Update API is cleaner, but let's use client-side loop for flexibility since API 'duplicate check' is robust now.
      // Wait, API has 'assignTemplate' block which uses 'groupName'. Our templates might not have unique groupNames per template.
      // Better to call 'create' for each product? Or update API?
      // Lets call 'create' for each product. It's safe and checks duplicates.

      let successCount = 0;
      for (const pid of selectedProductIds) {
        const res = await fetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            price: assignForm.price,
            interval: template.interval,
            intervalCount: template.intervalCount,
            shopifyProductId: pid,
            isTemplate: false,
            groupName: template.name // Group by Template Name useful
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Plan atanamadi (productId: ${pid})`);
        }
        successCount++;
      }

      alert(`${successCount} ürün için plan oluşturuldu/güncellendi.`);
      fetchPlans();
      setSelectedProductIds([]);
      setAssignForm({ ...assignForm, price: '' });

    } catch (err) { alert('Hata: ' + err.message); }
  }

  async function handleDeletePlan(planId) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
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
    if (!envStatus?.hasShopifyClientId || !envStatus?.hasShopifyClientSecret) {
      alert('SHOPIFY_CLIENT_ID veya SHOPIFY_CLIENT_SECRET eksik. Once Vercel env degiskenlerini tamamlayin.');
      return;
    }
    const domain = shopDomain.includes('.myshopify.com') ? shopDomain.trim() : shopDomain.trim() + '.myshopify.com';
    setOauthBusy(true);
    window.location.href = '/api/auth?shop=' + encodeURIComponent(domain);
  }

  // --- HELPERS ---
  function intervalLabel(interval, count) {
    const map = { WEEKLY: 'Haftada', MONTHLY: 'Ayda', QUARTERLY: '3 Ayda', YEARLY: 'Yılda' };
    const unit = map[interval] || 'Ayda';
    return `${count} ${unit} 1`;
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

  const filteredProducts = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={st.page}>
      <div style={st.container}>
        <div style={st.header}>
          <h1 style={st.title}>Abonelik Yönetimi</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://admin.shopify.com" target="_blank" style={st.btnSmall}>Shopify Admin</a>
            <button onClick={() => { sessionStorage.removeItem('admin_auth'); setIsAuthenticated(false); }} style={st.btnSmall}>Çıkış</button>
          </div>
        </div>

        <div style={st.tabs}>
          <TabBtn active={activeTab === 'templates'} icon="library_add" label="1. Plan Şablonları" onClick={() => setActiveTab('templates')} />
          <TabBtn active={activeTab === 'assignments'} icon="link" label="2. Ürünlere Tanımla" onClick={() => setActiveTab('assignments')} />
          <TabBtn active={activeTab === 'subscriptions'} icon="people" label="3. Aboneler" onClick={() => setActiveTab('subscriptions')} />
          <TabBtn active={activeTab === 'settings'} icon="settings" label="Ayarlar" onClick={() => setActiveTab('settings')} />
        </div>

        {/* TAB 1: TEMPLATES (Create Types) */}
        {activeTab === 'templates' && (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Left: Create Form */}
            <div style={{ width: 350, ...st.card }}>
              <h3 style={st.cardTitle}>Yeni Şablon Oluştur</h3>
              <div style={{ marginBottom: 15 }}>
                <label style={st.label}>İsim</label>
                <input style={st.input} placeholder="Örn: Haftalık Standart" value={newTemplateForm.name} onChange={e => setNewTemplateForm({ ...newTemplateForm, name: e.target.value })} />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={st.label}>Açıklama</label>
                <input style={st.input} placeholder="Açıklama" value={newTemplateForm.description} onChange={e => setNewTemplateForm({ ...newTemplateForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <div style={{ flex: 1 }}>
                  <label style={st.label}>Sıklık</label>
                  <select style={st.select} value={newTemplateForm.interval} onChange={e => setNewTemplateForm({ ...newTemplateForm, interval: e.target.value })}>
                    <option value="WEEKLY">Haftalık</option>
                    <option value="MONTHLY">Aylık</option>
                    <option value="QUARTERLY">3 Aylık</option>
                    <option value="YEARLY">Yıllık</option>
                  </select>
                </div>
                <div style={{ width: 80 }}>
                  <label style={st.label}>Periyot</label>
                  <input type="number" min="1" style={st.input} value={newTemplateForm.intervalCount} onChange={e => setNewTemplateForm({ ...newTemplateForm, intervalCount: e.target.value })} />
                </div>
              </div>
              <button onClick={handleCreateTemplate} style={{ ...st.btnPrimary, width: '100%' }}>Şablon Oluştur</button>
              <p style={{ fontSize: 11, color: '#999', marginTop: 10 }}>Bu şablonu daha sonra ürünlere fiyat girerek atayabilirsiniz.</p>
            </div>

            {/* Right: List */}
            <div style={{ flex: 1, ...st.card }}>
              <h3 style={st.cardTitle}>Mevcut Şablonlar</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15 }}>
                {templates.map(t => (
                  <div key={t.id} style={{ border: '1px solid #eee', padding: 15, borderRadius: 8, background: '#f9fafb', position: 'relative' }}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#666', margin: '5px 0' }}>{intervalLabel(t.interval, t.intervalCount)}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{t.description}</div>
                    <button onClick={() => handleDeletePlan(t.id)} style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}>Sil</button>
                  </div>
                ))}
                {templates.length === 0 && <p style={{ color: '#999' }}>Henüz şablon yok.</p>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ASSIGNMENT */}
        {activeTab === 'assignments' && (
          <div style={{ display: 'flex', gap: 20, height: 600 }}>
            {/* Left: Products */}
            <div style={{ width: '40%', ...st.card, display: 'flex', flexDirection: 'column' }}>
              <h3 style={st.cardTitle}>1. Ürün Seçin ({selectedProductIds.length})</h3>
              <input style={st.input} placeholder="Ürün Ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div style={{ flex: 1, overflowY: 'auto', marginTop: 10 }}>
                {filteredProducts.map(p => (
                  <label key={p.id} style={{ display: 'flex', gap: 10, padding: 8, borderBottom: '1px solid #eee', alignItems: 'center', cursor: 'pointer', background: selectedProductIds.includes(p.id.toString()) ? '#f0fdf4' : 'transparent' }}>
                    <input type="checkbox" checked={selectedProductIds.includes(p.id.toString())} onChange={e => {
                      const pid = p.id.toString();
                      if (e.target.checked) setSelectedProductIds([...selectedProductIds, pid]);
                      else setSelectedProductIds(selectedProductIds.filter(id => id !== pid));
                    }} />
                    {p.image && <img src={p.image} style={{ width: 35, height: 35, objectFit: 'cover', borderRadius: 4 }} />}
                    <span style={{ fontSize: 13 }}>{p.title}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Right: Assign Form & Product Plans */}
            <div style={{ flex: 1, ...st.card }}>
              <h3 style={st.cardTitle}>2. Şablon ve Fiyat Tanımla</h3>

              <div style={{ background: '#f9fafb', padding: 20, borderRadius: 8, border: '1px solid #eee', marginBottom: 20 }}>
                <div style={{ marginBottom: 15 }}>
                  <label style={st.label}>Hangi Şablon?</label>
                  <select style={st.select} value={assignForm.templateId} onChange={e => setAssignForm({ ...assignForm, templateId: e.target.value })}>
                    <option value="">Seçiniz...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({intervalLabel(t.interval, t.intervalCount)})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label style={st.label}>Fiyat (TL)</label>
                  <input type="number" style={st.input} placeholder="Fiyat girin" value={assignForm.price} onChange={e => setAssignForm({ ...assignForm, price: e.target.value })} />
                </div>
                <button onClick={handleAssign} style={{ ...st.btnPrimary, width: '100%' }}>
                  {selectedProductIds.length} Ürüne Uygula
                </button>
              </div>

              <h4 style={{ fontSize: 14, margin: '0 0 10px' }}>Ürünlerdeki Mevcut Planlar</h4>
              <div style={{ flex: 1, overflowY: 'auto', height: 250, borderTop: '1px solid #eee', paddingTop: 10 }}>
                {plans.length === 0 ? <p style={{ color: '#999' }}>Henüz ürün planı yok.</p> : (
                  <table style={st.table}>
                    <thead><tr><th style={st.th}>Ürün</th><th style={st.th}>Plan</th><th style={st.th}>Fiyat</th><th style={st.th}></th></tr></thead>
                    <tbody>
                      {plans.map(p => {
                        const prod = products.find(pr => pr.id.toString() === p.shopifyProductId);
                        return (
                          <tr key={p.id}>
                            <td style={st.td}>{prod?.title || p.shopifyProductId}</td>
                            <td style={st.td}>{p.name} <span style={{ color: '#999', fontSize: 11 }}>({intervalLabel(p.interval, p.intervalCount)})</span></td>
                            <td style={st.td}>{p.price} TL</td>
                            <td style={st.td}><button onClick={() => handleDeletePlan(p.id)} style={{ color: 'red', border: 'none', background: 'none' }}>Sil</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs */}
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

        {activeTab === 'settings' && (
          <div style={st.card}>
            <h3>Ayarlar</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={shopDomain} onChange={e => setShopDomain(e.target.value)} placeholder="magaza.myshopify.com" style={st.input} />
              <button onClick={startOAuth} style={st.btnPrimary} disabled={oauthBusy}>{oauthBusy ? 'Yonlendiriliyor...' : 'Shopify Bağlan'}</button>
            </div>
            <div style={{ marginTop: 20, fontSize: 13, color: '#666' }}>
              <p>Uygulama İzinleri: {envStatus?.scopes?.join(', ')}</p>
              <p>Environment: {envStatus?.hasShopifyClientId && envStatus?.hasShopifyClientSecret ? 'OK' : 'Missing Keys'}</p>
              <p>Store Token: {envStatus?.hasAccessToken ? 'OK' : 'Missing'}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function TabBtn({ active, icon, label, onClick }) {
  return <button onClick={onClick} style={active ? st.tabActive : st.tab}><span className="material-icons-outlined" style={{ fontSize: 18, marginRight: 6 }}>{icon}</span>{label}</button>;
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
  cardTitle: { margin: '0 0 10px', fontSize: 15, fontWeight: 600, borderBottom: '1px solid #eee', paddingBottom: 10 },
  label: { display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: 10, background: '#f5f5f5', borderBottom: '1px solid #ddd' },
  td: { padding: 10, borderBottom: '1px solid #eee' },
};
