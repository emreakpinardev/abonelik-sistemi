import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/plans
 * Aktif planları listele
 * Query params: 
 * - productId (opsiyonel): belirli ürüne ait planlar
 * - isTemplate (opsiyonel): true ise sadece şablonları döner
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const isTemplate = searchParams.get('isTemplate');

        const where = { active: true };

        if (productId) {
            where.shopifyProductId = productId;
        }

        if (isTemplate === 'true') {
            where.isTemplate = true;
        } else if (isTemplate === 'false') {
            where.isTemplate = false;
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
 * POST /api/plans
 * Plan oluştur veya Şablonu Ürüne Ata
 */
export async function POST(request) {
    try {
        const body = await request.json();

        // SENARYO 1: Şablonu Ürünlere Ata (Toplu İşlem)
        if (body.assignTemplate && body.groupName && body.productIds) {
            const { groupName, productIds } = body;

            // Şablona ait plan varyasyonlarını çek
            const templates = await prisma.plan.findMany({
                where: { groupName, isTemplate: true, active: true }
            });

            if (templates.length === 0) {
                return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
            }

            const newPlans = [];
            for (const pid of productIds) {
                for (const t of templates) {
                    newPlans.push({
                        name: t.name,
                        description: t.description,
                        price: t.price,
                        interval: t.interval,
                        intervalCount: t.intervalCount,
                        shopifyProductId: pid,
                        isTemplate: false,
                        groupName: t.groupName,
                        active: true
                    });
                }
            }

            if (newPlans.length > 0) {
                await prisma.plan.createMany({ data: newPlans });
            }

            return NextResponse.json({ success: true, count: newPlans.length });
        }

        // SENARYO 2: Tekil Plan Oluştur (veya Şablon Varyasyonu Ekle)
        const { name, description, price, interval, intervalCount, shopifyProductId, isTemplate, groupName } = body;

        const plan = await prisma.plan.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                interval: interval || 'MONTHLY',
                intervalCount: parseInt(intervalCount || 1),
                shopifyProductId,
                isTemplate: !!isTemplate,
                groupName,
                active: true
            }
        });

        return NextResponse.json({ success: true, plan });
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
