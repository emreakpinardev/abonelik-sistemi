import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reset-iyzico-refs
 * DB'deki tum planlarin iyzico product/pricing plan reference'larini temizler.
 * Sandbox'tan production'a geciste ya da hesap degisikliginde kullanilir.
 */
export async function POST(request) {
    const adminSecret = process.env.ADMIN_SECRET || 'changeme';
    const authHeader = request.headers.get('x-admin-secret') || '';

    if (authHeader !== adminSecret) {
        return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
    }

    const result = await prisma.plan.updateMany({
        data: {
            iyzicoProductReferenceCode: null,
            iyzicoPricingPlanReferenceCode: null,
        },
    });

    return NextResponse.json({
        success: true,
        updatedCount: result.count,
        message: `${result.count} plan icin iyzico referanslari temizlendi. Bir sonraki checkout'ta yeniden olusturulacak.`,
    });
}
