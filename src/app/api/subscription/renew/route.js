import { NextResponse } from 'next/server';
import { createPaymentWithSavedCard } from '@/lib/iyzico';
import { createOrder } from '@/lib/shopify';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subscription/renew
 * Vercel Cron Job tarafından her gün çağrılır
 * Bugün yenilenmesi gereken abonelikleri bulur ve ödeme çeker
 */
export async function GET(request) {
    try {
        // Cron job güvenliği
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const requestUrl = new URL(request.url);
        const manualSecret = requestUrl.searchParams.get('secret');
        const isBearerAuthorized = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
        const isManualAuthorized = Boolean(cronSecret) && manualSecret === cronSecret;

        // Vercel cron header kontrolü
        const isVercelCron = request.headers.get('x-vercel-cron');

        if (!isBearerAuthorized && !isVercelCron && !isManualAuthorized) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999); // Günün sonuna kadar

        // Bugün yenilenmesi gereken aktif abonelikleri bul
        const subscriptionsToRenew = await prisma.subscription.findMany({
            where: {
                status: 'ACTIVE',
                nextPaymentDate: {
                    lte: today,
                },
                iyzicoCardUserKey: { not: null },
                iyzicoCardToken: { not: null },
            },
            include: {
                plan: true,
            },
        });

        console.log(`${subscriptionsToRenew.length} abonelik yenilenecek`);

        const results = {
            total: subscriptionsToRenew.length,
            success: 0,
            failed: 0,
            errors: [],
        };

        // Her abonelik için ödeme çek
        for (const subscription of subscriptionsToRenew) {
            try {
                const nameParts = subscription.customerName.trim().split(' ');
                const firstName = nameParts[0] || 'Müşteri';
                const lastName = nameParts.slice(1).join(' ') || 'Müşteri';

                // iyzico'dan ödeme çek (kayıtlı kart ile)
                const paymentResult = await createPaymentWithSavedCard({
                    price: subscription.plan.price,
                    paidPrice: subscription.plan.price,
                    currency: subscription.plan.currency || 'TRY',
                    conversationId: `renewal-${subscription.id}-${Date.now()}`,
                    cardUserKey: subscription.iyzicoCardUserKey,
                    cardToken: subscription.iyzicoCardToken,
                    buyer: {
                        id: subscription.id,
                        name: firstName,
                        surname: lastName,
                        gsmNumber: subscription.customerPhone || '+905000000000',
                        email: subscription.customerEmail,
                        identityNumber: '11111111111',
                        registrationAddress: subscription.customerAddress || 'Türkiye',
                        ip: subscription.customerIp || '127.0.0.1',
                        city: subscription.customerCity || 'Istanbul',
                        country: 'Turkey',
                    },
                    shippingAddress: {
                        contactName: subscription.customerName,
                        city: subscription.customerCity || 'Istanbul',
                        country: 'Turkey',
                        address: subscription.customerAddress || 'Türkiye',
                    },
                    billingAddress: {
                        contactName: subscription.customerName,
                        city: subscription.customerCity || 'Istanbul',
                        country: 'Turkey',
                        address: subscription.customerAddress || 'Türkiye',
                    },
                    basketItems: [
                        {
                            id: subscription.plan.id,
                            name: `${subscription.plan.name} - Yenileme`,
                            category1: 'Abonelik',
                            itemType: 'VIRTUAL',
                            price: subscription.plan.price.toString(),
                        },
                    ],
                });

                if (paymentResult.status === 'success') {
                    // ✅ Ödeme başarılı
                    const now = new Date();
                    const nextPaymentDate = calculateNextPaymentDate(now, subscription.plan.interval, subscription.plan.intervalCount);

                    // Ödeme kaydı oluştur
                    const payment = await prisma.payment.create({
                        data: {
                            amount: subscription.plan.price,
                            currency: subscription.plan.currency || 'TRY',
                            status: 'SUCCESS',
                            iyzicoPaymentId: paymentResult.paymentId || null,
                            subscriptionId: subscription.id,
                        },
                    });

                    // Abonelik tarihleri güncelle
                    await prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            currentPeriodStart: now,
                            currentPeriodEnd: nextPaymentDate,
                            nextPaymentDate: nextPaymentDate,
                            status: 'ACTIVE',
                        },
                    });

                    // Shopify'da sipariş oluştur
                    try {
                        if (subscription.plan.shopifyVariantId) {
                            const shopifyOrder = await createOrder({
                                customerEmail: subscription.customerEmail,
                                customerName: subscription.customerName,
                                lineItems: [
                                    {
                                        variantId: subscription.plan.shopifyVariantId,
                                        quantity: 1,
                                        price: subscription.plan.price.toString(),
                                    },
                                ],
                                shippingAddress: subscription.customerAddress ? {
                                    address: subscription.customerAddress,
                                    city: subscription.customerCity,
                                    country: 'TR',
                                } : null,
                                billingAddress: subscription.customerAddress ? {
                                    address: subscription.customerAddress,
                                    city: subscription.customerCity,
                                    country: 'TR',
                                } : null,
                                tags: ['abonelik', 'yenileme', `period-${now.toISOString().slice(0, 7)}`],
                                iyzicoPaymentId: paymentResult.paymentId || '',
                            });

                            await prisma.payment.update({
                                where: { id: payment.id },
                                data: {
                                    shopifyOrderId: shopifyOrder.id?.toString(),
                                    shopifyOrderName: shopifyOrder.name,
                                },
                            });

                            await prisma.subscription.update({
                                where: { id: subscription.id },
                                data: {
                                    lastShopifyOrderId: shopifyOrder.id?.toString(),
                                },
                            });
                        }
                    } catch (shopifyError) {
                        console.error(`Shopify sipariş hatası (sub: ${subscription.id}):`, shopifyError);
                    }

                    results.success++;
                } else {
                    // ❌ Ödeme başarısız
                    await prisma.payment.create({
                        data: {
                            amount: subscription.plan.price,
                            currency: subscription.plan.currency || 'TRY',
                            status: 'FAILED',
                            iyzicoPaymentId: paymentResult.paymentId || null,
                            errorMessage: paymentResult.errorMessage || 'Ödeme başarısız',
                            subscriptionId: subscription.id,
                        },
                    });

                    // 3 başarısız ödeme sonrası aboneliği durdur
                    const failedPayments = await prisma.payment.count({
                        where: {
                            subscriptionId: subscription.id,
                            status: 'FAILED',
                            createdAt: {
                                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Son 30 gün
                            },
                        },
                    });

                    if (failedPayments >= 3) {
                        await prisma.subscription.update({
                            where: { id: subscription.id },
                            data: { status: 'PAYMENT_FAILED' },
                        });
                    }

                    results.failed++;
                    results.errors.push({
                        subscriptionId: subscription.id,
                        error: paymentResult.errorMessage,
                    });
                }
            } catch (subError) {
                console.error(`Abonelik yenileme hatası (sub: ${subscription.id}):`, subError);
                results.failed++;
                results.errors.push({
                    subscriptionId: subscription.id,
                    error: subError.message,
                });
            }
        }

        console.log('Yenileme sonuçları:', results);

        return NextResponse.json({
            success: true,
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Renewal cron error:', error);
        return NextResponse.json({
            error: 'Yenileme işlemi başarısız',
            details: error.message,
        }, { status: 500 });
    }
}

function calculateNextPaymentDate(fromDate, interval, intervalCount = 1) {
    const next = new Date(fromDate);

    switch (interval) {
        case 'MINUTELY':
            next.setMinutes(next.getMinutes() + intervalCount);
            break;
        case 'MONTHLY':
            next.setMonth(next.getMonth() + intervalCount);
            break;
        case 'QUARTERLY':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'YEARLY':
            next.setFullYear(next.getFullYear() + 1);
            break;
        case 'WEEKLY':
            next.setDate(next.getDate() + 7 * intervalCount);
            break;
        default:
            next.setMonth(next.getMonth() + 1);
    }

    return next;
}
