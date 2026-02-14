'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('templates');

  // Data
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]); // isTemplate: true
  const [products, setProducts] = useState([]); // Shopify Products
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [envStatus, setEnvStatus] = useState(null);
  const [scriptInstalled, setScriptInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  // UI State
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedTemplateGroup, setSelectedTemplateGroup] = useState('');

  // Forms
  const [templateForm, setTemplateForm] = useState({
    groupName: '',
    description: '',
    variations: [{ interval: 'MONTHLY', intervalCount: 1, price: '' }]
  });

  const [shopDomain, setShopDomain] = useState('');

  // Initial Auth Check
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch Data on Auth
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTemplates();
    fetchPlans();
    fetchSubscriptions();
    fetchEnvStatus();
    fetchScriptStatus();
  }, [isAuthenticated]);

  // Fetch Products when tab changes or search
  useEffect(() => {
    if (activeTab === 'assignments') {
      fetchProducts(searchTerm);
    }
  }, [activeTab, searchTerm]);

  // --- API CALLS ---
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

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/plans?isTemplate=true');
      const data = await res.json();
      setTemplates(data.plans || []);
    } catch (err) { console.error(err); }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/plans?isTemplate=false'); // Normal planlar (optional)
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err) { console.error(err); }
  }

  async function fetchProducts(search = '') {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopify/products?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions?status=${filter}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setStats(data.stats || {});
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function fetchScriptStatus() {
    try {
      const res = await fetch('/api/shopify/scripttag');
      const data = await res.json();
      setScriptInstalled(data.installed);
    } catch { }
  }

  async function handleInstallScript() {
    if (!confirm('Widget servisi mağazaya eklenecek. Onaylıyor musunuz?')) return;
    setInstalling(true);
    try {
      const res = await fetch('/api/shopify/scripttag', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScriptInstalled(true);
        alert('Widget başarıyla yüklendi!');
      } else {
        let msg = 'Hata: ' + (data.error || 'Bilinmeyen hata');
        if (data.details) msg += '\nDetay: ' + JSON.stringify(data.details);
        alert(msg);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
    setInstalling(false);
  }

  async function fetchEnvStatus() {
    try {
      const res = await fetch('/api/settings/status');
      if (res.ok) setEnvStatus(await res.json());
    } catch { }
  }

  // --- ACTIONS ---
  async function handleCreateTemplate() {
    if (!templateForm.groupName || templateForm.variations.some(v => !v.price)) {
      alert('Lütfen grup adı ve tüm fiyatları girin');
      return;
    }

    // Her varyasyon için ayrı plan oluştur
    try {
      // Backend should support batch creation or loop here.
      // Since our API currently creates single plan, we loop here?
      // No, let's assume we updated API to handle batch or loop here.
      // API currently handles Create Single. 
      // Let's loop here for simplicity to avoid huge API refactor right now or update API to accept array?
      // I prefer updating API to accept batch but I already implemented POST. 
      // Current POST implementation supports single creation.
      // I will loop here. It's safer.

      for (const v of templateForm.variations) {
        await fetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${templateForm.groupName} - ${intervalLabel(v.interval, v.intervalCount)}`, // Or simplified name
            description: templateForm.description,
            price: v.price,
            interval: v.interval,
            intervalCount: v.intervalCount,
            isTemplate: true,
            groupName: templateForm.groupName
          })
        });
      }

      setShowTemplateForm(false);
      setTemplateForm({ groupName: '', description: '', variations: [{ interval: 'MONTHLY', intervalCount: 1, price: '' }] });
      fetchTemplates();
      alert('Şablon oluşturuldu!');
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  }

  async function handleAssignTemplate() {
    if (selectedProductIds.length === 0 || !selectedTemplateGroup) {
      alert('Lütfen ürün ve şablon seçin');
      return;
    }

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignTemplate: true,
          groupName: selectedTemplateGroup,
          productIds: selectedProductIds
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.count} plan varyasyonu oluşturuldu!`);
        setSelectedProductIds([]);
        fetchPlans(); // Refresh actual plans
      } else {
        alert('Hata: ' + data.error);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  }

  async function handleDeletePlan(plan) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`/api/plans?id=${plan.id}`, { method: 'DELETE' });
      fetchTemplates();
      fetchPlans();
    } catch (err) { alert(err.message); }
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

  // --- HELPERS ---
  const groupedTemplates = templates.reduce((acc, t) => {
    const g = t.groupName || 'Genel';
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});

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

  function startOAuth() {
    if (!shopDomain.trim()) { alert('Mağaza domainini girin'); return; }
    const domain = shopDomain.includes('.myshopify.com') ? shopDomain.trim() : shopDomain.trim() + '.myshopify.com';
    window.open('/api/auth?shop=' + encodeURIComponent(domain), '_blank');
  }

  // --- RENDER ---
  if (!isAuthenticated) {
    return (
      <div style={st.page}>
        <div style={st.loginBox}>
          <span className="material-icons-outlined" style={{ fontSize: 40, color: '#16a34a', marginBottom: 12 }}>admin_panel_settings</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Yönetici Girişi</h2>
          <form onSubmit={handleLogin}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" style={st.input} autoFocus />
            {authError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{authError}</p>}
            <button type="submit" style={st.btnPrimary}>Giriş Yap</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={st.page}>
      <div style={st.container}>
        {/* Header */}
        <div style={st.header}>
          <h1 style={st.title}><span className="material-icons-outlined" style={{ fontSize: 28, marginRight: 8, color: '#16a34a' }}>dashboard</span> Abonelik Yönetimi</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://admin.shopify.com" target="_blank" style={st.btnSmall}>Shopify Admin</a>
            <button onClick={() => { sessionStorage.removeItem('admin_auth'); setIsAuthenticated(false); }} style={st.btnSmall}>Çıkış</button>
          </div>
        </div>

        {/* Stats */}
        <div style={st.statsGrid}>
          <StatCard icon="check_circle" label="Aktif Abonelik" value={stats.byStatus?.ACTIVE || 0} color="#16a34a" />
          <StatCard icon="pending" label="Bekleyen" value={stats.byStatus?.PENDING || 0} color="#f59e0b" />
          <StatCard icon="cancel" label="İptal" value={stats.byStatus?.CANCELLED || 0} color="#ef4444" />
          <StatCard icon="payments" label="Toplam Gelir" value={`${(stats.totalRevenue || 0).toLocaleString('tr-TR')}₺`} color="#2563eb" />
        </div>

        {/* Tabs */}
        <div style={st.tabs}>
          <TabBtn active={activeTab === 'templates'} icon="library_add" label="1. Şablonlar" onClick={() => setActiveTab('templates')} />
          <TabBtn active={activeTab === 'assignments'} icon="link" label="2. Ürün Tanımlama" onClick={() => setActiveTab('assignments')} />
          <TabBtn active={activeTab === 'subscriptions'} icon="people" label="3. Abonelikler" onClick={() => setActiveTab('subscriptions')} />
          <TabBtn active={activeTab === 'settings'} icon="settings" label="Ayarlar" onClick={() => setActiveTab('settings')} />
        </div>

        {/* TAB 1: TEMPLATES */}
        {activeTab === 'templates' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={st.sectionTitle}>Abonelik Şablonları</h2>
              <button onClick={() => setShowTemplateForm(true)} style={st.btnPrimary}>+ Yeni Şablon Grubu</button>
            </div>

            {showTemplateForm && (
              <div style={st.card}>
                <h3>Yeni Şablon Grubu Oluştur</h3>
                <div style={st.formGroup}>
                  <label style={st.label}>Grup Adı (Örn: Standart Paket)</label>
                  <input value={templateForm.groupName} onChange={e => setTemplateForm({ ...templateForm, groupName: e.target.value })} style={st.input} placeholder="Paket Adı" />
                </div>
                <div style={st.formGroup}>
                  <label style={st.label}>Açıklama (Opsiyonel)</label>
                  <input value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} style={st.input} placeholder="Müşterilere görünecek açıklama" />
                </div>

                <h4 style={{ fontSize: 14, margin: '15px 0 10px' }}>Varyasyonlar (Süre & Fiyat)</h4>
                {templateForm.variations.map((v, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <select value={v.interval} onChange={e => {
                      const newVars = [...templateForm.variations];
                      newVars[idx].interval = e.target.value;
                      setTemplateForm({ ...templateForm, variations: newVars });
                    }} style={st.select}>
                      <option value="WEEKLY">Haftalık</option>
                      <option value="MONTHLY">Aylık</option>
                      <option value="QUARTERLY">3 Aylık</option>
                      <option value="YEARLY">Yıllık</option>
                    </select>
                    <input type="number" value={v.intervalCount} onChange={e => {
                      const newVars = [...templateForm.variations];
                      newVars[idx].intervalCount = parseInt(e.target.value);
                      setTemplateForm({ ...templateForm, variations: newVars });
                    }} style={{ ...st.input, width: 80 }} min={1} />

                    <input type="number" value={v.price} onChange={e => {
                      const newVars = [...templateForm.variations];
                      newVars[idx].price = e.target.value;
                      setTemplateForm({ ...templateForm, variations: newVars });
                    }} style={{ ...st.input, width: 120 }} placeholder="Fiyat (TL)" />

                    {idx > 0 && <button onClick={() => {
                      const newVars = templateForm.variations.filter((_, i) => i !== idx);
                      setTemplateForm({ ...templateForm, variations: newVars });
                    }} style={{ color: 'red', cursor: 'pointer', border: 'none', background: 'none' }}>Sil</button>}
                  </div>
                ))}
                <button onClick={() => setTemplateForm({ ...templateForm, variations: [...templateForm.variations, { interval: 'MONTHLY', intervalCount: 1, price: '' }] })}
                  style={{ ...st.btnSmall, marginTop: 5 }}>+ Varyasyon Ekle</button>

                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button onClick={handleCreateTemplate} style={st.btnPrimary}>Oluştur</button>
                  <button onClick={() => setShowTemplateForm(false)} style={st.btnSecondary}>İptal</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {Object.keys(groupedTemplates).map(groupName => (
                <div key={groupName} style={st.card}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: '#16a34a' }}>{groupName}</h3>
                  <div style={{ marginBottom: 10 }}>
                    {groupedTemplates[groupName].map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '5px 0', fontSize: 13 }}>
                        <span>{intervalLabel(t.interval, t.intervalCount)}</span>
                        <span style={{ fontWeight: 600 }}>{t.price} ₺</span>
                        <button onClick={() => handleDeletePlan(t)} style={{ border: 'none', background: 'none', color: '#999', cursor: 'pointer' }}>x</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
                    Bu şablona bağlı {plans.filter(p => !p.isTemplate && p.groupName === groupName).length} ürün planı var.
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 2: ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Left: Products */}
            <div style={{ flex: 1, ...st.card }}>
              <h3 style={st.cardTitle}>1. Ürün Seçin</h3>
              <input style={st.input} placeholder="Ürün Ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

              <div style={{ maxHeight: 400, overflowY: 'auto', marginTop: 10 }}>
                {loading ? <p>Yükleniyor...</p> : products.map(p => (
                  <div key={p.id} style={{ display: 'flex', gap: 10, padding: 10, borderBottom: '1px solid #eee', alignItems: 'center' }}>
                    <input type="checkbox"
                      checked={selectedProductIds.includes(p.id.toString())}
                      onChange={e => {
                        const pid = p.id.toString();
                        if (e.target.checked) setSelectedProductIds([...selectedProductIds, pid]);
                        else setSelectedProductIds(selectedProductIds.filter(id => id !== pid));
                      }}
                    />
                    {p.image && <img src={p.image} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>ID: {p.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Template Select */}
            <div style={{ width: 300, ...st.card, height: 'fit-content' }}>
              <h3 style={st.cardTitle}>2. Şablon Seçin</h3>
              <select value={selectedTemplateGroup} onChange={e => setSelectedTemplateGroup(e.target.value)} style={st.select}>
                <option value="">Seçiniz...</option>
                {Object.keys(groupedTemplates).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              <div style={{ margin: '20px 0' }}>
                <div style={{ fontSize: 13, marginBottom: 5 }}>Seçili Ürün Sayısı: <b>{selectedProductIds.length}</b></div>
                <div style={{ fontSize: 13 }}>Seçili Şablon: <b>{selectedTemplateGroup || '-'}</b></div>
              </div>

              <button onClick={handleAssignTemplate} style={{ ...st.btnPrimary, width: '100%', justifyContent: 'center' }}>Uygula & Planları Oluştur</button>
              <p style={{ fontSize: 11, color: '#999', marginTop: 10, lineHeight: 1.4 }}>
                Seçilen ürünler için, seçilen şablonun tüm varyasyonları (süre/fiyat) kopyalanıp plan olarak oluşturulacaktır.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: SUBSCRIPTIONS */}
        {activeTab === 'subscriptions' && (
          <>
            <h2 style={st.sectionTitle}>Abonelikler</h2>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {['ALL', 'ACTIVE', 'PENDING', 'CANCELLED'].map(s => (
                <button key={s} onClick={() => setFilter(s)} style={filter === s ? st.filterActive : st.filterBtn}>
                  {s === 'ALL' ? 'Tümü' : s}
                </button>
              ))}
            </div>
            <table style={st.table}>
              <thead><tr><th style={st.th}>Müşteri</th><th style={st.th}>Plan</th><th style={st.th}>Durum</th><th style={st.th}>İşlem</th></tr></thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td style={st.td}>{sub.customerName}<br /><span style={{ fontSize: 11, color: '#999' }}>{sub.customerEmail}</span></td>
                    <td style={st.td}>{sub.plan?.name}<br /><span style={{ fontSize: 11, color: 'green' }}>{sub.plan?.price} TL</span></td>
                    <td style={st.td}>{statusBadge(sub.status)}</td>
                    <td style={st.td}>
                      {sub.status === 'ACTIVE' && <button onClick={() => handleCancelSubscription(sub.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>İptal</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={st.card}>
            <h3>Ayarlar</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={shopDomain} onChange={e => setShopDomain(e.target.value)} placeholder="magaza.myshopify.com" style={st.input} />
              <button onClick={startOAuth} style={st.btnPrimary}>Shopify Bağlan</button>
            </div>
            <div style={{ marginTop: 20 }}>
              <h4>Sistem Durumu</h4>
              <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 10, borderRadius: 5 }}>
                {JSON.stringify(envStatus, null, 2)}
              </pre>
            </div>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #eee' }}>
              <h4>Mağaza Entegrasyonu (Widget)</h4>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>Ürün sayfalarında abonelik butonlarının görünmesi için widget'ı yükleyin.</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={handleInstallScript} style={{ ...st.btnPrimary, background: scriptInstalled ? '#059669' : '#2563eb' }}>
                  {scriptInstalled ? 'Widget Yüklü (Tekrar Yükle)' : 'Widget\'ı Mağazaya Yükle'}
                </button>
                {scriptInstalled && <span style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>✓ Aktif</span>}
              </div>
            </div>
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
  container: { maxWidth: 1000, margin: '0 auto', padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', margin: 0 },
  loginBox: { maxWidth: 350, margin: '100px auto', background: '#fff', padding: 30, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center' },
  card: { background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 20, border: '1px solid #eee' },
  input: { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 10, boxSizing: 'border-box' },
  select: { padding: 10, border: '1px solid #ddd', borderRadius: 6 },
  btnPrimary: { background: '#16a34a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
  btnSecondary: { background: '#eee', color: '#333', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer' },
  btnSmall: { background: '#fff', border: '1px solid #ddd', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 },
  tabs: { display: 'flex', gap: 5, marginBottom: 20, background: '#e5e7eb', padding: 4, borderRadius: 8 },
  tab: { flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabActive: { flex: 1, padding: '10px', border: 'none', background: '#fff', cursor: 'pointer', borderRadius: 6, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 20 },
  statCard: { background: '#fff', padding: 15, borderRadius: 8, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 15px', fontSize: 16, fontWeight: 600, borderBottom: '1px solid #eee', paddingBottom: 10 },
  formGroup: { marginBottom: 15 },
  label: { display: 'block', marginBottom: 5, fontSize: 13, fontWeight: 500, color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: 10, background: '#f5f5f5', borderBottom: '1px solid #ddd' },
  td: { padding: 10, borderBottom: '1px solid #eee' },
  filterBtn: { padding: '5px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: 20, cursor: 'pointer', fontSize: 12 },
  filterActive: { padding: '5px 10px', border: '1px solid #16a34a', background: '#16a34a', color: '#fff', borderRadius: 20, cursor: 'pointer', fontSize: 12 },
};
