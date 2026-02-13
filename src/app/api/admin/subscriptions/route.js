import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
                        take: 3,
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
            subscriptions,
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
