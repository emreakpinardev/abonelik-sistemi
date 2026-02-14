'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [envStatus, setEnvStatus] = useState(null);
  const [loadingEnv, setLoadingEnv] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('settings_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchEnvStatus();
  }, [isAuthenticated]);

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
        sessionStorage.setItem('settings_auth', 'true');
      } else {
        setAuthError('Sifre yanlis');
      }
    } catch {
      setAuthError('Baglanti hatasi');
    }
  }

  async function fetchEnvStatus() {
    setLoadingEnv(true);
    try {
      const res = await fetch('/api/settings/status');
      if (res.ok) {
        const data = await res.json();
        setEnvStatus(data);
      }
    } catch { }
    setLoadingEnv(false);
  }

  function startOAuth() {
    if (!shopDomain.trim()) {
      alert('Magaza domainini girin');
      return;
    }
    const domain = shopDomain.includes('.myshopify.com') ? shopDomain.trim() : shopDomain.trim() + '.myshopify.com';
    window.open('/api/auth?shop=' + encodeURIComponent(domain), '_blank');
  }

  if (!isAuthenticated) {
    return (
      <div style={styles.page}>
        <div style={styles.loginBox}>
          <h2 style={styles.loginTitle}>Ayarlar</h2>
          <p style={styles.loginSub}>Devam etmek icin sifrenizi girin</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sifre"
              style={styles.input}
              autoFocus
            />
            {authError && <p style={styles.error}>{authError}</p>}
            <button type="submit" style={styles.btn}>Giris Yap</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Ayarlar</h1>
          <p style={styles.subtitle}>Abonelik sistemi yapilandirmasi</p>
        </div>

        {/* SHOPIFY BAGLANTISI */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Shopify Baglantisi</h3>
          <p style={styles.cardDesc}>Magaza domainini girip "Baglan" tusuna basin. Shopify sizi yetkilendirme sayfasina yonlendirecek, onayladiginizda Access Token otomatik olusacak.</p>

          <div style={styles.oauthRow}>
            <input
              type="text"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="magaza-adi.myshopify.com"
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
            />
            <button onClick={startOAuth} style={styles.btn}>
              Baglan / Yeni Token Al
            </button>
          </div>

          {envStatus && (
            <div style={styles.statusGrid}>
              <StatusItem label="Magaza" value={envStatus.shopDomain} ok={envStatus.hasShopDomain} />
              <StatusItem label="Access Token" value={envStatus.hasAccessToken ? 'Tanimli (***' + envStatus.tokenLast4 + ')' : 'Tanimlanmamis'} ok={envStatus.hasAccessToken} />
              <StatusItem label="API Baglantisi" value={envStatus.apiConnected ? 'Basarili' : 'Baglanti yok'} ok={envStatus.apiConnected} />
            </div>
          )}
        </div>

        {/* IYZICO AYARLARI */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>iyzico Odeme Ayarlari</h3>
          {envStatus && (
            <div style={styles.statusGrid}>
              <StatusItem label="API Key" value={envStatus.hasIyzicoKey ? 'Tanimli' : 'Tanimlanmamis'} ok={envStatus.hasIyzicoKey} />
              <StatusItem label="Secret Key" value={envStatus.hasIyzicoSecret ? 'Tanimli' : 'Tanimlanmamis'} ok={envStatus.hasIyzicoSecret} />
              <StatusItem label="Ortam" value={envStatus.iyzicoEnv} ok={envStatus.iyzicoEnv === 'LIVE'} />
            </div>
          )}
          <p style={styles.hint}>
            {envStatus?.iyzicoEnv === 'SANDBOX'
              ? 'Sandbox modunda calisiyorsunuz. Gercek odeme alinmaz. Canli gecis icin Vercel env deki IYZICO anahtarlarini LIVE olarak guncelleyin.'
              : 'Canli modda calisiyorsunuz. Gercek odemeler alinir.'}
          </p>
        </div>

        {/* GENEL AYARLAR */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Genel Bilgiler</h3>
          {envStatus && (
            <div style={styles.statusGrid}>
              <StatusItem label="Uygulama URL" value={envStatus.appUrl || '-'} ok={!!envStatus.appUrl} />
              <StatusItem label="Veritabani" value={envStatus.dbConnected ? 'Bagli' : 'Baglanti yok'} ok={envStatus.dbConnected} />
              <StatusItem label="Cron Secret" value={envStatus.hasCronSecret ? 'Tanimli' : 'Tanimlanmamis'} ok={envStatus.hasCronSecret} />
              <StatusItem label="Admin Sifresi" value={envStatus.hasAdminPassword ? 'Ozel sifre tanimli' : 'Varsayilan kullaniliyor'} ok={envStatus.hasAdminPassword} />
            </div>
          )}
        </div>

        {/* HIZLI LINKLER */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Hizli Erisim</h3>
          <div style={styles.linksGrid}>
            <a href="/admin" style={styles.linkCard}>
              <span style={styles.linkIcon}>📋</span>
              <span>Abonelik Paneli</span>
            </a>
            <a href="/checkout" style={styles.linkCard}>
              <span style={styles.linkIcon}>🛒</span>
              <span>Checkout Sayfasi</span>
            </a>
            <a href={envStatus?.appUrl + '/api/proxy/hesabim'} target="_blank" style={styles.linkCard}>
              <span style={styles.linkIcon}>👤</span>
              <span>Musteri Portali</span>
            </a>
            <a href="/api/test" target="_blank" style={styles.linkCard}>
              <span style={styles.linkIcon}>🔧</span>
              <span>API Test</span>
            </a>
          </div>
        </div>

        <button onClick={() => { sessionStorage.removeItem('settings_auth'); setIsAuthenticated(false); }} style={{ ...styles.btn, background: '#666', marginTop: 12 }}>
          Cikis Yap
        </button>
      </div>
    </div>
  );
}

function StatusItem({ label, value, ok }) {
  return (
    <div style={styles.statusItem}>
      <span style={{ ...styles.statusDot, background: ok ? '#4caf50' : '#ff5252' }}></span>
      <div>
        <div style={styles.statusLabel}>{label}</div>
        <div style={styles.statusValue}>{value || '-'}</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f7',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: '0 0 4px',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    margin: 0,
  },
  card: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: '0 0 8px',
    color: '#1a1a1a',
  },
  cardDesc: {
    fontSize: 13,
    color: '#666',
    margin: '0 0 16px',
    lineHeight: 1.5,
  },
  oauthRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusGrid: {
    display: 'grid',
    gap: 8,
    marginTop: 12,
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: '#fafafa',
    borderRadius: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: 12,
    color: '#888',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: 500,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    padding: '8px 12px',
    background: '#f9f9fb',
    borderRadius: 6,
    lineHeight: 1.5,
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  linkCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    background: '#f5f5f7',
    borderRadius: 8,
    textDecoration: 'none',
    color: '#333',
    fontSize: 13,
    fontWeight: 500,
    transition: 'background 0.2s',
  },
  linkIcon: {
    fontSize: 18,
  },
  loginBox: {
    maxWidth: 380,
    margin: '80px auto',
    textAlign: 'center',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  loginSub: {
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #ddd',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    marginBottom: 14,
    boxSizing: 'border-box',
  },
  btn: {
    padding: '11px 20px',
    background: '#5c6ac4',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    color: '#e53935',
    fontSize: 13,
    marginBottom: 10,
  },
};
