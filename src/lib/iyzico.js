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
    const authorization = generateAuthorizationHeader(path, body, randomString);

    const response = await fetch(BASE_URL + path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authorization,
            'x-iyzi-rnd': randomString,
            'x-iyzi-client-version': 'iyzipay-node-2.0.65',
        },
        body: JSON.stringify(body),
    });

    return await response.json();
}

/**
 * iyzico checkout form baslat (ilk abonelik odemesi)
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
    paymentGroup = 'SUBSCRIPTION', // 'SUBSCRIPTION' veya 'PRODUCT'
}) {
    // iyzico fiyat formatı: ondalık kısmı olmalı (ör: "1500.0")
    const formatPrice = (p) => {
        const num = parseFloat(p).toString();
        return num.includes('.') ? num : num + '.0';
    };

    // basketItems fiyatlarını da formatla
    const formattedItems = basketItems.map(item => ({
        ...item,
        price: formatPrice(item.price),
    }));

    const body = {
        locale: 'tr',
        conversationId: basketId,
        price: formatPrice(price),
        paidPrice: formatPrice(paidPrice),
        currency: currency,
        basketId: basketId,
        paymentGroup: paymentGroup,
        callbackUrl: callbackUrl,
        enabledInstallments: [1],
        buyer: buyer,
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        basketItems: formattedItems,
    };

    return await iyzicoRequest('/payment/iyzipos/checkoutform/initialize/auth/ecom', body);
}

/**
 * iyzico checkout form sonucunu al
 */
export async function retrieveCheckoutForm(token) {
    const body = {
        locale: 'tr',
        token: token,
    };

    return await iyzicoRequest('/payment/iyzipos/checkoutform/auth/ecom/detail', body);
}

/**
 * Kayitli kartla tekrarlayan odeme cek (cron job ile)
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
        conversationId: conversationId,
        price: price.toString(),
        paidPrice: paidPrice.toString(),
        currency: currency,
        installment: '1',
        paymentChannel: 'WEB',
        paymentGroup: 'SUBSCRIPTION',
        paymentCard: {
            cardUserKey: cardUserKey,
            cardToken: cardToken,
        },
        buyer: buyer,
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        basketItems: basketItems,
    };

    return await iyzicoRequest('/payment/auth', body);
}

/**
 * Kayitli kartlari listele
 */
export async function retrieveCards(cardUserKey) {
    const body = {
        locale: 'tr',
        cardUserKey: cardUserKey,
    };

    return await iyzicoRequest('/cardstorage/cards', body);
}
