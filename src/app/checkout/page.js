'use client';

import { useState, useEffect, useRef } from 'react';

const ALLOWED_CITIES = [
    'Istanbul', 'Izmir', 'Ankara', 'Balikesir', 'Bartin', 'Bilecik', 'Bolu', 'Bursa',
    'Canakkale', 'Cankiri', 'Edirne', 'Eskisehir', 'Karabuk', 'Kastamonu',
    'Kirikkale', 'Kirklareli', 'Kocaeli', 'Kutahya', 'Manisa', 'Sakarya',
    'Tekirdag', 'Usak', 'Yalova', 'Zonguldak'
];



function Icon({ name, size = 20, className = '' }) {
    return <span className={`material-symbols-rounded co-icon ${className}`} style={{ fontSize: size }}>{name}</span>;
}

export default function CheckoutPage() {
    const [cartData, setCartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [shippingMethod, setShippingMethod] = useState('free');
    const [shippingRates, setShippingRates] = useState([]);
    const [purchaseType, setPurchaseType] = useState('single');
    const [subscriptionFrequency, setSubscriptionFrequency] = useState('');
    const [subscriptionFrequencyLabel, setSubscriptionFrequencyLabel] = useState('');
    const [discountCode, setDiscountCode] = useState('');
    const [shopLogo, setShopLogo] = useState('/api/shopify/logo');
    const [planId, setPlanId] = useState('');
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        city: '', state: '', zipCode: '', address: '',
    });

    function normalizeFrequencyInput(freq, label) {
        let normalizedFreq = typeof freq === 'string' ? freq : '';
        let normalizedLabel = typeof label === 'string' ? label : '';
        const labelText = normalizedLabel.toLowerCase();

        // 1) Label text has priority (e.g. "3 haftada bir")
        const labelMatch = labelText.match(/(\d+)\s*(hafta|week|weeks|ay|month|months)/i);
        if (labelMatch) {
            let count = parseInt(labelMatch[1], 10) || 1;
            if (count < 1 || count > 12) count = 1;
            const isWeek = /(hafta|week|weeks)/i.test(labelMatch[2]);
            return {
                frequency: `${count}_${isWeek ? 'week' : 'month'}`,
                label: `${count} ${isWeek ? 'haftada bir' : 'ayda bir'}`,
            };
        }

        if (/iki\s*hafta|2\s*hafta|2\s*haftada|every\s*2\s*week|bi.?weekly/i.test(labelText)) {
            return { frequency: '2_week', label: '2 haftada bir' };
        }
        if (/uc\s*hafta|u?\u00fc?\u00e7\s*hafta|3\s*hafta|3\s*haftada|every\s*3\s*week/i.test(labelText)) {
            return { frequency: '3_week', label: '3 haftada bir' };
        }
        if (/dort\s*hafta|do?\u00f6?\u00fcrt\s*hafta|4\s*hafta|4\s*haftada|every\s*4\s*week/i.test(labelText)) {
            return { frequency: '4_week', label: '4 haftada bir' };
        }
        if (/iki\s*ay|2\s*ay|2\s*ayda|every\s*2\s*month/i.test(labelText)) {
            return { frequency: '2_month', label: '2 ayda bir' };
        }
        if (/uc\s*ay|u?\u00fc?\u00e7\s*ay|3\s*ay|3\s*ayda|every\s*3\s*month|quarterly/i.test(labelText)) {
            return { frequency: '3_month', label: '3 ayda bir' };
        }

        // 2) Canonical code fallback (e.g. "3_week")
        const match = normalizedFreq.match(/^(\d+)_(week|month)$/i);
        if (match) {
            let count = parseInt(match[1], 10) || 1;
            const unit = String(match[2]).toLowerCase();
            if (count < 1 || count > 12) count = 1;
            normalizedFreq = `${count}_${unit}`;
            normalizedLabel = `${count} ${unit === 'week' ? 'haftada bir' : 'ayda bir'}`;
            return { frequency: normalizedFreq, label: normalizedLabel };
        }

        if (/hafta|week/.test(labelText)) {
            return { frequency: '1_week', label: '1 haftada bir' };
        }
        if (/(^|\s)ay|month/.test(labelText)) {
            return { frequency: '1_month', label: '1 ayda bir' };
        }

        return { frequency: '', label: '' };
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const cartParam = params.get('cart');

        if (cartParam) {
            // Base64 encoded cart data (from Shopify redirects)
            try {
                const decoded = JSON.parse(decodeURIComponent(atob(decodeURIComponent(cartParam))));
                setCartData(decoded);
                if (decoded.purchase_type) setPurchaseType(decoded.purchase_type);
                if (decoded.subscription_frequency) {
                    const normalized = normalizeFrequencyInput(
                        decoded.subscription_frequency,
                        decoded.subscription_frequency_label || ''
                    );
                    setSubscriptionFrequency(normalized.frequency || '');
                    setSubscriptionFrequencyLabel(normalized.label || '');
                }
                if (decoded.plan_id) setPlanId(decoded.plan_id);
                if (decoded.shop_logo) setShopLogo(decoded.shop_logo);
                if (decoded.customer_city) {
                    setFormData(prev => ({
                        ...prev,
                        city: decoded.customer_city || prev.city,
                        state: decoded.customer_district || prev.state,
                    }));
                }
            } catch (e) {
                console.error('Sepet verisi okunamadi:', e);
            }
        } else {
            // Direct URL params (from Shopify buttons script)
            const type = params.get('type');
            const productId = params.get('product_id');
            const productName = params.get('product_name');
            const productPrice = params.get('product_price');
            const variantId = params.get('variant_id');
            const subFreq = params.get('subscription_frequency');
            const subFreqLabel = params.get('subscription_frequency_label');
            const directPlanId = params.get('plan_id');

            if (type) setPurchaseType(type);
            if (directPlanId) setPlanId(directPlanId);
            if (subFreq || subFreqLabel) {
                const normalized = normalizeFrequencyInput(subFreq || '', subFreqLabel || '');
                if (normalized.frequency) setSubscriptionFrequency(normalized.frequency);
                if (normalized.label) setSubscriptionFrequencyLabel(normalized.label);
            }

            if (productId || productName) {
                setCartData({
                    items: [{
                        id: productId || '',
                        name: productName || 'ÃœrÃ¼n',
                        price: parseFloat(productPrice) || 0,
                        quantity: 1,
                        variant_id: variantId || '',
                    }],
                    total: productPrice || '0',
                    purchase_type: type || 'single',
                    subscription_frequency: subFreq || '',
                    subscription_frequency_label: subFreqLabel || '',
                    plan_id: directPlanId || '',
                });
            }
        }
        setLoading(false);
    }, []);

    // Shopify kargo yontemlerini cek - cartData hazir olunca hemen cek
    useEffect(() => {
        if (!cartData) return;
        fetchShippingRates();
    }, [cartData, formData.city]);

    async function fetchShippingRates() {
        try {
            const res = await fetch(`/api/shopify/shipping-rates?city=${encodeURIComponent(formData.city)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.rates && data.rates.length > 0) {
                    setShippingRates(data.rates);
                    setShippingMethod(data.rates[0].id);
                }
            }
        } catch (e) {
            console.error('Kargo bilgileri alinamadi:', e);
        }
    }

    const items = cartData?.items || [];
    const subtotal = parseFloat(cartData?.total || 0);
    const selectedRate = shippingRates.find(r => r.id === shippingMethod);
    const shippingCost = selectedRate ? parseFloat(selectedRate.price) : (shippingMethod === 'express' ? 49.90 : 0);
    const total = (subtotal + shippingCost).toFixed(2);
    const isSubscription = purchaseType === 'subscription';

    function isTechnicalVariantLabel(label) {
        if (!label) return true;
        const v = String(label).trim().toLowerCase();
        return (
            v === 'default title' ||
            v.startsWith('sub-') ||
            v.startsWith('subscription ') ||
            v.includes('sub-weekly') ||
            v.includes('sub-monthly')
        );
    }

    function prettySellingPlanName(rawName) {
        const raw = String(rawName || '').trim();
        if (!raw) return '';
        if (subscriptionFrequencyLabel) return `Abonelik - ${subscriptionFrequencyLabel}`;
        if (subscriptionFrequency) return `Abonelik - ${getFrequencyText()}`;
        return raw;
    }

    function getNextPaymentDate() {
        const now = new Date();
        const normalized = normalizeFrequencyInput(subscriptionFrequency, subscriptionFrequencyLabel);
        const freq = normalized.frequency || '1_month';
        const parts = freq.split('_');
        const count = parseInt(parts[0]) || 1;
        const unit = parts[1] || 'month';
        if (unit === 'week') {
            now.setDate(now.getDate() + count * 7);
        } else {
            now.setMonth(now.getMonth() + count);
        }
        return now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function getFrequencyText() {
        const normalized = normalizeFrequencyInput(subscriptionFrequency, subscriptionFrequencyLabel);
        if (normalized.label) return normalized.label;
        const freq = normalized.frequency;
        if (!freq) return 'Aylik';
        const m = String(freq).match(/^(\d+)_(week|month)$/i);
        if (m) {
            const count = parseInt(m[1], 10) || 1;
            const unit = m[2].toLowerCase();
            return `${count} ${unit === 'week' ? 'haftada bir' : 'ayda bir'}`;
        }
        return 'Aylik';
    }

    function handleInputChange(e) {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (items.length === 0) { alert('Sepetiniz boÅŸ'); return; }
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.city || !formData.address) {
            alert('LÃ¼tfen tÃ¼m zorunlu alanlarÄ± doldurun'); return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/iyzico/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: purchaseType,
                    planId,
                    productId: items.map(i => i.id).join(','),
                    productName: items.map(i => i.name).join(', '),
                    productPrice: total,
                    variantId: items.map(i => i.variant_id).join(','),
                    cartItems: items,
                    subscriptionFrequency,
                    shippingMethod,
                    shippingCost,
                    shopUrl: cartData?.shop_url,
                    customerName: formData.firstName + ' ' + formData.lastName,
                    customerEmail: formData.email,
                    customerPhone: formData.phone,
                    customerAddress: formData.address,
                    customerCity: formData.city,
                    customerZip: formData.zipCode,
                }),
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch (e) {
                alert(`Sunucu hatasÄ± (${res.status}): ${text.substring(0, 200)}`);
                setSubmitting(false);
                return;
            }
            if (data.success && data.paymentPageUrl) {
                // iyzico Ã¶deme sayfasÄ±na yÃ¶nlendir
                window.location.href = data.paymentPageUrl;
            } else {
                alert(`Hata: ${data.error || 'Bilinmeyen hata'}\nDetay: ${data.details || ''}`);
                setSubmitting(false);
            }
        } catch (err) {
            alert(`BaÄŸlantÄ± hatasÄ±: ${err.message}`);
            setSubmitting(false);
        }
    }

    const [cities, setCities] = useState([]);

    // Kargo gonderilen sehirleri Shopify'dan cek
    useEffect(() => {
        async function fetchCities() {
            try {
                const res = await fetch('/api/shopify/shipping-cities');
                if (res.ok) {
                    const data = await res.json();
                    const incoming = Array.isArray(data.cities) ? data.cities : [];
                    const filtered = incoming.filter(c => ALLOWED_CITIES.includes(c));
                    setCities(filtered.length ? filtered : ALLOWED_CITIES);
                } else {
                    setCities(ALLOWED_CITIES);
                }
            } catch (e) {
                console.error('Sehirler alinamadi:', e);
                setCities(ALLOWED_CITIES);
            }
        }
        fetchCities();
    }, []);

    if (loading) {
        return (<><style>{css}</style><div className="co-page"><div className="co-wrap"><div className="co-loading"><div className="co-spinner" /><p>YÃ¼kleniyor...</p></div></div></div></>);
    }

    // iyzico formu aÃ§Ä±kken â€” SAYFA Ä°Ã‡Ä°NDE gÃ¶ster (popup deÄŸil)


    return (
        <><style>{css}</style>
            <div className="co-page">
                <div className="co-wrap">
                    <div className="co-nav">
                        <img src={shopLogo} alt="Logo" className="co-logo" onError={(e) => { e.target.style.display = 'none'; }} />
                        <span className="co-breadcrumb">Sepet â€º <strong>Adres</strong> â€º Ã–deme</span>
                    </div>

                    {/* SATIN ALMA TIPI */}
                    <div className={`co-purchase-badge ${isSubscription ? 'sub' : 'single'}`}>
                        <Icon name={isSubscription ? 'autorenew' : 'shopping_cart'} size={22} />
                        <span className="co-purchase-badge-text">
                            {isSubscription ? 'Abonelik SipariÅŸi â€” DÃ¼zenli teslimat' : 'Tek Seferlik SipariÅŸ'}
                        </span>
                    </div>

                    {/* ABONELÄ°K BÄ°LGÄ° KUTUSU */}
                    {isSubscription && (
                        <div className="co-sub-details">
                            <div className="co-sub-details-title"><Icon name="event_note" size={18} /> Abonelik DetaylarÄ±</div>
                            <div className="co-sub-details-grid">
                                <div className="co-sub-detail-item">
                                    <span className="co-sub-detail-label">BugÃ¼nkÃ¼ Ã–deme</span>
                                    <span className="co-sub-detail-value">â‚º{total}</span>
                                </div>
                                <div className="co-sub-detail-item">
                                    <span className="co-sub-detail-label">Yenileme Periyodu</span>
                                    <span className="co-sub-detail-value">{getFrequencyText()}</span>
                                </div>
                                <div className="co-sub-detail-item">
                                    <span className="co-sub-detail-label">Sonraki Ã–deme</span>
                                    <span className="co-sub-detail-value">{getNextPaymentDate()}</span>
                                </div>
                                <div className="co-sub-detail-item">
                                    <span className="co-sub-detail-label">Yenileme TutarÄ±</span>
                                    <span className="co-sub-detail-value">â‚º{total} / {getFrequencyText().toLowerCase()}</span>
                                </div>
                            </div>
                            <div className="co-sub-details-note"><Icon name="verified_user" size={13} /> Ä°stediÄŸiniz zaman iptal edebilirsiniz. Kart bilgileriniz gÃ¼venle saklanÄ±r.</div>
                        </div>
                    )}

                    <div className="co-grid">
                        {/* LEFT â€” FORM */}
                        <div className="co-left">
                            <form onSubmit={handleSubmit}>
                                <h2 className="co-section-title"><Icon name="location_on" size={22} /> Teslimat Adresi</h2>
                                <div className="co-row">
                                    <div className="co-field"><label>Ad <span className="req">*</span></label><input type="text" name="firstName" placeholder="AdÄ±nÄ±z" value={formData.firstName} onChange={handleInputChange} required /></div>
                                    <div className="co-field"><label>Soyad <span className="req">*</span></label><input type="text" name="lastName" placeholder="SoyadÄ±nÄ±z" value={formData.lastName} onChange={handleInputChange} required /></div>
                                </div>
                                <div className="co-row">
                                    <div className="co-field"><label>E-posta <span className="req">*</span></label><input type="email" name="email" placeholder="ornek@email.com" value={formData.email} onChange={handleInputChange} required /></div>
                                    <div className="co-field"><label>Telefon <span className="req">*</span></label><input type="tel" name="phone" placeholder="+90 5XX XXX XX XX" value={formData.phone} onChange={handleInputChange} required /></div>
                                </div>
                                <div className="co-row">
                                    <div className="co-field">
                                        <label>Åžehir <span className="req">*</span></label>
                                        <select name="city" value={formData.city} onChange={handleInputChange} required className="co-select">
                                            <option value="">Åžehir seÃ§in</option>
                                            {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="co-field"><label>Ä°lÃ§e</label><input type="text" name="state" placeholder="Ä°lÃ§e" value={formData.state} onChange={handleInputChange} /></div>
                                    <div className="co-field co-field-sm"><label>Posta Kodu</label><input type="text" name="zipCode" placeholder="34000" value={formData.zipCode} onChange={handleInputChange} /></div>
                                </div>
                                <div className="co-field"><label>Adres <span className="req">*</span></label><textarea name="address" placeholder="AÃ§Ä±k teslimat adresinizi girin..." rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required /></div>

                                <h2 className="co-section-title" style={{ marginTop: 36 }}><Icon name="local_shipping" size={22} /> Kargo YÃ¶ntemi</h2>
                                <div className="co-shipping-options">
                                    {shippingRates.length > 0 ? (
                                        // Shopify'dan gelen kargo yontemleri
                                        shippingRates.map(rate => (
                                            <label key={rate.id} className={`co-shipping-opt ${shippingMethod === rate.id ? 'active' : ''}`}>
                                                <input type="radio" name="shipping" value={rate.id} checked={shippingMethod === rate.id} onChange={() => setShippingMethod(rate.id)} />
                                                <div className="co-ship-icon"><Icon name={parseFloat(rate.price) === 0 ? 'inventory_2' : 'local_shipping'} size={26} /></div>
                                                <div className="co-ship-info">
                                                    <strong>{rate.name}</strong>
                                                </div>
                                                <div className="co-ship-price">{parseFloat(rate.price) === 0 ? 'Ãœcretsiz' : `â‚º${parseFloat(rate.price).toFixed(2)}`}</div>
                                            </label>
                                        ))
                                    ) : (
                                        // Varsayilan kargo secenekleri
                                        <>
                                            <label className={`co-shipping-opt ${shippingMethod === 'free' ? 'active' : ''}`}>
                                                <input type="radio" name="shipping" value="free" checked={shippingMethod === 'free'} onChange={() => setShippingMethod('free')} />
                                                <div className="co-ship-icon"><Icon name="inventory_2" size={26} /></div>
                                                <div className="co-ship-info"><strong>Ãœcretsiz Kargo</strong></div>
                                                <div className="co-ship-price">Ãœcretsiz</div>
                                            </label>
                                            <label className={`co-shipping-opt ${shippingMethod === 'express' ? 'active' : ''}`}>
                                                <input type="radio" name="shipping" value="express" checked={shippingMethod === 'express'} onChange={() => setShippingMethod('express')} />
                                                <div className="co-ship-icon"><Icon name="local_shipping" size={26} /></div>
                                                <div className="co-ship-info"><strong>HÄ±zlÄ± Kargo</strong></div>
                                                <div className="co-ship-price">â‚º49,90</div>
                                            </label>
                                        </>
                                    )}
                                </div>

                                <h2 className="co-section-title" style={{ marginTop: 36 }}><Icon name="payment" size={22} /> Ã–deme YÃ¶ntemi</h2>
                                <div className="co-payment-method">
                                    <div className="co-pay-option active">
                                        <input type="radio" name="payment" checked readOnly />
                                        <div className="co-pay-info">
                                            <strong>iyzico ile Ã–de</strong>
                                            <span>Kredi / Banka KartÄ±</span>
                                        </div>
                                        <div className="co-pay-logos">
                                            <span className="co-iyzico-logo-text">iyzico</span>
                                        </div>
                                    </div>
                                </div>

                                <button className={`co-pay-btn ${submitting ? 'disabled' : ''}`} type="submit" disabled={submitting}>
                                    {submitting ? 'Ã–deme SayfasÄ±na YÃ¶nlendiriliyor...' : `Ã–demeye GeÃ§ â€” â‚º${total}`}
                                </button>
                            </form>
                        </div>

                        {/* RIGHT â€” CART SUMMARY */}
                        <div className="co-right">
                            <div className="co-summary-card">
                                <h2 className="co-summary-title"><Icon name="shopping_bag" size={20} /> Sepetiniz</h2>

                                {items.length === 0 ? (
                                    <div className="co-empty"><p>Sepetiniz boÅŸ</p></div>
                                ) : (
                                    <>
                                        <div className="co-items">
                                            {items.map((item, i) => (
                                                <div key={i} className="co-item">
                                                    <div className="co-item-img">
                                                        {item.image ? <img src={item.image} alt={item.name} /> : <div className="co-item-placeholder"><Icon name="inventory_2" size={22} /></div>}
                                                        {item.quantity > 1 && <span className="co-item-qty">{item.quantity}</span>}
                                                    </div>
                                                    <div className="co-item-info">
                                                        <div className="co-item-name">{item.name}</div>
                                                        {item.variant && !isTechnicalVariantLabel(item.variant) && <div className="co-item-variant">{item.variant}</div>}
                                                        {item.selling_plan && <div className="co-item-sub"><Icon name="autorenew" size={12} /> {prettySellingPlanName(item.selling_plan.name)}</div>}
                                                        <div className="co-item-meta">
                                                            {item.vendor && <span>{item.vendor}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="co-item-price">â‚º{item.line_price || (parseFloat(item.price) * item.quantity).toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="co-discount">
                                            <input type="text" placeholder="Ä°ndirim kodu" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
                                            <button type="button" className="co-discount-btn">Uygula</button>
                                        </div>

                                        <div className="co-totals">
                                            <div className="co-total-row"><span>Ara Toplam</span><span>â‚º{subtotal.toFixed(2)}</span></div>
                                            {parseFloat(cartData?.total_discount || 0) > 0 && (
                                                <div className="co-total-row co-discount-row"><span>Ä°ndirim</span><span>-â‚º{cartData.total_discount}</span></div>
                                            )}
                                            <div className="co-total-row"><span>Kargo</span><span>{shippingCost === 0 ? 'Ãœcretsiz' : `â‚º${shippingCost.toFixed(2)}`}</span></div>
                                            <div className="co-total-row"><span>Tahmini KDV (%20)</span><span>â‚º{(subtotal * 0.20).toFixed(2)}</span></div>
                                            <div className="co-total-row co-total-final"><span>Toplam</span><span>â‚º{total}</span></div>
                                        </div>

                                        <button className={`co-pay-btn co-pay-desktop ${submitting ? 'disabled' : ''}`} type="button" disabled={submitting}
                                            onClick={() => document.querySelector('form')?.requestSubmit()}>
                                            {submitting ? 'Ä°ÅŸleniyor...' : `Ã–demeye GeÃ§ â€” â‚º${total}`}
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="co-trust">
                                <div className="co-trust-item"><Icon name="lock" size={14} /> 256-bit SSL</div>
                                <div className="co-trust-item"><Icon name="verified_user" size={14} /> iyzico GÃ¼vence</div>
                                <div className="co-trust-item"><Icon name="undo" size={14} /> Kolay Ä°ade</div>
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
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
* { margin: 0; padding: 0; box-sizing: border-box; }

.co-icon { vertical-align: middle; line-height: 1; }

.co-page {
    min-height: 100vh;
    background: #f7f7f8;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1a1a2e;
}
.co-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

.co-nav { padding: 20px 0; border-bottom: 1px solid #e8e8ec; margin-bottom: 28px; display: flex; align-items: center; gap: 16px; }
.co-logo { height: 36px; width: auto; object-fit: contain; }
.co-breadcrumb { font-size: 13px; color: #999; }
.co-breadcrumb strong { color: #1a1a2e; }

/* Purchase Type Badge */
.co-purchase-badge { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-radius: 10px; margin-bottom: 12px; font-size: 14px; font-weight: 500; }
.co-purchase-badge.single { background: #f0f7ff; border: 1px solid #90caf9; color: #1565c0; }
.co-purchase-badge.sub { background: #fff8e1; border: 1px solid #ffe082; color: #e65100; }
.co-purchase-badge-text { flex: 1; }

/* Subscription Details Box */
.co-sub-details { background: #fafafa; border: 1px solid #e8e8ec; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
.co-sub-details-title { font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.co-sub-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.co-sub-detail-item { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: #fff; border-radius: 8px; border: 1px solid #f0f0f4; }
.co-sub-detail-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #999; font-weight: 500; }
.co-sub-detail-value { font-size: 15px; font-weight: 600; color: #1a1a2e; }
.co-sub-details-note { margin-top: 14px; font-size: 12px; color: #888; text-align: center; padding-top: 12px; border-top: 1px solid #f0f0f4; display: flex; align-items: center; justify-content: center; gap: 4px; }

.co-grid { display: grid; grid-template-columns: 1fr 400px; gap: 48px; padding-bottom: 60px; }
.co-section-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #1a1a2e; display: flex; align-items: center; gap: 8px; }
.co-row { display: flex; gap: 16px; }
.co-field { flex: 1; margin-bottom: 18px; }
.co-field-sm { max-width: 140px; }
.co-field label { display: block; font-size: 13px; font-weight: 500; color: #555; margin-bottom: 6px; }
.req { color: #e53935; }
.co-field input, .co-field textarea, .co-select {
    width: 100%; padding: 12px 14px; border: 1.5px solid #ddd; border-radius: 8px;
    font-size: 14px; font-family: 'Inter', sans-serif; color: #1a1a2e; background: #fff; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.co-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; cursor: pointer; }
.co-field input:focus, .co-field textarea:focus, .co-select:focus { border-color: #1a1a2e; box-shadow: 0 0 0 3px rgba(26,26,46,0.06); }
.co-field input::placeholder, .co-field textarea::placeholder { color: #bbb; }
.co-field textarea { resize: vertical; }

/* Shipping */
.co-shipping-options { display: flex; gap: 16px; flex-wrap: wrap; }
.co-shipping-opt { flex: 1; min-width: 200px; display: flex; align-items: center; gap: 12px; padding: 16px; border: 1.5px solid #e0e0e4; border-radius: 10px; cursor: pointer; transition: all 0.2s; background: #fff; }
.co-shipping-opt:hover { border-color: #ccc; }
.co-shipping-opt.active { border-color: #1a1a2e; background: #fafaff; }
.co-shipping-opt input { display: none; }
.co-ship-icon { color: #1a1a2e; display: flex; align-items: center; }
.co-ship-info { flex: 1; display: flex; flex-direction: column; }
.co-ship-info strong { font-size: 14px; font-weight: 600; }
.co-ship-info span { font-size: 12px; color: #999; margin-top: 2px; }
.co-ship-price { font-size: 14px; font-weight: 600; }

/* Payment Method */
.co-payment-method { display: flex; flex-direction: column; gap: 10px; }
.co-pay-option { display: flex; align-items: center; gap: 14px; padding: 16px; border: 1.5px solid #1a1a2e; border-radius: 10px; background: #fafaff; }
.co-pay-option input { accent-color: #1a1a2e; width: 18px; height: 18px; }
.co-pay-info { flex: 1; display: flex; flex-direction: column; }
.co-pay-info strong { font-size: 14px; }
.co-pay-info span { font-size: 12px; color: #999; margin-top: 2px; }
.co-pay-logos { display: flex; gap: 8px; align-items: center; }

/* Right Panel */
.co-summary-card { background: #fff; border: 1px solid #e8e8ec; border-radius: 12px; padding: 28px; position: sticky; top: 24px; }
.co-summary-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
.co-items { margin-bottom: 20px; }
.co-item { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #f0f0f3; }
.co-item:last-child { border-bottom: none; }
.co-item-img { width: 56px; height: 56px; border-radius: 8px; overflow: hidden; background: #f5f5f7; flex-shrink: 0; position: relative; }
.co-item-img img { width: 100%; height: 100%; object-fit: cover; }
.co-item-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #bbb; }
.co-item-qty { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; background: #1a1a2e; color: #fff; font-size: 11px; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.co-item-info { flex: 1; min-width: 0; }
.co-item-name { font-size: 14px; font-weight: 600; color: #1a1a2e; }
.co-item-variant { font-size: 12px; color: #999; margin-top: 2px; }
.co-item-sub { font-size: 11px; color: #e65100; background: #fff8e1; display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 4px; margin-top: 4px; }
.co-item-meta { display: flex; gap: 8px; margin-top: 3px; }
.co-item-meta span { font-size: 11px; color: #aaa; }
.co-item-price { font-size: 14px; font-weight: 600; color: #1a1a2e; white-space: nowrap; }

/* Order info on payment step */
.co-order-info { padding: 14px 0; margin-bottom: 14px; border-bottom: 1px solid #f0f0f3; }
.co-order-info-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; padding: 4px 0; }

.co-discount { display: flex; gap: 8px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
.co-discount input { flex: 1; padding: 10px 14px; border: 1.5px solid #ddd; border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; color: #1a1a2e; }
.co-discount input:focus { border-color: #1a1a2e; }
.co-discount input::placeholder { color: #bbb; }
.co-discount-btn { padding: 10px 20px; background: #f0f0f3; border: 1.5px solid #ddd; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer; color: #1a1a2e; transition: all 0.2s; }
.co-discount-btn:hover { background: #e8e8ec; }

.co-totals { margin-bottom: 20px; }
.co-total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #666; }
.co-discount-row span:last-child { color: #e53935; }
.co-total-final { padding-top: 14px; margin-top: 10px; border-top: 1.5px solid #eee; font-size: 18px; font-weight: 700; color: #1a1a2e; }

.co-pay-btn { width: 100%; padding: 15px; background: #1a1a2e; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.2s; }
.co-pay-btn:hover { background: #2d2d4e; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(26,26,46,0.2); }
.co-pay-btn.disabled { background: #888; cursor: not-allowed; transform: none; box-shadow: none; }
.co-pay-mobile { display: none; margin-top: 32px; }

.co-trust { display: flex; justify-content: center; gap: 16px; margin-top: 16px; }
.co-trust-item { font-size: 11px; color: #999; background: #fff; padding: 6px 12px; border-radius: 20px; border: 1px solid #eee; display: flex; align-items: center; gap: 4px; }

.co-empty { text-align: center; padding: 40px 0; color: #999; }

/* iyzico logo text */
.co-iyzico-logo-text { font-size: 16px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px; padding: 4px 10px; background: #f0f0f3; border-radius: 6px; }

/* iyzico sub text */
.co-iyzico-sub { color: #999; font-size: 14px; margin-bottom: 24px; margin-top: -12px; }
.co-secure-footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: center; gap: 4px; }

.co-loading { text-align: center; padding: 100px 20px; }
.co-spinner { width: 36px; height: 36px; border: 3px solid #eee; border-top-color: #1a1a2e; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 14px; }
@keyframes spin { to { transform: rotate(360deg); } }
.co-loading p { color: #999; font-size: 14px; }

@media (max-width: 800px) {
    .co-grid { grid-template-columns: 1fr; gap: 24px; }
    .co-right { order: -1; }
    .co-summary-card { position: static; }
    .co-row { flex-direction: column; gap: 0; }
    .co-field-sm { max-width: none; }
    .co-shipping-options { flex-direction: column; gap: 10px; }
    .co-sub-details-grid { grid-template-columns: 1fr; }
}
`;



