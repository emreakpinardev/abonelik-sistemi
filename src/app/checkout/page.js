'use client';

import { useState, useEffect, useRef } from 'react';

// iyzico formunu script'leriyle birlikte render eden bilesen
function IyzicoForm({ html }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !html) return;
        containerRef.current.innerHTML = html;
        const scripts = containerRef.current.querySelectorAll('script');
        scripts.forEach((oldScript) => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }, [html]);

    return <div ref={containerRef} className="iyzico-form-wrapper" />;
}

export default function CheckoutPage() {
    const [cartItems, setCartItems] = useState([]);
    const [cartTotal, setCartTotal] = useState('0');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [checkoutHtml, setCheckoutHtml] = useState('');
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        customerCity: '',
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const cartParam = params.get('cart');

        if (cartParam) {
            try {
                const decoded = JSON.parse(decodeURIComponent(atob(decodeURIComponent(cartParam))));
                setCartItems(decoded.items || []);
                setCartTotal(decoded.total || '0');
            } catch (e) {
                console.error('Sepet verisi okunamadi:', e);
            }
        }
        setLoading(false);
    }, []);

    function handleInputChange(e) {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (cartItems.length === 0) { alert('Sepetiniz boş'); return; }
        if (!formData.customerName || !formData.customerEmail || !formData.customerPhone || !formData.customerAddress || !formData.customerCity) {
            alert('Lütfen tüm alanları doldurun'); return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/iyzico/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'single',
                    productId: cartItems.map(i => i.id).join(','),
                    productName: cartItems.map(i => i.name).join(', '),
                    productPrice: cartTotal,
                    variantId: cartItems.map(i => i.variant_id).join(','),
                    cartItems,
                    ...formData,
                }),
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch (e) {
                throw new Error(`Sunucu hatası (${res.status})`);
            }
            if (data.success && data.checkoutFormContent) {
                setCheckoutHtml(data.checkoutFormContent);
            } else {
                alert(data.error || 'Ödeme başlatılamadı');
            }
        } catch (err) {
            alert('Bir hata oluştu, lütfen tekrar deneyin');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <>
                <style>{cssStyles}</style>
                <div className="checkout-page">
                    <div className="checkout-container">
                        <div className="loading-container">
                            <div className="spinner"></div>
                            <p>Yükleniyor...</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (checkoutHtml) {
        return (
            <>
                <style>{cssStyles}</style>
                <div className="checkout-page">
                    <div className="checkout-container">
                        <div className="checkout-header">
                            <div className="logo-icon">💳</div>
                            <h1>Güvenli Ödeme</h1>
                            <p className="header-sub">Kart bilgilerinizi güvenle girin</p>
                        </div>
                        <div className="checkout-card iyzico-card">
                            <div className="card-top-bar">
                                <span className="card-title">Kart Bilgileri</span>
                                <span className="ssl-badge">🔒 SSL Korumalı</span>
                            </div>
                            <IyzicoForm html={checkoutHtml} />
                        </div>
                        <div className="powered-by">
                            <span>🛡️ iyzico güvencesiyle</span>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{cssStyles}</style>
            <div className="checkout-page">

                {/* Animated background particles */}
                <div className="bg-particles">
                    <div className="particle p1"></div>
                    <div className="particle p2"></div>
                    <div className="particle p3"></div>
                    <div className="particle p4"></div>
                </div>

                <div className="checkout-container">
                    {/* HEADER */}
                    <div className="checkout-header">
                        <div className="logo-icon">🛍️</div>
                        <h1>Ödeme</h1>
                        <p className="header-sub">Siparişinizi tamamlamak için bilgilerinizi girin</p>
                    </div>

                    {/* PROGRESS STEPS */}
                    <div className="progress-bar">
                        <div className="step active">
                            <div className="step-circle">1</div>
                            <span>Sipariş</span>
                        </div>
                        <div className="step-line active-line"></div>
                        <div className="step active">
                            <div className="step-circle">2</div>
                            <span>Bilgiler</span>
                        </div>
                        <div className="step-line"></div>
                        <div className="step">
                            <div className="step-circle">3</div>
                            <span>Ödeme</span>
                        </div>
                    </div>

                    <div className="checkout-grid">
                        {/* LEFT - FORM */}
                        <div className="checkout-left">
                            {cartItems.length > 0 && (
                                <form onSubmit={handleSubmit}>
                                    <div className="checkout-card">
                                        <div className="card-top-bar">
                                            <span className="card-title">👤 İletişim Bilgileri</span>
                                        </div>
                                        <div className="form-group">
                                            <label>Ad Soyad</label>
                                            <input type="text" name="customerName" placeholder="Adınız Soyadınız" value={formData.customerName} onChange={handleInputChange} required />
                                        </div>
                                        <div className="form-group">
                                            <label>E-posta</label>
                                            <input type="email" name="customerEmail" placeholder="ornek@email.com" value={formData.customerEmail} onChange={handleInputChange} required />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Telefon</label>
                                                <input type="tel" name="customerPhone" placeholder="+90 5XX XXX XX XX" value={formData.customerPhone} onChange={handleInputChange} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Şehir</label>
                                                <input type="text" name="customerCity" placeholder="İstanbul" value={formData.customerCity} onChange={handleInputChange} required />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Adres</label>
                                            <input type="text" name="customerAddress" placeholder="Tam açık adresiniz" value={formData.customerAddress} onChange={handleInputChange} required />
                                        </div>
                                    </div>

                                    <button className={`pay-btn ${submitting ? 'disabled' : ''}`} type="submit" disabled={submitting}>
                                        {submitting ? (
                                            <><span className="btn-spinner"></span> İşleniyor...</>
                                        ) : (
                                            <><span className="btn-icon">💳</span> {cartTotal} ₺ Öde</>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* RIGHT - ORDER SUMMARY */}
                        <div className="checkout-right">
                            <div className="checkout-card order-summary">
                                <div className="card-top-bar">
                                    <span className="card-title">🧾 Sipariş Özeti</span>
                                    <span className="item-count">{cartItems.reduce((s, i) => s + i.quantity, 0)} ürün</span>
                                </div>

                                {cartItems.length === 0 ? (
                                    <div className="empty-cart">
                                        <div className="empty-icon">🛒</div>
                                        <p>Sepetiniz boş</p>
                                        <small>Mağazadan ürün ekleyin</small>
                                    </div>
                                ) : (
                                    <>
                                        <div className="cart-items">
                                            {cartItems.map((item, index) => (
                                                <div key={index} className="cart-item">
                                                    <div className="item-thumb">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} />
                                                        ) : (
                                                            <div className="item-thumb-placeholder">📦</div>
                                                        )}
                                                        <span className="item-qty-badge">{item.quantity}</span>
                                                    </div>
                                                    <div className="item-details">
                                                        <div className="item-name">{item.name}</div>
                                                        {item.variant && <div className="item-variant">{item.variant}</div>}
                                                    </div>
                                                    <div className="item-price">
                                                        {(parseFloat(item.price) * item.quantity).toFixed(2)} ₺
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="summary-divider"></div>

                                        <div className="summary-row">
                                            <span>Ara Toplam</span>
                                            <span>{cartTotal} ₺</span>
                                        </div>
                                        <div className="summary-row">
                                            <span>Kargo</span>
                                            <span className="free-shipping">Ücretsiz</span>
                                        </div>
                                        <div className="summary-divider"></div>
                                        <div className="summary-row total-row">
                                            <span>Toplam</span>
                                            <span className="total-amount">{cartTotal} ₺</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="trust-badges">
                                <div className="trust-item">🔒 256-bit SSL</div>
                                <div className="trust-item">🛡️ iyzico Güvence</div>
                                <div className="trust-item">↩️ Kolay İade</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

const cssStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

.checkout-page {
    min-height: 100vh;
    background: #0b0b1e;
    background-image:
        radial-gradient(ellipse at 20% 50%, rgba(92, 106, 196, 0.12) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(124, 140, 248, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 90%, rgba(168, 85, 247, 0.06) 0%, transparent 40%);
    padding: 30px 16px 60px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #e4e4ef;
    position: relative;
    overflow: hidden;
}

/* Animated Particles */
.bg-particles { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.particle {
    position: absolute;
    border-radius: 50%;
    opacity: 0.15;
    animation: floatParticle 20s infinite ease-in-out;
}
.p1 { width: 300px; height: 300px; background: #5c6ac4; top: -100px; left: -50px; animation-delay: 0s; }
.p2 { width: 200px; height: 200px; background: #7c8cf8; bottom: -80px; right: -60px; animation-delay: 5s; }
.p3 { width: 150px; height: 150px; background: #a855f7; top: 40%; right: 10%; animation-delay: 10s; }
.p4 { width: 100px; height: 100px; background: #6366f1; bottom: 20%; left: 20%; animation-delay: 15s; }
@keyframes floatParticle {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(30px, -40px) scale(1.1); }
    50% { transform: translate(-20px, 20px) scale(0.95); }
    75% { transform: translate(15px, 30px) scale(1.05); }
}

.checkout-container {
    max-width: 960px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
}

/* Header */
.checkout-header {
    text-align: center;
    margin-bottom: 30px;
    animation: fadeInDown 0.6s ease;
}
.logo-icon {
    font-size: 42px;
    margin-bottom: 12px;
    animation: pulse 2s infinite;
}
@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
}
.checkout-header h1 {
    font-size: 32px;
    font-weight: 800;
    background: linear-gradient(135deg, #fff 0%, #c4c8f8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 6px;
}
.header-sub {
    color: #8888aa;
    font-size: 15px;
    font-weight: 400;
}

/* Progress Bar */
.progress-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 36px;
    animation: fadeInDown 0.7s ease;
}
.step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    opacity: 0.35;
    transition: opacity 0.3s;
}
.step.active { opacity: 1; }
.step-circle {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 2px solid rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
}
.step.active .step-circle {
    background: linear-gradient(135deg, #5c6ac4, #7c8cf8);
    border-color: #7c8cf8;
    box-shadow: 0 0 20px rgba(92, 106, 196, 0.4);
}
.step span { font-size: 12px; font-weight: 500; }
.step-line {
    width: 60px; height: 2px;
    background: rgba(255,255,255,0.08);
    margin: 0 8px;
    margin-bottom: 22px;
}
.step-line.active-line {
    background: linear-gradient(90deg, #5c6ac4, #7c8cf8);
}

/* Grid Layout */
.checkout-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    animation: fadeInUp 0.8s ease;
}
@media (max-width: 768px) {
    .checkout-grid {
        grid-template-columns: 1fr;
    }
    .checkout-right { order: -1; }
}

/* Cards */
.checkout-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 20px;
    backdrop-filter: blur(20px);
    transition: border-color 0.3s, box-shadow 0.3s;
}
.checkout-card:hover {
    border-color: rgba(92, 106, 196, 0.25);
    box-shadow: 0 4px 30px rgba(92, 106, 196, 0.06);
}
.card-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.card-title {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
}
.item-count {
    font-size: 12px;
    color: #7c8cf8;
    background: rgba(92, 106, 196, 0.12);
    padding: 4px 10px;
    border-radius: 20px;
    font-weight: 600;
}

/* Form */
.form-group {
    margin-bottom: 16px;
}
.form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #9999bb;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.form-group input {
    width: 100%;
    padding: 13px 16px;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    outline: none;
    transition: all 0.3s;
}
.form-group input:focus {
    border-color: #5c6ac4;
    box-shadow: 0 0 0 3px rgba(92, 106, 196, 0.15);
    background: rgba(255, 255, 255, 0.06);
}
.form-group input::placeholder { color: #555577; }
.form-row { display: flex; gap: 14px; }
.form-row .form-group { flex: 1; }

/* Pay Button */
.pay-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #5c6ac4, #7c8cf8);
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 18px;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 20px rgba(92, 106, 196, 0.35);
    position: relative;
    overflow: hidden;
}
.pay-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent, rgba(255,255,255,0.1), transparent);
    transform: translateX(-100%);
    transition: transform 0.5s;
}
.pay-btn:hover::before { transform: translateX(100%); }
.pay-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(92, 106, 196, 0.5);
}
.pay-btn.disabled {
    background: #333355;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
}
.btn-icon { font-size: 22px; }
.btn-spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Cart Items */
.cart-items { margin-bottom: 4px; }
.cart-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.2s;
}
.cart-item:last-child { border-bottom: none; }
.item-thumb {
    position: relative;
    width: 52px; height: 52px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(255,255,255,0.06);
}
.item-thumb img {
    width: 100%; height: 100%;
    object-fit: cover;
}
.item-thumb-placeholder {
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
}
.item-qty-badge {
    position: absolute;
    top: -5px; right: -5px;
    width: 20px; height: 20px;
    background: #5c6ac4;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}
.item-details { flex: 1; min-width: 0; }
.item-name {
    font-weight: 600;
    font-size: 14px;
    color: #e4e4ef;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.item-variant { color: #7777aa; font-size: 12px; margin-top: 2px; }
.item-price {
    font-weight: 700;
    font-size: 15px;
    color: #7c8cf8;
    white-space: nowrap;
}

/* Summary */
.summary-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 14px 0;
}
.summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 14px;
    color: #9999bb;
}
.total-row {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    padding-top: 8px;
}
.total-amount {
    font-size: 22px;
    background: linear-gradient(135deg, #7c8cf8, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.free-shipping {
    color: #4ade80;
    font-weight: 600;
}

/* Trust Badges */
.trust-badges {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
}
.trust-item {
    font-size: 11px;
    color: #6666aa;
    background: rgba(255,255,255,0.03);
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.05);
}

/* Empty Cart */
.empty-cart {
    text-align: center;
    padding: 40px 20px;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.empty-cart p { font-size: 16px; color: #888; margin-bottom: 4px; }
.empty-cart small { color: #666; }

/* iyzico Card */
.iyzico-card .iyzico-form-wrapper { min-height: 200px; }

/* SSL Badge */
.ssl-badge {
    background: rgba(46,125,50,0.15);
    color: #66bb6a;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}

/* Powered By */
.powered-by {
    text-align: center;
    margin-top: 20px;
    color: #5555aa;
    font-size: 13px;
}

/* Loading */
.loading-container { text-align: center; padding: 80px 20px; }
.spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #5c6ac4;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
}
.loading-container p { color: #888; }

/* Animations */
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
`;
