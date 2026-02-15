import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initializeCheckoutForm } from '@/lib/iyzico';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function getIyzicoCustomerPanelUrl() {
    return (
        process.env.IYZICO_CUSTOMER_PANEL_URL ||
        process.env.NEXT_PUBLIC_IYZICO_CUSTOMER_PANEL_URL ||
        process.env.IYZICO_CUSTOMER_PORTAL_URL ||
        process.env.NEXT_PUBLIC_IYZICO_CUSTOMER_PORTAL_URL ||
        'https://www.iyzico.com/'
    );
}

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
                customerEmail: email,
                status: 'ACTIVE',
            },
            include: {
                plan: true,
            },
        });

        if (!subscription) {
            return NextResponse.json({ error: 'Aktif abonelik bulunamadi' }, { status: 404 });
        }

        if (subscription.iyzicoSubscriptionRef) {
            return NextResponse.json({
                success: false,
                requiresExternalCardUpdate: true,
                paymentPageUrl: getIyzicoCustomerPanelUrl(),
                message: 'Bu abonelik iyzico Subscription API ile yonetiliyor. Kart guncelleme islemini iyzico musteri panelinden tamamlayin.',
            });
        }

        const plan = subscription.plan;
        const basketId = uuidv4();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // iyzico checkout formunu baslat (1 TL ile kart dogrulama + kaydetme)
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
                id: subscription.shopifyCustomerId || subscription.id,
                name: subscription.customerName?.split(' ')[0] || 'Musteri',
                surname: subscription.customerName?.split(' ').slice(1).join(' ') || 'Kullanici',
                gsmNumber: subscription.customerPhone || '+905000000000',
                email: subscription.customerEmail,
                identityNumber: '11111111111',
                registrationAddress: subscription.customerAddress || 'Istanbul',
                ip: subscription.customerIp || '85.34.78.112',
                city: subscription.customerCity || 'Istanbul',
                country: 'Turkey',
            },
            shippingAddress: {
                contactName: subscription.customerName || 'Musteri',
                city: subscription.customerCity || 'Istanbul',
                country: 'Turkey',
                address: subscription.customerAddress || 'Istanbul',
            },
            billingAddress: {
                contactName: subscription.customerName || 'Musteri',
                city: subscription.customerCity || 'Istanbul',
                country: 'Turkey',
                address: subscription.customerAddress || 'Istanbul',
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

