import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const API_KEY = (process.env.IYZICO_API_KEY || '').trim();
const SECRET_KEY = (process.env.IYZICO_SECRET_KEY || '').trim();
const BASE_URL = (process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com').trim();

function generateRandomString() {
    return Date.now().toString() + Math.random().toString(36).slice(2, 10);
}

// Resmi iyzipay SDK utils.js generateHashV2 ile ayni formul:
// HMAC-SHA256(secretKey, randomString + uri + body)   -- apiKey hash'e DAHIL DEGIL
function generateAuthorizationHeader(uri, body, randomString) {
    const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(randomString + uri + bodyString)
        .digest('hex');
    const authorizationParams = [
        'apiKey:' + API_KEY,
        'randomKey:' + randomString,
        'signature:' + signature,
    ];
    return 'IYZWSv2 ' + Buffer.from(authorizationParams.join('&')).toString('base64');
}

async function iyzicoCall(path, body, method = 'POST') {
    const randomString = generateRandomString();
    const pathForSig = path.split('?')[0];
    const authorization = generateAuthorizationHeader(pathForSig, body || {}, randomString);
    const res = await fetch(BASE_URL + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authorization,
            'x-iyzi-rnd': randomString,
            'x-iyzi-client-version': 'iyzipay-node-2.0.65',
        },
        ...(method !== 'GET' && body && Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await res.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    return { httpStatus: res.status, parsed };
}

export async function GET() {
    const results = {};

    // Test 1: Payment API
    try {
        const paymentBody = {
            locale: 'tr', conversationId: 'test-' + Date.now(),
            price: '1.0', paidPrice: '1.0', currency: 'TRY',
            basketId: 'test-basket', paymentGroup: 'PRODUCT',
            callbackUrl: 'https://example.com/callback', enabledInstallments: [1],
            buyer: { id: 'B1', name: 'Test', surname: 'User', gsmNumber: '+905350000000', email: 'test@test.com', identityNumber: '74300864791', lastLoginDate: '2026-01-01 00:00:00', registrationDate: '2026-01-01 00:00:00', registrationAddress: 'Istanbul', ip: '85.34.78.112', city: 'Istanbul', country: 'Turkey', zipCode: '34000' },
            shippingAddress: { contactName: 'Test User', city: 'Istanbul', country: 'Turkey', address: 'Istanbul', zipCode: '34000' },
            billingAddress: { contactName: 'Test User', city: 'Istanbul', country: 'Turkey', address: 'Istanbul', zipCode: '34000' },
            basketItems: [{ id: 'BI1', name: 'Test', category1: 'Test', itemType: 'VIRTUAL', price: '1.0' }],
        };
        results.payment_api = await iyzicoCall('/payment/iyzipos/checkoutform/initialize/auth/ecom', paymentBody);
    } catch (e) {
        results.payment_api = { error: e.message };
    }

    // Test 2: Subscription - urun olustur
    try {
        const subBody = {
            locale: 'tr',
            conversationId: 'test-sub-' + Date.now(),
            name: 'Test Abonelik ' + Date.now(),
            description: 'Test',
        };
        results.subscription_create_product = await iyzicoCall('/v2/subscription/products', subBody);
    } catch (e) {
        results.subscription_create_product = { error: e.message };
    }

    return NextResponse.json({
        config: {
            baseUrl: BASE_URL,
            apiKeyLength: API_KEY.length,
            secretKeyLength: SECRET_KEY.length,
            apiKeyPrefix: API_KEY.slice(0, 8) + '...',
            formula: 'HMAC-SHA256(secretKey, randomString + uri + body)',
        },
        results,
    });
}
