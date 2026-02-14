import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initializeCheckoutForm } from '@/lib/iyzico';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscription/update-payment
 * Abonelik icin odeme yontemi guncelleme
 * iyzico checkout formunu baslatir (kart guncelleme amacli)
 */
export async function POST(request) {
    try {
        const { subscriptionId, email } = await request.json();

        if (!subscriptionId || !email) {
            return NextResponse.json({ error: 'subscriptionId ve email gerekli' }, { status: 400 });
        }

        // Aboneligi bul
        const subscription = await prisma.subscription.findFirst({
            where: {
                id: subscriptionId,
                customer: { email },
                status: 'ACTIVE',
            },
            include: {
                customer: true,
                plan: true,
            },
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Aktif abonelik bulunamadi' }, { status: 404 });
        }

        const customer = subscription.customer;
        const plan = subscription.plan;
        const basketId = uuidv4();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // iyzico checkout formunu baslat (0.01 TL ile kart dogrulama + kaydetme)
        // Gercek odeme degil, sadece kart bilgilerini guncellemek icin
        const checkoutData = {
            locale: 'tr',
            conversationId: `card_update_${subscriptionId}`,
            price: '1.00',
            paidPrice: '1.00',
            currency: 'TRY',
            basketId,
            paymentGroup: 'SUBSCRIPTION',
            callbackUrl: `${appUrl}/api/iyzico/callback?type=card_update&subscriptionId=${subscriptionId}`,
            enabledInstallments: [1],
            buyer: {
                id: customer.shopifyCustomerId || customer.id,
                name: customer.firstName || 'Musteri',
                surname: customer.lastName || 'Kullanici',
                gsmNumber: customer.phone || '+905000000000',
                email: customer.email,
                identityNumber: '11111111111',
                registrationAddress: customer.address || 'Istanbul',
                ip: '85.34.78.112',
                city: customer.city || 'Istanbul',
                country: 'Turkey',
            },
            shippingAddress: {
                contactName: `${customer.firstName || 'Musteri'} ${customer.lastName || 'Kullanici'}`,
                city: customer.city || 'Istanbul',
                country: 'Turkey',
                address: customer.address || 'Istanbul',
            },
            billingAddress: {
                contactName: `${customer.firstName || 'Musteri'} ${customer.lastName || 'Kullanici'}`,
                city: customer.city || 'Istanbul',
                country: 'Turkey',
                address: customer.address || 'Istanbul',
            },
            basketItems: [
                {
                    id: `card_update_${subscriptionId}`,
                    name: `Kart Guncelleme - ${plan.name}`,
                    category1: 'Abonelik',
                    itemType: 'VIRTUAL',
                    price: '1.00',
                },
            ],
        };

        const result = await initializeCheckoutForm(checkoutData);

        if (result.status === 'success' && result.paymentPageUrl) {
            return NextResponse.json({
                success: true,
                paymentPageUrl: result.paymentPageUrl,
            });
        } else {
            return NextResponse.json({
                error: result.errorMessage || 'iyzico form olusturulamadi',
            }, { status: 400 });
        }

    } catch (error) {
        console.error('Update payment error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
