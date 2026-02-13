import { NextResponse } from 'next/server';
import { initializeCheckoutForm } from '@/lib/iyzico';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/iyzico/initialize
 * iyzico checkout formunu başlatır
 * Müşteri bu form üzerinden kartını girer ve ilk ödeme yapılır
 */
export async function POST(request) {
    console.log('iyzico initialize handler started');
    try {
        const body = await request.json();
        const {
            planId,
            customerEmail,
            customerName,
            customerPhone,
            customerAddress,
            customerCity,
            customerIdentityNumber, // TC kimlik no (iyzico zorunlu)
        } = body;

        // Plan bilgisini al
        const plan = await prisma.plan.findUnique({
            where: { id: planId },
        });

        if (!plan) {
            return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 });
        }

        if (!plan.active) {
            return NextResponse.json({ error: 'Bu plan artık aktif değil' }, { status: 400 });
        }

        // Benzersiz basket ID oluştur
        const basketId = uuidv4();

        // Abonelik kaydını oluştur (PENDING durumda)
        const subscription = await prisma.subscription.create({
            data: {
                customerEmail,
                customerName,
                customerPhone,
                customerAddress,
                customerCity,
                customerIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
                planId: plan.id,
                status: 'PENDING',
                iyzicoSubscriptionRef: basketId,
            },
        });

        // Isim parcalama
        const nameParts = customerName.trim().split(' ');
        const firstName = nameParts[0] || 'Musteri';
        const lastName = nameParts.slice(1).join(' ') || 'Musteri';

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // iyzico checkout form baslat
        const result = await initializeCheckoutForm({
            price: plan.price,
            paidPrice: plan.price,
            currency: plan.currency || 'TRY',
            basketId: basketId,
            callbackUrl: `${appUrl}/api/iyzico/callback?subscriptionId=${subscription.id}`,
            buyer: {
                id: String(subscription.id),
                name: firstName,
                surname: lastName,
                gsmNumber: customerPhone || '+905350000000',
                email: customerEmail,
                identityNumber: customerIdentityNumber || '74300864791',
                lastLoginDate: new Date().toISOString().replace('T', ' ').split('.')[0],
                registrationDate: new Date().toISOString().replace('T', ' ').split('.')[0],
                registrationAddress: customerAddress || 'Istanbul Turkiye',
                ip: subscription.customerIp || '85.34.78.112',
                city: customerCity || 'Istanbul',
                country: 'Turkey',
                zipCode: '34000',
            },
            shippingAddress: {
                contactName: customerName,
                city: customerCity || 'Istanbul',
                country: 'Turkey',
                address: customerAddress || 'Istanbul Turkiye',
                zipCode: '34000',
            },
            billingAddress: {
                contactName: customerName,
                city: customerCity || 'Istanbul',
                country: 'Turkey',
                address: customerAddress || 'Istanbul Turkiye',
                zipCode: '34000',
            },
            basketItems: [
                {
                    id: String(plan.id),
                    name: plan.name,
                    category1: 'Abonelik',
                    itemType: 'VIRTUAL',
                    price: plan.price.toString(),
                },
            ],
        });

        if (result.status === 'success') {
            return NextResponse.json({
                success: true,
                checkoutFormContent: result.checkoutFormContent,
                token: result.token,
                subscriptionId: subscription.id,
            });
        } else {
            console.error('iyzico error:', JSON.stringify(result));
            return NextResponse.json({
                error: 'iyzico checkout başlatılamadı',
                details: result.errorMessage,
                errorCode: result.errorCode,
                fullResponse: result,
            }, { status: 400 });
        }
    } catch (error) {
        console.error('iyzico initialize error:', error);
        return NextResponse.json({
            error: 'Bir hata oluştu',
            details: error.message,
        }, { status: 500 });
    }
}
