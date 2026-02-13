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

    // URL'deki sepet bilgilerini oku
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

        if (cartItems.length === 0) {
            alert('Sepetiniz boş');
            return;
        }

        if (!formData.customerName || !formData.customerEmail || !formData.customerPhone || !formData.customerAddress || !formData.customerCity) {
            alert('Lütfen tüm alanları doldurun');
            return;
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
                    cartItems: cartItems,
                    ...formData,
                }),
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON parse error:', e);
                throw new Error(`Sunucu hatası (${res.status})`);
            }

            if (data.success && data.checkoutFormContent) {
                setCheckoutHtml(data.checkoutFormContent);
            } else {
                alert(data.error || 'Ödeme başlatılamadı');
                console.error('iyzico response:', data);
            }
        } catch (err) {
            console.error('Checkout hatası:', err);
            alert('Bir hata oluştu, lütfen tekrar deneyin');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={styles.loading}>Yükleniyor...</div>
                </div>
            </div>
        );
    }

    // iyzico odeme formu
    if (checkoutHtml) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <h1 style={styles.title}>💳 Ödeme</h1>
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3>🔒 Güvenli Ödeme - iyzico</h3>
                            <span style={styles.sslBadge}>🔒 SSL</span>
                        </div>
                        <IyzicoForm html={checkoutHtml} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                <h1 style={styles.title}>💳 Ödeme</h1>
                <p style={styles.subtitle}>Sipariş bilgilerinizi kontrol edin ve ödemenizi tamamlayın</p>

                {/* SEPET OZETI */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>🛒 Sipariş Özeti</h2>

                    {cartItems.length === 0 ? (
                        <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>
                            Sepetiniz boş. Lütfen mağazadan ürün ekleyin.
                        </p>
                    ) : (
                        <>
                            {cartItems.map((item, index) => (
                                <div key={index} style={styles.cartItem}>
                                    <div style={styles.cartItemInfo}>
                                        <div style={styles.cartItemName}>{item.name}</div>
                                        {item.variant && <div style={styles.cartItemVariant}>{item.variant}</div>}
                                        <div style={styles.cartItemQty}>Adet: {item.quantity}</div>
                                    </div>
                                    <div style={styles.cartItemPrice}>
                                        {(parseFloat(item.price) * item.quantity).toFixed(2)} ₺
                                    </div>
                                </div>
                            ))}
                            <div style={styles.totalRow}>
                                <span style={styles.totalLabel}>Toplam</span>
                                <span style={styles.totalPrice}>{cartTotal} ₺</span>
                            </div>
                        </>
                    )}
                </div>

                {/* MUSTERI BILGILERI */}
                {cartItems.length > 0 && (
                    <form onSubmit={handleSubmit}>
                        <div style={styles.card}>
                            <h2 style={styles.cardTitle}>👤 Bilgileriniz</h2>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Ad Soyad</label>
                                <input style={styles.input} type="text" name="customerName" placeholder="Adınız Soyadınız" value={formData.customerName} onChange={handleInputChange} required />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>E-posta</label>
                                <input style={styles.input} type="email" name="customerEmail" placeholder="ornek@email.com" value={formData.customerEmail} onChange={handleInputChange} required />
                            </div>

                            <div style={styles.formRow}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Telefon</label>
                                    <input style={styles.input} type="tel" name="customerPhone" placeholder="+90 5XX XXX XX XX" value={formData.customerPhone} onChange={handleInputChange} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Şehir</label>
                                    <input style={styles.input} type="text" name="customerCity" placeholder="İstanbul" value={formData.customerCity} onChange={handleInputChange} required />
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Adres</label>
                                <input style={styles.input} type="text" name="customerAddress" placeholder="Açık adresiniz" value={formData.customerAddress} onChange={handleInputChange} required />
                            </div>

                            <button style={{ ...styles.payBtn, ...(submitting ? styles.payBtnDisabled : {}) }} type="submit" disabled={submitting}>
                                {submitting ? '⏳ İşleniyor...' : `💳 ${cartTotal} ₺ Öde`}
                            </button>
                        </div>

                        <div style={styles.secureNote}>
                            🔒 256-bit SSL ile güvenli ödeme • iyzico altyapısı
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)',
        padding: '40px 20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#fff',
    },
    container: {
        maxWidth: 600,
        margin: '0 auto',
    },
    title: {
        textAlign: 'center',
        fontSize: 28,
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        color: '#aaa',
        marginBottom: 32,
        fontSize: 15,
    },
    card: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: 24,
        marginBottom: 20,
        backdropFilter: 'blur(10px)',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    sslBadge: {
        background: 'rgba(46,125,50,0.2)',
        color: '#66bb6a',
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
    },
    cartItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    cartItemInfo: { flex: 1 },
    cartItemName: { fontWeight: 600, fontSize: 15 },
    cartItemVariant: { color: '#aaa', fontSize: 13, marginTop: 2 },
    cartItemQty: { color: '#888', fontSize: 13, marginTop: 4 },
    cartItemPrice: { fontWeight: 700, fontSize: 16, color: '#7c8cf8' },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        marginTop: 8,
    },
    totalLabel: { fontSize: 18, fontWeight: 600 },
    totalPrice: { fontSize: 24, fontWeight: 800, color: '#7c8cf8' },
    formGroup: { marginBottom: 14, flex: 1 },
    formRow: { display: 'flex', gap: 12 },
    label: {
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 6,
        color: '#ccc',
    },
    input: {
        width: '100%',
        padding: '11px 14px',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10,
        fontSize: 14,
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        boxSizing: 'border-box',
        outline: 'none',
    },
    payBtn: {
        width: '100%',
        padding: 14,
        background: 'linear-gradient(135deg, #5c6ac4, #7c8cf8)',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        fontSize: 17,
        fontWeight: 700,
        cursor: 'pointer',
        marginTop: 12,
    },
    payBtnDisabled: {
        background: '#555',
        cursor: 'not-allowed',
    },
    secureNote: {
        textAlign: 'center',
        color: '#888',
        fontSize: 12,
        marginTop: 16,
    },
    loading: {
        textAlign: 'center',
        padding: 60,
        color: '#aaa',
        fontSize: 16,
    },
};
