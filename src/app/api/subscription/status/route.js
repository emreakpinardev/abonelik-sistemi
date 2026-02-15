import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createOrder } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

async function backfillMissingShopifyOrder(subscription) {
    if (!subscription || subscription.status !== 'ACTIVE') return subscription;
    if (!subscription.plan?.shopifyVariantId) return subscription;

    const successPayments = (subscription.payments || [])
        .filter((p) => p.status === 'SUCCESS')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (successPayments.length === 0) return subscription;
    if (subscription.lastShopifyOrderId) return subscription;

    const candidate = successPayments.find((p) => !p.shopifyOrderId) || null;
    if (!candidate) return subscription;

    try {
        const shopifyOrder = await createOrder({
            customerEmail: subscription.customerEmail,
            customerName: subscription.customerName,
            lineItems: [
                {
                    variantId: subscription.plan.shopifyVariantId,
                    quantity: 1,
                    price: subscription.plan.price.toString(),
                },
            ],
            shippingAddress: subscription.customerAddress
                ? {
                    address: subscription.customerAddress,
                    city: subscription.customerCity,
                    country: 'TR',
                }
                : null,
            billingAddress: subscription.customerAddress
                ? {
                    address: subscription.customerAddress,
                    city: subscription.customerCity,
                    country: 'TR',
                }
                : null,
            tags: ['abonelik', 'backfill'],
            iyzicoPaymentId: candidate.iyzicoPaymentId || '',
        });

        if (shopifyOrder) {
            await prisma.payment.update({
                where: { id: candidate.id },
                data: {
                    shopifyOrderId: shopifyOrder.id?.toString(),
                    shopifyOrderName: shopifyOrder.name,
                },
            });

            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    lastShopifyOrderId: shopifyOrder.id?.toString(),
                },
            });

            subscription.lastShopifyOrderId = shopifyOrder.id?.toString();
            subscription.payments = subscription.payments.map((p) =>
                p.id === candidate.id
                    ? {
                        ...p,
                        shopifyOrderId: shopifyOrder.id?.toString(),
                        shopifyOrderName: shopifyOrder.name,
                    }
                    : p
            );
        }
    } catch (error) {
        console.error('Backfill Shopify order error:', error);
    }

    return subscription;
}

function normalizePayments(payments = [], limit = 10) {
    const bucket = new Map();
    for (const p of payments) {
        const key = p.iyzicoPaymentId
            ? `pid:${p.iyzicoPaymentId}`
            : p.iyzicoPaymentTransactionId
                ? `ptid:${p.iyzicoPaymentTransactionId}`
                : `id:${p.id}`;
        const arr = bucket.get(key) || [];
        arr.push(p);
        bucket.set(key, arr);
    }

    const deduped = [];
    for (const arr of bucket.values()) {
        const success = arr
            .filter((x) => x.status === 'SUCCESS')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (success.length > 0) {
            deduped.push(success[0]);
            continue;
        }
        const latest = arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        deduped.push(latest);
    }

    return deduped
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
}

/**
 * GET /api/subscription/status?id=xxx
 * Abonelik durumunu sorgula
 * 
 * GET /api/subscription/status?email=xxx
 * Müşterinin tüm aboneliklerini listele
 */
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const email = url.searchParams.get('email');

        if (id) {
            const subscription = await prisma.subscription.findUnique({
                where: { id },
                include: {
                    plan: true,
                    payments: {
                        orderBy: { createdAt: 'desc' },
                        take: 30,
                    },
                },
            });

            if (!subscription) {
                return NextResponse.json({ error: 'Abonelik bulunamadı' }, { status: 404 });
            }

            const hydrated = await backfillMissingShopifyOrder(subscription);
            return NextResponse.json({
                subscription: {
                    ...hydrated,
                    payments: normalizePayments(hydrated.payments, 10),
                },
            });
        }

        if (email) {
            const subscriptions = await prisma.subscription.findMany({
                where: { customerEmail: email },
                include: {
                    plan: true,
                    payments: {
                        orderBy: { createdAt: 'desc' },
                        take: 30,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            const hydratedSubs = [];
            for (const s of subscriptions) {
                hydratedSubs.push(await backfillMissingShopifyOrder(s));
            }

            return NextResponse.json({
                subscriptions: hydratedSubs.map((s) => ({
                    ...s,
                    payments: normalizePayments(s.payments, 10),
                })),
            });
        }

        return NextResponse.json({ error: 'id veya email parametresi gerekli' }, { status: 400 });
    } catch (error) {
        console.error('Status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
