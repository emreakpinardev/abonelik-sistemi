import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

            return NextResponse.json({
                subscription: {
                    ...subscription,
                    payments: normalizePayments(subscription.payments, 10),
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

            return NextResponse.json({
                subscriptions: subscriptions.map((s) => ({
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
