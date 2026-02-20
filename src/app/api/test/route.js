import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.IYZICO_API_KEY;
const SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const BASE_URL = process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com';

function generateRandomString() {
    return Date.now().toString() + Math.random().toString(36).slice(2, 10);
}

function generateAuthorizationHeader(uri, body, randomString) {
    const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
    // IYZWSv2: HMAC-SHA256(secretKey, apiKey + randomKey + uri + bodyString)
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(API_KEY + randomString + uri + bodyString)
        .digest('hex');
    const authorizationParams = [
        'apiKey:' + API_KEY,
        'randomKey:' + randomString,
        'signature:' + signature,
    ];
    return 'IYZWSv2 ' + Buffer.from(authorizationParams.join('&')).toString('base64');
}

export async function GET() {
    const path = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const body = {
        locale: 'tr',
        conversationId: 'test-' + Date.now(),
        price: '100.0',
        paidPrice: '100.0',
        currency: 'TRY',
        basketId: 'test-basket-' + Date.now(),
        paymentGroup: 'PRODUCT',
        callbackUrl: appUrl + '/api/iyzico/callback?type=single',
        enabledInstallments: [1],
        buyer: {
            id: 'BY789',
            name: 'Test',
            surname: 'Kullanici',
            gsmNumber: '+905350000000',
            email: 'test@test.com',
            identityNumber: '74300864791',
            lastLoginDate: '2026-01-01 00:00:00',
            registrationDate: '2026-01-01 00:00:00',
            registrationAddress: 'Test Adres, Istanbul',
            ip: '85.34.78.112',
            city: 'Istanbul',
            country: 'Turkey',
            zipCode: '34000',
        },
        shippingAddress: {
            contactName: 'Test Kullanici',
            city: 'Istanbul',
            country: 'Turkey',
            address: 'Test Adres, Istanbul',
            zipCode: '34000',
        },
        billingAddress: {
            contactName: 'Test Kullanici',
            city: 'Istanbul',
            country: 'Turkey',
            address: 'Test Adres, Istanbul',
            zipCode: '34000',
        },
        basketItems: [
            {
                id: 'BI101',
                name: 'Test Urun',
                category1: 'Urun',
                itemType: 'VIRTUAL',
                price: '100.0',
            },
        ],
    };

    const randomString = generateRandomString();
    const authorization = generateAuthorizationHeader(path, body, randomString);

    let iyzicoResponse = null;
    let iyzicoError = null;
    let httpStatus = null;
    try {
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
        httpStatus = response.status;
        const raw = await response.text();
        try { iyzicoResponse = JSON.parse(raw); } catch { iyzicoResponse = raw; }
    } catch (err) {
        iyzicoError = err.message;
    }

    return NextResponse.json({
        iyzicoResponse,
        iyzicoError,
        httpStatus,
        config: {
            baseUrl: BASE_URL,
            apiKeyPresent: !!API_KEY,
            apiKeyPrefix: API_KEY ? API_KEY.slice(0, 8) + '...' : 'EKSIK',
            secretKeyPresent: !!SECRET_KEY,
            secretKeyPrefix: SECRET_KEY ? SECRET_KEY.slice(0, 8) + '...' : 'EKSIK',
        },
    });
}
