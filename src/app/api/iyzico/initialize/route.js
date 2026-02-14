import { NextResponse } from 'next/server';
import { initializeCheckoutForm } from '@/lib/iyzico';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/iyzico/initialize
 * iyzico checkout formunu baslatir
 * Hem tek seferlik hem abonelik odemelerini destekler
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            type = 'subscription', // 'single' veya 'subscription'
            planId,
            productId,
            productPrice,
            productName,
            variantId,
            customerEmail,
            customerName,
            customerPhone,
            customerAddress,
            customerCity,
            customerIdentityNumber,
        } = body;

        let price, itemName, itemId, callbackParam;
        const basketId = uuidv4();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '85.34.78.112';

        if (type === 'subscription') {
            // ABONELIK ODEMESI
            let plan;

            if (planId) {
                // Admin panelinden gelen abonelik (planId mevcut)
                plan = await prisma.plan.findUnique({ where: { id: planId } });
                if (!plan) return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 });
            } else if (productId) {
                // Shopify urun sayfasindan gelen abonelik (planId yok, productId var)
                // Oncelikle bu Shopify urunune bagli plan var mi kontrol et
                plan = await prisma.plan.findFirst({
                    where: { shopifyProductId: String(productId) }
                });

                // Plan yoksa otomatik olustur
                if (!plan) {
                    const autoPrice = parseFloat(productPrice) || 0;
                    if (autoPrice <= 0) {
                        return NextResponse.json({ error: 'Geçersiz fiyat' }, { status: 400 });
                    }
                    plan = await prisma.plan.create({
                        data: {
                            name: productName || 'Abonelik Planı',
                            description: `Shopify ürünü: ${productName || productId}`,
                            price: autoPrice,
                            currency: 'TRY',
                            interval: 'MONTHLY',
                            intervalCount: 1,
                            shopifyProductId: String(productId),
                            shopifyVariantId: variantId ? String(variantId) : null,
                            active: true,
                        },
                    });
                    console.log('✅ Otomatik plan oluşturuldu:', plan.id, plan.name);
                }
            } else {
                return NextResponse.json({ error: 'Abonelik için plan veya ürün bilgisi gerekli' }, { status: 400 });
            }

            if (!plan.active) return NextResponse.json({ error: 'Bu plan artık aktif değil' }, { status: 400 });

            price = plan.price;
            itemName = plan.name;
            itemId = String(plan.id);

            const subscription = await prisma.subscription.create({
                data: {
                    customerEmail,
                    customerName,
                    customerPhone,
                    customerAddress,
                    customerCity,
                    customerIp: clientIp,
                    planId: plan.id,
                    status: 'PENDING',
                    iyzicoSubscriptionRef: basketId,
                },
            });
            callbackParam = `subscriptionId=${subscription.id}`;
        } else {
            // TEK SEFERLIK ODEME
            price = parseFloat(productPrice);
            if (!price || price <= 0) {
                return NextResponse.json({ error: 'Geçersiz fiyat' }, { status: 400 });
            }
            itemName = productName || 'Ürün';
            itemId = productId || 'PROD-' + basketId.substring(0, 8);
            callbackParam = `type=single&productId=${productId || ''}&variantId=${variantId || ''}`;
        }

        // Isim parcalama
        const nameParts = customerName.trim().split(' ');
        const firstName = nameParts[0] || 'Musteri';
        const lastName = nameParts.slice(1).join(' ') || 'Musteri';

        // iyzico checkout form baslat
        const result = await initializeCheckoutForm({
            price: price,
            paidPrice: price,
            currency: 'TRY',
            basketId: basketId,
            callbackUrl: `${appUrl}/api/iyzico/callback?${callbackParam}`,
            buyer: {
                id: 'BUYER-' + basketId.substring(0, 8),
                name: firstName,
                surname: lastName,
                gsmNumber: customerPhone || '+905350000000',
                email: customerEmail,
                identityNumber: customerIdentityNumber || '74300864791',
                lastLoginDate: new Date().toISOString().replace('T', ' ').split('.')[0],
                registrationDate: new Date().toISOString().replace('T', ' ').split('.')[0],
                registrationAddress: customerAddress || 'Istanbul Turkiye',
                ip: clientIp,
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
                    id: itemId,
                    name: itemName,
                    category1: type === 'subscription' ? 'Abonelik' : 'Urun',
                    itemType: 'VIRTUAL',
                    price: price.toString(),
                },
            ],
        });

        if (result.status === 'success') {
            return NextResponse.json({
                success: true,
                checkoutFormContent: result.checkoutFormContent,
                token: result.token,
            });
        } else {
            console.error('iyzico error:', JSON.stringify(result));
            return NextResponse.json({
                error: 'iyzico checkout başlatılamadı',
                details: result.errorMessage,
                errorCode: result.errorCode,
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
