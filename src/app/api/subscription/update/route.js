import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscription/update
 * Musteri abonelik sikligini degistirir
 */
export async function POST(request) {
    try {
        const { subscriptionId, email, frequency } = await request.json();

        if (!subscriptionId || !email || !frequency) {
            return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
        }

        // Aboneligi bul ve email dogrula
        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { plan: true },
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Abonelik bulunamadi' }, { status: 404 });
        }

        if (subscription.customerEmail.toLowerCase() !== email.toLowerCase()) {
            return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 });
        }

        if (subscription.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Sadece aktif abonelikler guncellenebilir' }, { status: 400 });
        }

        // Siklik ayristir: "2_week" -> count=2, unit=week
        const parts = frequency.split('_');
        const count = parseInt(parts[0]) || 1;
        const unit = parts[1] || 'month';

        let interval = 'MONTHLY';
        let intervalCount = count;

        if (unit === 'week') {
            interval = 'WEEKLY';
        } else if (unit === 'month') {
            if (count === 3) interval = 'QUARTERLY';
            else if (count === 12) interval = 'YEARLY';
            else interval = 'MONTHLY';
        }

        // Sonraki odeme tarihini yeniden hesapla
        const now = new Date();
        const nextPayment = new Date(now);
        if (unit === 'week') {
            nextPayment.setDate(nextPayment.getDate() + count * 7);
        } else {
            nextPayment.setMonth(nextPayment.getMonth() + count);
        }

        // Plan guncelle (veya yeni plan olustur)
        await prisma.plan.update({
            where: { id: subscription.planId },
            data: {
                interval,
                intervalCount,
            },
        });

        // Abonelik tarihlerini guncelle
        await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                nextPaymentDate: nextPayment,
                currentPeriodEnd: nextPayment,
            },
        });

        const freqLabels = {
            '1_week': 'Haftada bir',
            '2_week': '2 haftada bir',
            '3_week': '3 haftada bir',
            '1_month': 'Ayda bir',
            '2_month': '2 ayda bir',
            '3_month': '3 ayda bir',
            '6_month': '6 ayda bir',
        };

        return NextResponse.json({
            success: true,
            message: 'Abonelik sikligi guncellendi',
            newFrequency: freqLabels[frequency] || frequency,
            nextPaymentDate: nextPayment.toISOString(),
        });
    } catch (error) {
        console.error('Subscription update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
