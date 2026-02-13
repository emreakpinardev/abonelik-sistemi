import Link from 'next/link';

export default function Home() {
  return (
    <div className="page">
      <div className="container">
        <div className="result-container">
          <div className="result-card card">
            <div className="result-icon">🔄</div>
            <h2>Abonelik Sistemi</h2>
            <p>
              Shopify + iyzico entegrasyonlu abonelik yönetim sistemi.
              Aşağıdaki bağlantılardan erişim sağlayabilirsiniz.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/checkout" className="btn btn-primary">
                💳 Abonelik Başlat
              </Link>
              <Link href="/admin" className="btn btn-secondary">
                ⚙️ Admin Paneli
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
