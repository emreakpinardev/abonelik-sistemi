import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/subscription/create
 * Yeni abonelik planı oluştur (Admin kullanımı)
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            name,
            description,
            price,
            currency = 'TRY',
            interval = 'MONTHLY',
            intervalCount = 1,
            trialDays = 0,
            shopifyProductId,
            shopifyVariantId,
        } = body;

        if (!name || !price) {
            return NextResponse.json({
                error: 'Plan adı ve fiyat gerekli',
            }, { status: 400 });
        }

        const plan = await prisma.plan.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                currency,
                interval,
                intervalCount: parseInt(intervalCount),
                trialDays: parseInt(trialDays),
                shopifyProductId,
                shopifyVariantId,
                active: true,
            },
        });

        return NextResponse.json({ success: true, plan });
    } catch (error) {
        console.error('Create plan error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/subscription/create
 * Tüm aktif planları listele
 */
export async function GET() {
    try {
        const plans = await prisma.plan.findMany({
            where: { active: true },
            orderBy: { price: 'asc' },
        });

        return NextResponse.json({ plans });
    } catch (error) {
        console.error('List plans error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
