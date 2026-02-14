import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensurePlanVariant } from '@/lib/shopify-plan-variant';

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

        const response = NextResponse.json({ plans });
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
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

            // Mevcut planları kontrol et (Multiple Product Check)
            const existingPlans = await prisma.plan.findMany({
                where: {
                    shopifyProductId: { in: productIds },
                    active: true
                },
                select: { shopifyProductId: true, interval: true, intervalCount: true }
            });

            const existingSet = new Set(
                existingPlans.map(p => `${p.shopifyProductId}-${p.interval}-${p.intervalCount}`)
            );

            const newPlans = [];
            for (const pid of productIds) {
                for (const t of templates) {
                    // Unique Key: ProductID - Interval - Count
                    // Fiyat değişmiş olabilir ama aynı interval varsa duplicate sayıyoruz
                    const key = `${pid}-${t.interval}-${t.intervalCount}`;

                    if (!existingSet.has(key)) {
                        const autoVariantId = await ensurePlanVariant({
                            productId: pid,
                            price: t.price,
                            interval: t.interval,
                            intervalCount: t.intervalCount,
                            existingVariantId: t.shopifyVariantId || null,
                        });

                        newPlans.push({
                            name: t.name,
                            description: t.description,
                            price: t.price,
                            interval: t.interval,
                            intervalCount: t.intervalCount,
                            shopifyProductId: pid,
                            shopifyVariantId: autoVariantId ? String(autoVariantId) : null,
                            isTemplate: false,
                            groupName: t.groupName,
                            active: true
                        });
                        // Add to set to prevent duplicate within same batch if templates have dupes?
                        existingSet.add(key);
                    }
                }
            }

            if (newPlans.length > 0) {
                await prisma.plan.createMany({ data: newPlans });
            }

            return NextResponse.json({
                success: true,
                count: newPlans.length,
                message: newPlans.length === 0 ? 'Tüm planlar zaten mevcut.' : `${newPlans.length} yeni plan oluşturuldu.`
            });
        }

        // SENARYO 2: Tekil Plan Oluştur (veya Şablon Varyasyonu Ekle)
        const { name, description, price, interval, intervalCount, shopifyProductId, shopifyVariantId, isTemplate, groupName } = body;

        // Duplicate Check for Single Plan
        if (shopifyProductId && !isTemplate) {
            const existing = await prisma.plan.findFirst({
                where: {
                    shopifyProductId,
                    interval: interval || 'MONTHLY',
                    intervalCount: parseInt(intervalCount || 1),
                    active: true
                }
            });

            if (existing) {
                const ensuredVariantId = await ensurePlanVariant({
                    productId: shopifyProductId,
                    price,
                    interval: interval || 'MONTHLY',
                    intervalCount: parseInt(intervalCount || 1),
                    existingVariantId: existing.shopifyVariantId ? String(existing.shopifyVariantId) : null,
                });
                const updated = await prisma.plan.update({
                    where: { id: existing.id },
                    data: { shopifyVariantId: ensuredVariantId ? String(ensuredVariantId) : null },
                });
                return NextResponse.json({ success: true, plan: updated, message: 'Plan zaten mevcut (variant guncellendi)' });
            }
        }

        let resolvedVariantId = shopifyVariantId ? String(shopifyVariantId) : null;
        if (shopifyProductId && !isTemplate) {
            resolvedVariantId = await ensurePlanVariant({
                productId: shopifyProductId,
                price,
                interval: interval || 'MONTHLY',
                intervalCount: parseInt(intervalCount || 1),
                existingVariantId: resolvedVariantId,
            });
        }

        const plan = await prisma.plan.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                interval: interval || 'MONTHLY',
                intervalCount: parseInt(intervalCount || 1),
                shopifyProductId,
                shopifyVariantId: resolvedVariantId,
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

        try {
            await prisma.plan.delete({ where: { id } });
            return NextResponse.json({ success: true, deleted: true });
        } catch (deleteErr) {
            // Gecmis odeme/abonelik kayitlariyla iliskili planlarda hard-delete FK hatasi verebilir.
            // Bu durumda plani arsivleyip (active=false) panelden kaldiralim.
            await prisma.plan.update({
                where: { id },
                data: { active: false },
            });
            return NextResponse.json({
                success: true,
                deactivated: true,
                message: 'Plan iliskili kayitlar nedeniyle tamamen silinemedi, arsive alindi.',
                reason: deleteErr?.message || 'delete_failed',
            });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
