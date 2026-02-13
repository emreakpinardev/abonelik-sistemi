import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/iyzico/webhook
 * iyzico webhook'larını dinler
 * Ödeme durumu değişikliklerini yakalar
 */
export async function POST(request) {
    try {
        const body = await request.json();

        console.log('iyzico webhook received:', JSON.stringify(body, null, 2));

        const {
            iyziEventType,
            iyziReferenceCode,
            token,
            paymentId,
            status,
        } = body;

        // Webhook türüne göre işlem yap
        switch (iyziEventType) {
            case 'SUBSCRIPTION_ORDER_SUCCESS':
                // Abonelik ödemesi başarılı
                if (iyziReferenceCode) {
                    await prisma.subscription.updateMany({
                        where: { iyzicoSubscriptionRef: iyziReferenceCode },
                        data: { status: 'ACTIVE' },
                    });
                }
                break;

            case 'SUBSCRIPTION_ORDER_FAILURE':
                // Abonelik ödemesi başarısız
                if (iyziReferenceCode) {
                    await prisma.subscription.updateMany({
                        where: { iyzicoSubscriptionRef: iyziReferenceCode },
                        data: { status: 'PAYMENT_FAILED' },
                    });
                }
                break;

            case 'SUBSCRIPTION_CANCEL':
                // Abonelik iptal edildi
                if (iyziReferenceCode) {
                    await prisma.subscription.updateMany({
                        where: { iyzicoSubscriptionRef: iyziReferenceCode },
                        data: {
                            status: 'CANCELLED',
                            cancelledAt: new Date(),
                        },
                    });
                }
                break;

            default:
                console.log('Bilinmeyen webhook türü:', iyziEventType);
        }

        // iyzico'ya 200 döndür (başarılı alındı)
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        // Yine de 200 döndür ki iyzico tekrar denemesin
        return NextResponse.json({ received: true, error: error.message });
    }
}
