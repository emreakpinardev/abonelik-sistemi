import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// @ts-ignore
const Iyzipay = require('iyzipay');

const iyzipay = new Iyzipay({
    apiKey: (process.env.IYZICO_API_KEY || '').trim(),
    secretKey: (process.env.IYZICO_SECRET_KEY || '').trim(),
    uri: (process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com').trim(),
});

function sdkCall(obj, method, request) {
    return new Promise((resolve, reject) => {
        obj[method](request, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

export async function GET() {
    const results: Record<string, unknown> = {};

    // Test 1: Checkout form (normal odeme)
    try {
        const r = await sdkCall(iyzipay.checkoutFormInitialize, 'create', {
            locale: 'tr', conversationId: 'test-' + Date.now(),
            price: '1.0', paidPrice: '1.0', currency: 'TRY',
            basketId: 'test-basket', paymentGroup: 'PRODUCT',
            callbackUrl: 'https://example.com/callback', enabledInstallments: [1],
            buyer: { id: 'B1', name: 'Test', surname: 'User', gsmNumber: '+905350000000', email: 'test@test.com', identityNumber: '74300864791', lastLoginDate: '2026-01-01 00:00:00', registrationDate: '2026-01-01 00:00:00', registrationAddress: 'Istanbul', ip: '85.34.78.112', city: 'Istanbul', country: 'Turkey', zipCode: '34000' },
            shippingAddress: { contactName: 'Test User', city: 'Istanbul', country: 'Turkey', address: 'Istanbul', zipCode: '34000' },
            billingAddress: { contactName: 'Test User', city: 'Istanbul', country: 'Turkey', address: 'Istanbul', zipCode: '34000' },
            basketItems: [{ id: 'BI1', name: 'Test', category1: 'Test', itemType: 'VIRTUAL', price: '1.0' }],
        });
        results.payment_api = r;
    } catch (e: any) {
        results.payment_api = { error: e.message };
    }

    // Test 2: Subscription urun olustur
    try {
        const r = await sdkCall(iyzipay.subscriptionProduct, 'create', {
            locale: 'tr',
            conversationId: 'test-sub-' + Date.now(),
            name: 'Test Urun ' + Date.now(),
            description: 'Test',
        });
        results.subscription_product = r;
    } catch (e: any) {
        results.subscription_product = { error: e.message };
    }

    return NextResponse.json({
        config: {
            baseUrl: (process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com').trim(),
            apiKeyLength: (process.env.IYZICO_API_KEY || '').trim().length,
            secretKeyLength: (process.env.IYZICO_SECRET_KEY || '').trim().length,
            apiKeyPrefix: (process.env.IYZICO_API_KEY || '').trim().slice(0, 8) + '...',
        },
        results,
    });
}
