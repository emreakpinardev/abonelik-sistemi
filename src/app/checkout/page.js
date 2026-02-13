'use client';

import { useState, useEffect, useRef } from 'react';

// iyzico formunu script'leriyle birlikte render eden bileşen
function IyzicoForm({ html }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !html) return;

        // HTML'i container'a ekle
        containerRef.current.innerHTML = html;

        // Script tag'lerini bul ve çalıştır
        const scripts = containerRef.current.querySelectorAll('script');
        scripts.forEach((oldScript) => {
            const newScript = document.createElement('script');
            // Attributeları kopyala
            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            // İnline script içeriğini kopyala
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }, [html]);

    return <div ref={containerRef} className="iyzico-form-wrapper" />;
}

export default function CheckoutPage() {
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [checkoutHtml, setCheckoutHtml] = useState('');
    const [paymentType, setPaymentType] = useState('subscription');
    const [productInfo, setProductInfo] = useState({});
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        customerCity: '',
        customerIdentityNumber: '',
    });

    // URL parametrelerini oku ve planlari yukle
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type') || 'subscription';
        setPaymentType(type);

        if (type === 'single') {
            setProductInfo({
                id: params.get('product_id') || '',
                name: params.get('product_name') || 'Ürün',
                price: params.get('product_price') || '',
                variantId: params.get('variant_id') || '',
            });
            setLoading(false);
        } else {
            fetchPlans();
        }
    }, []);

    async function fetchPlans() {
        try {
            const res = await fetch('/api/subscription/create');
            const data = await res.json();
            setPlans(data.plans || []);
        } catch (err) {
            console.error('Plan yükleme hatası:', err);
        } finally {
            setLoading(false);
        }
    }

    function handleInputChange(e) {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (paymentType === 'subscription' && !selectedPlan) {
            alert('Lütfen bir plan seçin');
            return;
        }

        if (paymentType === 'single' && !productInfo.price) {
            alert('Ürün fiyatı bulunamadı');
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                type: paymentType,
                ...formData,
            };

            if (paymentType === 'subscription') {
                payload.planId = selectedPlan.id;
            } else {
                payload.productId = productInfo.id;
                payload.productName = productInfo.name;
                payload.productPrice = productInfo.price;
                payload.variantId = productInfo.variantId;
            }

            const res = await fetch('/api/iyzico/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            let data;
            const text = await res.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON parse error:', e, 'Response text:', text);
                throw new Error(`Server response (${res.status}): ${text.substring(0, 100)}...`);
            }

            if (data.success && data.checkoutFormContent) {
                // iyzico checkout formunu göster
                setCheckoutHtml(data.checkoutFormContent);
            } else {
                const errorMsg = [
                    data.error,
                    data.details && `Detay: ${data.details}`,
                    data.errorCode && `Kod: ${data.errorCode}`,
                ].filter(Boolean).join('\n');
                alert(errorMsg || 'Bir hata oluştu');
                console.error('iyzico full response:', data);
            }
        } catch (err) {
            console.error('Checkout hatası:', err);
            alert('Bir hata oluştu, lütfen tekrar deneyin');
        } finally {
            setSubmitting(false);
        }
    }

    function getIntervalText(interval) {
        switch (interval) {
            case 'MONTHLY': return '/ay';
            case 'QUARTERLY': return '/3 ay';
            case 'YEARLY': return '/yıl';
            case 'WEEKLY': return '/hafta';
            default: return '/ay';
        }
    }

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    // iyzico checkout formu gösteriliyorsa
    if (checkoutHtml) {
        return (
            <div className="page">
                <div className="container">
                    <div className="page-header">
                        <h1>💳 Ödeme</h1>
                        <p>Kart bilgilerinizi girerek aboneliğinizi başlatın</p>
                    </div>
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                        <div className="card">
                            <div className="card-header">
                                <h3>Güvenli Ödeme - iyzico</h3>
                                <span className="badge badge-active">🔒 SSL</span>
                            </div>
                            <IyzicoForm html={checkoutHtml} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>🔄 Abonelik Başlat</h1>
                    <p>Size en uygun planı seçin ve hemen başlayın</p>
                </div>

                {/* Plan Seçimi */}
                {plans.length > 0 ? (
                    <div className="plans-grid">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
                                onClick={() => setSelectedPlan(plan)}
                            >
                                <div className="plan-check"></div>
                                <div className="plan-name">{plan.name}</div>
                                {plan.description && (
                                    <div className="plan-desc">{plan.description}</div>
                                )}
                                <div className="plan-price">
                                    {plan.price.toLocaleString('tr-TR')}₺
                                    <span>{getIntervalText(plan.interval)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card" style={{ textAlign: 'center', padding: 48, marginBottom: 32 }}>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Henüz abonelik planı oluşturulmamış. Lütfen admin panelinden plan ekleyin.
                        </p>
                    </div>
                )}

                {/* Müşteri Bilgileri Formu */}
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="card">
                            <div className="card-header">
                                <h3>📋 Bilgileriniz</h3>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Ad Soyad *</label>
                                    <input
                                        type="text"
                                        name="customerName"
                                        value={formData.customerName}
                                        onChange={handleInputChange}
                                        placeholder="Ad Soyad"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>E-posta *</label>
                                    <input
                                        type="email"
                                        name="customerEmail"
                                        value={formData.customerEmail}
                                        onChange={handleInputChange}
                                        placeholder="ornek@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Telefon</label>
                                    <input
                                        type="tel"
                                        name="customerPhone"
                                        value={formData.customerPhone}
                                        onChange={handleInputChange}
                                        placeholder="+90 5XX XXX XX XX"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>TC Kimlik No</label>
                                    <input
                                        type="text"
                                        name="customerIdentityNumber"
                                        value={formData.customerIdentityNumber}
                                        onChange={handleInputChange}
                                        placeholder="XXXXXXXXXXX"
                                        maxLength={11}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Adres</label>
                                <input
                                    type="text"
                                    name="customerAddress"
                                    value={formData.customerAddress}
                                    onChange={handleInputChange}
                                    placeholder="Mahalle, Sokak, No"
                                />
                            </div>

                            <div className="form-group">
                                <label>Şehir</label>
                                <input
                                    type="text"
                                    name="customerCity"
                                    value={formData.customerCity}
                                    onChange={handleInputChange}
                                    placeholder="İstanbul"
                                />
                            </div>
                        </div>

                        {/* Özet ve Ödeme Butonu */}
                        {selectedPlan && (
                            <div className="card" style={{ marginTop: 24 }}>
                                <div className="card-header">
                                    <h3>📝 Sipariş Özeti</h3>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <span>{selectedPlan.name}</span>
                                    <strong style={{ fontSize: '1.2rem' }}>
                                        {selectedPlan.price.toLocaleString('tr-TR')}₺{getIntervalText(selectedPlan.interval)}
                                    </strong>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
                                    Aboneliğiniz her dönem sonunda otomatik olarak yenilenir.
                                    İstediğiniz zaman iptal edebilirsiniz.
                                </p>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-block"
                                    disabled={submitting}
                                >
                                    {submitting ? '⏳ İşleniyor...' : '💳 Ödemeye Geç'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
