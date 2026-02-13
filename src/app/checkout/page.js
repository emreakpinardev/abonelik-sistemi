'use client';

import { useState, useEffect, useRef } from 'react';

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
            if (oldScript.textContent) newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }, [html]);
    return <div ref={containerRef} />;
}

export default function CheckoutPage() {
    const [cartItems, setCartItems] = useState([]);
    const [cartTotal, setCartTotal] = useState('0');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [checkoutHtml, setCheckoutHtml] = useState('');
    const [shippingMethod, setShippingMethod] = useState('free');
    const [discountCode, setDiscountCode] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        city: '',
        state: '',
        zipCode: '',
        address: '',
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
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.city || !formData.address) {
            alert('Lütfen tüm zorunlu alanları doldurun'); return;
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
                    customerName: formData.firstName + ' ' + formData.lastName,
                    customerEmail: formData.email,
                    customerPhone: formData.phone,
                    customerAddress: formData.address,
                    customerCity: formData.city,
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

    const shippingCost = shippingMethod === 'express' ? 49.90 : 0;
    const subtotal = parseFloat(cartTotal) || 0;
    const total = (subtotal + shippingCost).toFixed(2);

    if (loading) {
        return (
            <>
                <style>{css}</style>
                <div className="co-page"><div className="co-wrap"><div className="co-loading"><div className="co-spinner" /><p>Yükleniyor...</p></div></div></div>
            </>
        );
    }

    if (checkoutHtml) {
        return (
            <>
                <style>{css}</style>
                <div className="co-page">
                    <div className="co-wrap">
                        <div className="co-nav">
                            <span className="co-breadcrumb">Sepet &rsaquo; Adres &rsaquo; <strong>Ödeme</strong></span>
                        </div>
                        <div className="co-iyzico-wrap">
                            <h2>Ödeme Bilgileri</h2>
                            <p className="co-iyzico-sub">Kart bilgilerinizi güvenle girin</p>
                            <IyzicoForm html={checkoutHtml} />
                            <div className="co-secure-footer">🔒 iyzico güvencesiyle 256-bit SSL şifrelemesi</div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{css}</style>
            <div className="co-page">
                <div className="co-wrap">
                    {/* Breadcrumb */}
                    <div className="co-nav">
                        <span className="co-breadcrumb">Sepet &rsaquo; <strong>Adres</strong> &rsaquo; Ödeme</span>
                    </div>

                    <div className="co-grid">
                        {/* LEFT — FORM */}
                        <div className="co-left">
                            <form onSubmit={handleSubmit}>
                                {/* SHIPPING ADDRESS */}
                                <h2 className="co-section-title">Teslimat Adresi</h2>

                                <div className="co-row">
                                    <div className="co-field">
                                        <label>Ad <span className="req">*</span></label>
                                        <input type="text" name="firstName" placeholder="Adınız" value={formData.firstName} onChange={handleInputChange} required />
                                    </div>
                                    <div className="co-field">
                                        <label>Soyad <span className="req">*</span></label>
                                        <input type="text" name="lastName" placeholder="Soyadınız" value={formData.lastName} onChange={handleInputChange} required />
                                    </div>
                                </div>

                                <div className="co-row">
                                    <div className="co-field">
                                        <label>E-posta <span className="req">*</span></label>
                                        <input type="email" name="email" placeholder="ornek@email.com" value={formData.email} onChange={handleInputChange} required />
                                    </div>
                                    <div className="co-field">
                                        <label>Telefon <span className="req">*</span></label>
                                        <input type="tel" name="phone" placeholder="+90 5XX XXX XX XX" value={formData.phone} onChange={handleInputChange} required />
                                    </div>
                                </div>

                                <div className="co-row">
                                    <div className="co-field">
                                        <label>Şehir <span className="req">*</span></label>
                                        <input type="text" name="city" placeholder="İstanbul" value={formData.city} onChange={handleInputChange} required />
                                    </div>
                                    <div className="co-field">
                                        <label>İlçe</label>
                                        <input type="text" name="state" placeholder="Kadıköy" value={formData.state} onChange={handleInputChange} />
                                    </div>
                                    <div className="co-field co-field-sm">
                                        <label>Posta Kodu</label>
                                        <input type="text" name="zipCode" placeholder="34000" value={formData.zipCode} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className="co-field">
                                    <label>Adres <span className="req">*</span></label>
                                    <textarea name="address" placeholder="Açık teslimat adresinizi girin..." rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required />
                                </div>

                                {/* SHIPPING METHOD */}
                                <h2 className="co-section-title" style={{ marginTop: 36 }}>Kargo Yöntemi</h2>

                                <div className="co-shipping-options">
                                    <label className={`co-shipping-opt ${shippingMethod === 'free' ? 'active' : ''}`}>
                                        <input type="radio" name="shipping" value="free" checked={shippingMethod === 'free'} onChange={() => setShippingMethod('free')} />
                                        <div className="co-ship-icon">📦</div>
                                        <div className="co-ship-info">
                                            <strong>Ücretsiz Kargo</strong>
                                            <span>7-10 İş Günü</span>
                                        </div>
                                        <div className="co-ship-price">Ücretsiz</div>
                                    </label>

                                    <label className={`co-shipping-opt ${shippingMethod === 'express' ? 'active' : ''}`}>
                                        <input type="radio" name="shipping" value="express" checked={shippingMethod === 'express'} onChange={() => setShippingMethod('express')} />
                                        <div className="co-ship-icon">🚀</div>
                                        <div className="co-ship-info">
                                            <strong>Hızlı Kargo</strong>
                                            <span>1-3 İş Günü</span>
                                        </div>
                                        <div className="co-ship-price">₺49,90</div>
                                    </label>
                                </div>

                                {/* MOBILE PAY — hidden on desktop */}
                                <button className={`co-pay-btn co-pay-mobile ${submitting ? 'disabled' : ''}`} type="submit" disabled={submitting}>
                                    {submitting ? 'İşleniyor...' : `Ödemeye Geç →`}
                                </button>
                            </form>
                        </div>

                        {/* RIGHT — CART SUMMARY */}
                        <div className="co-right">
                            <div className="co-summary-card">
                                <h2 className="co-summary-title">Sepetiniz</h2>

                                {cartItems.length === 0 ? (
                                    <div className="co-empty">
                                        <p>Sepetiniz boş</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="co-items">
                                            {cartItems.map((item, i) => (
                                                <div key={i} className="co-item">
                                                    <div className="co-item-img">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} />
                                                        ) : (
                                                            <div className="co-item-placeholder">📦</div>
                                                        )}
                                                        {item.quantity > 1 && <span className="co-item-qty">{item.quantity}</span>}
                                                    </div>
                                                    <div className="co-item-info">
                                                        <div className="co-item-name">{item.name}</div>
                                                        {item.variant && <div className="co-item-variant">{item.variant}</div>}
                                                    </div>
                                                    <div className="co-item-price">₺{(parseFloat(item.price) * item.quantity).toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Discount Code */}
                                        <div className="co-discount">
                                            <input type="text" placeholder="İndirim kodu" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
                                            <button type="button" className="co-discount-btn">Uygula</button>
                                        </div>

                                        {/* Totals */}
                                        <div className="co-totals">
                                            <div className="co-total-row">
                                                <span>Ara Toplam</span>
                                                <span>₺{subtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="co-total-row">
                                                <span>Kargo</span>
                                                <span>{shippingCost === 0 ? 'Ücretsiz' : `₺${shippingCost.toFixed(2)}`}</span>
                                            </div>
                                            <div className="co-total-row">
                                                <span>Tahmini KDV</span>
                                                <span>₺{(subtotal * 0.20).toFixed(2)}</span>
                                            </div>
                                            <div className="co-total-row co-total-final">
                                                <span>Toplam</span>
                                                <span>₺{total}</span>
                                            </div>
                                        </div>

                                        {/* Pay Button — desktop */}
                                        <button className={`co-pay-btn ${submitting ? 'disabled' : ''}`} type="button" disabled={submitting}
                                            onClick={() => document.querySelector('form')?.requestSubmit()}>
                                            {submitting ? 'İşleniyor...' : 'Ödemeye Geç'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

.co-page {
    min-height: 100vh;
    background: #f7f7f8;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1a1a2e;
}

.co-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
}

/* NAV */
.co-nav {
    padding: 20px 0;
    border-bottom: 1px solid #e8e8ec;
    margin-bottom: 36px;
}
.co-breadcrumb {
    font-size: 13px;
    color: #999;
}
.co-breadcrumb strong {
    color: #1a1a2e;
}

/* GRID */
.co-grid {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 48px;
    padding-bottom: 60px;
}

/* LEFT */
.co-section-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 20px;
    color: #1a1a2e;
}

.co-row {
    display: flex;
    gap: 16px;
    margin-bottom: 0;
}

.co-field {
    flex: 1;
    margin-bottom: 18px;
}
.co-field-sm { max-width: 140px; }

.co-field label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #555;
    margin-bottom: 6px;
}
.req { color: #e53935; }

.co-field input,
.co-field textarea {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    color: #1a1a2e;
    background: #fff;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.co-field input:focus,
.co-field textarea:focus {
    border-color: #1a1a2e;
    box-shadow: 0 0 0 3px rgba(26,26,46,0.06);
}
.co-field input::placeholder,
.co-field textarea::placeholder {
    color: #bbb;
}
.co-field textarea {
    resize: vertical;
}

/* SHIPPING OPTIONS */
.co-shipping-options {
    display: flex;
    gap: 16px;
}
.co-shipping-opt {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1.5px solid #e0e0e4;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    background: #fff;
}
.co-shipping-opt:hover {
    border-color: #ccc;
}
.co-shipping-opt.active {
    border-color: #1a1a2e;
    background: #fafaff;
}
.co-shipping-opt input { display: none; }
.co-ship-icon { font-size: 24px; }
.co-ship-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}
.co-ship-info strong {
    font-size: 14px;
    font-weight: 600;
}
.co-ship-info span {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
}
.co-ship-price {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
}

/* RIGHT — SUMMARY */
.co-summary-card {
    background: #fff;
    border: 1px solid #e8e8ec;
    border-radius: 12px;
    padding: 28px;
    position: sticky;
    top: 24px;
}
.co-summary-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #eee;
}

/* Cart Items */
.co-items {
    margin-bottom: 20px;
}
.co-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f3;
}
.co-item:last-child { border-bottom: none; }
.co-item-img {
    width: 56px; height: 56px;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f7;
    flex-shrink: 0;
    position: relative;
}
.co-item-img img {
    width: 100%; height: 100%;
    object-fit: cover;
}
.co-item-placeholder {
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
}
.co-item-qty {
    position: absolute;
    top: -6px; right: -6px;
    width: 20px; height: 20px;
    background: #1a1a2e;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}
.co-item-info { flex: 1; min-width: 0; }
.co-item-name {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.co-item-variant {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
}
.co-item-price {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    white-space: nowrap;
}

/* Discount */
.co-discount {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #eee;
}
.co-discount input {
    flex: 1;
    padding: 10px 14px;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    outline: none;
    color: #1a1a2e;
    transition: border-color 0.2s;
}
.co-discount input:focus { border-color: #1a1a2e; }
.co-discount input::placeholder { color: #bbb; }
.co-discount-btn {
    padding: 10px 20px;
    background: #f0f0f3;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    color: #1a1a2e;
    transition: all 0.2s;
}
.co-discount-btn:hover {
    background: #e8e8ec;
}

/* Totals */
.co-totals { margin-bottom: 20px; }
.co-total-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 14px;
    color: #666;
}
.co-total-final {
    padding-top: 14px;
    margin-top: 10px;
    border-top: 1.5px solid #eee;
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
}

/* Pay Button */
.co-pay-btn {
    width: 100%;
    padding: 15px;
    background: #1a1a2e;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.3px;
}
.co-pay-btn:hover {
    background: #2d2d4e;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26,26,46,0.2);
}
.co-pay-btn.disabled {
    background: #888;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

/* Mobile Pay Btn — form'un altinda */
.co-pay-mobile {
    display: none;
    margin-top: 32px;
}

/* LOADING */
.co-loading { text-align: center; padding: 100px 20px; }
.co-spinner {
    width: 36px; height: 36px;
    border: 3px solid #eee;
    border-top-color: #1a1a2e;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto 14px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.co-loading p { color: #999; font-size: 14px; }

/* IYZICO WRAP */
.co-iyzico-wrap {
    max-width: 600px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #e8e8ec;
    border-radius: 12px;
    padding: 32px;
}
.co-iyzico-wrap h2 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 4px;
}
.co-iyzico-sub {
    color: #999;
    font-size: 14px;
    margin-bottom: 24px;
}
.co-secure-footer {
    text-align: center;
    color: #999;
    font-size: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #eee;
}

/* EMPTY */
.co-empty { text-align: center; padding: 40px 0; color: #999; }

/* RESPONSIVE */
@media (max-width: 800px) {
    .co-grid {
        grid-template-columns: 1fr;
        gap: 24px;
    }
    .co-right { order: -1; }
    .co-summary-card { position: static; }
    .co-row { flex-direction: column; gap: 0; }
    .co-field-sm { max-width: none; }
    .co-shipping-options { flex-direction: column; gap: 10px; }
    .co-pay-mobile { display: block; }
    .co-right .co-pay-btn { display: none; }
}
`;
