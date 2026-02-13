import { NextResponse } from 'next/server';
import { retrieveCheckoutForm } from '@/lib/iyzico';
import { createOrder, findCustomerByEmail, createCustomer } from '@/lib/shopify';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/iyzico/callback
 * iyzico ödeme tamamlandığında bu endpoint çağrılır
 * Başarılıysa aboneliği aktif eder ve Shopify'da sipariş oluşturur
 */
export async function POST(request) {
    try {
        const formData = await request.formData();
        const token = formData.get('token');
        const url = new URL(request.url);
        const subscriptionId = url.searchParams.get('subscriptionId');

        if (!token || !subscriptionId) {
            return redirectToResult('error', 'Eksik bilgi');
        }

        // iyzico'dan ödeme sonucunu al
        const paymentResult = await retrieveCheckoutForm(token);

        console.log('iyzico callback result:', JSON.stringify(paymentResult, null, 2));

        // Abonelik kaydını bul
        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { plan: true },
        });

        if (!subscription) {
            return redirectToResult('error', 'Abonelik bulunamadı');
        }

        if (paymentResult.status === 'success' && paymentResult.paymentStatus === 'SUCCESS') {
            // ✅ Ödeme başarılı!

            // Kart tokenini ve kullanıcı anahtarını kaydet (recurring için)
            const now = new Date();
            const nextPaymentDate = calculateNextPaymentDate(now, subscription.plan.interval, subscription.plan.intervalCount);

            await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'ACTIVE',
                    iyzicoCardToken: paymentResult.cardToken || null,
                    iyzicoCardUserKey: paymentResult.cardUserKey || null,
                    startDate: now,
                    currentPeriodStart: now,
                    currentPeriodEnd: nextPaymentDate,
                    nextPaymentDate: nextPaymentDate,
                },
            });

            // Ödeme kaydı oluştur
            const payment = await prisma.payment.create({
                data: {
                    amount: subscription.plan.price,
                    currency: subscription.plan.currency || 'TRY',
                    status: 'SUCCESS',
                    iyzicoPaymentId: paymentResult.paymentId || null,
                    iyzicoPaymentTransactionId: paymentResult.paymentItems?.[0]?.paymentTransactionId || null,
                    subscriptionId: subscriptionId,
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
                        tags: ['abonelik', 'ilk-odeme'],
                        iyzicoPaymentId: paymentResult.paymentId || '',
                    });

                    // Sipariş bilgisini kaydet
                    await prisma.payment.update({
                        where: { id: payment.id },
                        data: {
                            shopifyOrderId: shopifyOrder.id?.toString(),
                            shopifyOrderName: shopifyOrder.name,
                        },
                    });

                    await prisma.subscription.update({
                        where: { id: subscriptionId },
                        data: {
                            lastShopifyOrderId: shopifyOrder.id?.toString(),
                        },
                    });
                }
            } catch (shopifyError) {
                console.error('Shopify sipariş oluşturma hatası:', shopifyError);
                // Shopify hatası varsa abonelik yine aktif, sonra manuel oluşturulabilir
            }

            return redirectToResult('success', 'Aboneliğiniz başarıyla oluşturuldu!');
        } else {
            // ❌ Ödeme başarısız
            await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'PAYMENT_FAILED',
                },
            });

            await prisma.payment.create({
                data: {
                    amount: subscription.plan.price,
                    currency: subscription.plan.currency || 'TRY',
                    status: 'FAILED',
                    iyzicoPaymentId: paymentResult.paymentId || null,
                    errorMessage: paymentResult.errorMessage || 'Ödeme başarısız',
                    subscriptionId: subscriptionId,
                },
            });

            return redirectToResult('error', paymentResult.errorMessage || 'Ödeme başarısız oldu');
        }
    } catch (error) {
        console.error('iyzico callback error:', error);
        return redirectToResult('error', 'Bir hata oluştu: ' + error.message);
    }
}

/**
 * Sonraki ödeme tarihini hesapla
 */
function calculateNextPaymentDate(fromDate, interval, intervalCount = 1) {
    const next = new Date(fromDate);

    switch (interval) {
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

/**
 * Sonuç sayfasına yönlendir
 */
function redirectToResult(status, message) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${appUrl}/checkout/result?status=${status}&message=${encodeURIComponent(message)}`;

    return new Response(null, {
        status: 302,
        headers: {
            Location: redirectUrl,
        },
    });
}
