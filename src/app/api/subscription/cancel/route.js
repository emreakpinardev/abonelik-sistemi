import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscription/cancel
 * Aboneliği iptal eder
 */
export async function POST(request) {
    try {
        const { subscriptionId } = await request.json();

        if (!subscriptionId) {
            return NextResponse.json({ error: 'Abonelik ID gerekli' }, { status: 400 });
        }

        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Abonelik bulunamadı' }, { status: 404 });
        }

        await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Abonelik iptal edildi',
        });
    } catch (error) {
        console.error('Cancel error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
