import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
                        take: 10,
                    },
                },
            });

            if (!subscription) {
                return NextResponse.json({ error: 'Abonelik bulunamadı' }, { status: 404 });
            }

            return NextResponse.json({ subscription });
        }

        if (email) {
            const subscriptions = await prisma.subscription.findMany({
                where: { customerEmail: email },
                include: {
                    plan: true,
                    payments: {
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return NextResponse.json({ subscriptions });
        }

        return NextResponse.json({ error: 'id veya email parametresi gerekli' }, { status: 400 });
    } catch (error) {
        console.error('Status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
