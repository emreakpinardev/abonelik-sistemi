import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/plans
 * Aktif planları listele
 * Query params: productId (opsiyonel) - belirli ürüne ait planlar
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        const where = { active: true };
        if (productId) {
            where.shopifyProductId = productId;
        }

        const plans = await prisma.plan.findMany({
            where,
            orderBy: { price: 'asc' },
        });

        return NextResponse.json({ plans });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/plans
 * Plan güncelle
 */
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, name, description, price, interval, intervalCount, shopifyProductId, shopifyVariantId, active } = body;

        if (!id) {
            return NextResponse.json({ error: 'Plan ID gerekli' }, { status: 400 });
        }

        const data = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (price !== undefined) data.price = parseFloat(price);
        if (interval !== undefined) data.interval = interval;
        if (intervalCount !== undefined) data.intervalCount = parseInt(intervalCount);
        if (shopifyProductId !== undefined) data.shopifyProductId = shopifyProductId;
        if (shopifyVariantId !== undefined) data.shopifyVariantId = shopifyVariantId;
        if (active !== undefined) data.active = active;

        const plan = await prisma.plan.update({
            where: { id },
            data,
        });

        return NextResponse.json({ success: true, plan });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/plans
 * Plan sil (deaktif et)
 */
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Plan ID gerekli' }, { status: 400 });
        }

        // Aktif aboneligi olan planlar silinmez, deaktif edilir
        const activeSubscriptions = await prisma.subscription.count({
            where: { planId: id, status: 'ACTIVE' },
        });

        if (activeSubscriptions > 0) {
            await prisma.plan.update({
                where: { id },
                data: { active: false },
            });
            return NextResponse.json({ success: true, deactivated: true, message: `Plan deaktif edildi (${activeSubscriptions} aktif abonelik var)` });
        }

        await prisma.plan.delete({ where: { id } });
        return NextResponse.json({ success: true, deleted: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
