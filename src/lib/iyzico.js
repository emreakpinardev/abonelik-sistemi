import crypto from 'crypto';

/**
 * iyzico REST API client - native fetch ile (npm paketi olmadan)
 * Vercel serverless'ta sorunsuz calisir
 */

const API_KEY = process.env.IYZICO_API_KEY;
const SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const BASE_URL = process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com';

function generateRandomString() {
    return Date.now().toString() + Math.random().toString(36).slice(2, 10);
}

function generateAuthorizationHeader(uri, body, randomString) {
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(randomString + uri + JSON.stringify(body))
        .digest('hex');

    const authorizationParams = [
        'apiKey:' + API_KEY,
        'randomKey:' + randomString,
        'signature:' + signature,
    ];

    return 'IYZWSv2 ' + Buffer.from(authorizationParams.join('&')).toString('base64');
}

async function iyzicoRequest(path, body) {
    const randomString = generateRandomString();
    const payload = body || {};
    const authorization = generateAuthorizationHeader(path, payload, randomString);

    const response = await fetch(BASE_URL + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: authorization,
            'x-iyzi-rnd': randomString,
            'x-iyzi-client-version': 'iyzipay-node-2.0.65',
        },
        body: JSON.stringify(payload),
    });

    return await response.json();
}

function formatPriceForIyzico(price) {
    const parsed = Number.parseFloat(price);
    if (!Number.isFinite(parsed)) return '0.0';
    const normalized = parsed.toString();
    return normalized.includes('.') ? normalized : `${normalized}.0`;
}

/**
 * iyzico checkout form baslat (tek seferlik odeme)
 */
export async function initializeCheckoutForm({
    price,
    paidPrice,
    currency = 'TRY',
    basketId,
    callbackUrl,
    buyer,
    shippingAddress,
    billingAddress,
    basketItems,
    paymentGroup = 'PRODUCT',
}) {
    const formattedItems = (basketItems || []).map((item) => ({
        ...item,
        price: formatPriceForIyzico(item.price),
    }));

    const body = {
        locale: 'tr',
        conversationId: basketId,
        price: formatPriceForIyzico(price),
        paidPrice: formatPriceForIyzico(paidPrice),
        currency,
        basketId,
        paymentGroup,
        callbackUrl,
        enabledInstallments: [1],
        buyer,
        shippingAddress,
        billingAddress,
        basketItems: formattedItems,
    };

    return await iyzicoRequest('/payment/iyzipos/checkoutform/initialize/auth/ecom', body);
}

/**
 * iyzico checkout form sonucunu al (tek seferlik)
 */
export async function retrieveCheckoutForm(token) {
    const body = {
        locale: 'tr',
        token,
    };

    return await iyzicoRequest('/payment/iyzipos/checkoutform/auth/ecom/detail', body);
}

/**
 * Subscription API: urun olustur
 */
export async function createSubscriptionProduct({ name, description, locale = 'tr', conversationId }) {
    const body = {
        locale,
        conversationId: conversationId || `sub_product_${Date.now()}`,
        name: String(name || 'Abonelik Urunu').slice(0, 200),
        description: String(description || '').slice(0, 1000),
    };

    return await iyzicoRequest('/v2/subscription/products', body);
}

/**
 * Subscription API: fiyat plani olustur
 */
export async function createSubscriptionPricingPlan({
    name,
    price,
    currency = 'TRY',
    paymentInterval = 'MONTHLY',
    paymentIntervalCount = 1,
    productReferenceCode,
    trialPeriodDays = 0,
    locale = 'tr',
    conversationId,
}) {
    const body = {
        locale,
        conversationId: conversationId || `sub_plan_${Date.now()}`,
        name: String(name || 'Abonelik Plani').slice(0, 200),
        price: formatPriceForIyzico(price),
        currencyCode: currency,
        paymentInterval,
        paymentIntervalCount: Number(paymentIntervalCount) || 1,
        productReferenceCode,
        planPaymentType: 'RECURRING',
        trialPeriodDays: Number(trialPeriodDays) || 0,
    };

    return await iyzicoRequest('/v2/subscription/pricing-plans', body);
}

/**
 * Subscription API: checkout baslat
 */
export async function initializeSubscriptionCheckoutForm({
    conversationId,
    pricingPlanReferenceCode,
    subscriptionInitialStatus = 'ACTIVE',
    customer,
    callbackUrl,
    locale = 'tr',
}) {
    const body = {
        locale,
        conversationId: conversationId || `sub_checkout_${Date.now()}`,
        pricingPlanReferenceCode,
        subscriptionInitialStatus,
        customer,
        callbackUrl,
    };

    return await iyzicoRequest('/v2/subscription/checkoutform/initialize', body);
}

/**
 * Subscription API: checkout sonucu al
 */
export async function retrieveSubscriptionCheckoutForm(token, conversationId) {
    const body = { locale: 'tr' };
    if (conversationId) body.conversationId = conversationId;
    return await iyzicoRequest(`/v2/subscription/checkoutform/${token}`, body);
}

/**
 * Subscription API: aboneligi iptal et
 */
export async function cancelIyzicoSubscription({ subscriptionReferenceCode, reason, locale = 'tr', conversationId }) {
    const body = {
        locale,
        conversationId: conversationId || `sub_cancel_${Date.now()}`,
    };

    if (reason) body.cancellationReason = reason;

    return await iyzicoRequest(`/v2/subscription/subscriptions/${subscriptionReferenceCode}/cancel`, body);
}

/**
 * Kayitli kartla tekrarlayan odeme cek (legacy)
 */
export async function createPaymentWithSavedCard({
    price,
    paidPrice,
    currency = 'TRY',
    conversationId,
    cardUserKey,
    cardToken,
    buyer,
    shippingAddress,
    billingAddress,
    basketItems,
}) {
    const body = {
        locale: 'tr',
        conversationId,
        price: price.toString(),
        paidPrice: paidPrice.toString(),
        currency,
        installment: '1',
        paymentChannel: 'WEB',
        paymentGroup: 'SUBSCRIPTION',
        paymentCard: {
            cardUserKey,
            cardToken,
        },
        buyer,
        shippingAddress,
        billingAddress,
        basketItems,
    };

    return await iyzicoRequest('/payment/auth', body);
}

/**
 * Kayitli kartlari listele
 */
export async function retrieveCards(cardUserKey) {
    const body = {
        locale: 'tr',
        cardUserKey,
    };

    return await iyzicoRequest('/cardstorage/cards', body);
}

/**
 * Odeme iadesi yap (refund)
 */
export async function refundPayment({ paymentTransactionId, price, currency = 'TRY', conversationId }) {
    const body = {
        locale: 'tr',
        conversationId: conversationId || `refund_${Date.now()}`,
        paymentTransactionId,
        price: price.toString(),
        currency,
    };

    return await iyzicoRequest('/payment/refund', body);
}
