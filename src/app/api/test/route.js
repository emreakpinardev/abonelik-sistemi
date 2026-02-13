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

export async function GET() {
    const path = '/payment/iyzi-checkout/initialize';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const body = {
        locale: 'tr',
        conversationId: 'test-123',
        price: '100.0',
        paidPrice: '100.0',
        currency: 'TRY',
        basketId: 'test-basket-123',
        paymentGroup: 'SUBSCRIPTION',
        callbackUrl: appUrl + '/api/iyzico/callback',
        enabledInstallments: [1],
        buyer: {
            id: 'BY789',
            name: 'John',
            surname: 'Doe',
            gsmNumber: '+905350000000',
            email: 'test@test.com',
            identityNumber: '74300864791',
            lastLoginDate: '2026-02-13 20:00:00',
            registrationDate: '2026-02-13 20:00:00',
            registrationAddress: 'Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1',
            ip: '85.34.78.112',
            city: 'Istanbul',
            country: 'Turkey',
            zipCode: '34732',
        },
        shippingAddress: {
            contactName: 'John Doe',
            city: 'Istanbul',
            country: 'Turkey',
            address: 'Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1',
            zipCode: '34732',
        },
        billingAddress: {
            contactName: 'John Doe',
            city: 'Istanbul',
            country: 'Turkey',
            address: 'Nidakule Goztepe, Merdivenkoy Mah. Bora Sok. No:1',
            zipCode: '34732',
        },
        basketItems: [
            {
                id: 'BI101',
                name: 'Test Abonelik',
                category1: 'Abonelik',
                itemType: 'VIRTUAL',
                price: '100.0',
            },
        ],
    };

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

    const result = await response.json();

    return NextResponse.json({
        requestSent: body,
        iyzicoResponse: result,
        config: {
            baseUrl: BASE_URL,
            apiKeyPresent: !!API_KEY,
            secretKeyPresent: !!SECRET_KEY,
        },
    });
}
