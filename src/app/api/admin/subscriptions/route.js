import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function normalizePayments(payments = [], limit = 3) {
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
 * GET /api/admin/subscriptions
 * Tüm abonelikleri listele (Admin paneli için)
 */
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        const where = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }

        const [subscriptions, total] = await Promise.all([
            prisma.subscription.findMany({
                where,
                include: {
                    plan: true,
                    payments: {
                        orderBy: { createdAt: 'desc' },
                        take: 30,
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.subscription.count({ where }),
        ]);

        // İstatistikler
        const stats = await prisma.subscription.groupBy({
            by: ['status'],
            _count: { id: true },
        });

        const totalRevenue = await prisma.payment.aggregate({
            where: { status: 'SUCCESS' },
            _sum: { amount: true },
        });

        return NextResponse.json({
            subscriptions: subscriptions.map((s) => ({
                ...s,
                payments: normalizePayments(s.payments, 3),
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            stats: {
                byStatus: stats.reduce((acc, s) => {
                    acc[s.status] = s._count.id;
                    return acc;
                }, {}),
                totalRevenue: totalRevenue._sum.amount || 0,
            },
        });
    } catch (error) {
        console.error('Admin list error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
