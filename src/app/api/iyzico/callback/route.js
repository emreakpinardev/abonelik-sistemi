import { NextResponse } from 'next/server';
import {
  retrieveCheckoutForm,
  retrieveSubscriptionCheckoutForm,
  refundPayment,
} from '@/lib/iyzico';
import { createOrder } from '@/lib/shopify';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
      next.setMonth(next.getMonth() + 3 * intervalCount);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + intervalCount);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7 * intervalCount);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

async function createShopifyOrderForSubscription(subscription, paymentId, tags = []) {
  if (!subscription?.plan?.shopifyVariantId) return null;

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
    shippingAddress: subscription.customerAddress
      ? {
          address: subscription.customerAddress,
          city: subscription.customerCity,
          country: 'TR',
        }
      : null,
    billingAddress: subscription.customerAddress
      ? {
          address: subscription.customerAddress,
          city: subscription.customerCity,
          country: 'TR',
        }
      : null,
    tags,
    iyzicoPaymentId: paymentId || '',
  });

  return shopifyOrder;
}

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

/**
 * POST /api/iyzico/callback
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const token = formData.get('token');
    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    const paymentType = url.searchParams.get('type');

    if (!token) {
      return redirectToResult('error', 'Eksik token bilgisi');
    }

    // One-time flow
    if (paymentType === 'single') {
      const paymentResult = await retrieveCheckoutForm(token);
      console.log('iyzico single callback result:', JSON.stringify(paymentResult, null, 2));

      if (paymentResult.status === 'success' && paymentResult.paymentStatus === 'SUCCESS') {
        return redirectToResult('success', 'Odemeniz basariyla tamamlandi!');
      }

      return redirectToResult('error', paymentResult.errorMessage || 'Odeme basarisiz oldu');
    }

    // Legacy card update flow
    if (paymentType === 'card_update') {
      const paymentResult = await retrieveCheckoutForm(token);
      console.log('iyzico card update callback result:', JSON.stringify(paymentResult, null, 2));

      if (paymentResult.status === 'success' && paymentResult.paymentStatus === 'SUCCESS') {
        if (subscriptionId) {
          await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
              iyzicoCardToken: paymentResult.cardToken || null,
              iyzicoCardUserKey: paymentResult.cardUserKey || null,
            },
          });
        }

        try {
          const transactionId = paymentResult.paymentItems?.[0]?.paymentTransactionId;
          if (transactionId) {
            await refundPayment({
              paymentTransactionId: transactionId,
              price: '1.00',
              conversationId: `refund_card_update_${subscriptionId}`,
            });
          }
        } catch (refundErr) {
          console.error('Card update refund error:', refundErr);
        }

        return redirectToResult('success', 'Kart bilgileriniz guncellendi!');
      }

      return redirectToResult('error', paymentResult.errorMessage || 'Kart guncelleme basarisiz oldu');
    }

    // Subscription API card update flow
    if (paymentType === 'card_update_sub') {
      // token exists => iyzico card update checkout completed and callback reached.
      return redirectToResult('success', 'Kart bilgileriniz guncellendi!');
    }

    // Subscription flow via iyzico Subscription API
    if (!subscriptionId) {
      return redirectToResult('error', 'Abonelik bilgisi eksik');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      return redirectToResult('error', 'Abonelik bulunamadi');
    }

    const subscriptionResult = await retrieveSubscriptionCheckoutForm(token, `sub_checkout_${subscriptionId}`);
    console.log('iyzico subscription callback result:', JSON.stringify(subscriptionResult, null, 2));

    if (subscriptionResult.status !== 'success') {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'PAYMENT_FAILED' },
      });

      await prisma.payment.create({
        data: {
          amount: subscription.plan.price,
          currency: subscription.plan.currency || 'TRY',
          status: 'FAILED',
          errorMessage: subscriptionResult.errorMessage || 'Abonelik olusturma basarisiz',
          subscriptionId,
        },
      });

      return redirectToResult('error', subscriptionResult.errorMessage || 'Abonelik olusturulamadi');
    }

    const resultData = subscriptionResult.data || {};
    const iyzicoSubRef =
      resultData.subscriptionReferenceCode ||
      resultData.subscription?.referenceCode ||
      resultData.subscription?.subscriptionReferenceCode ||
      subscriptionResult.subscriptionReferenceCode ||
      resultData.referenceCode ||
      null;
    const iyzicoCustomerRef =
      resultData.customerReferenceCode ||
      resultData.customer?.referenceCode ||
      resultData.customer?.customerReferenceCode ||
      subscriptionResult.customerReferenceCode ||
      subscriptionResult.customer?.referenceCode ||
      null;

    const now = new Date();
    const nextPaymentDate = calculateNextPaymentDate(now, subscription.plan.interval, subscription.plan.intervalCount);

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        iyzicoSubscriptionRef: iyzicoSubRef || subscription.iyzicoSubscriptionRef,
        iyzicoCustomerRef,
        startDate: subscription.startDate || now,
        currentPeriodStart: now,
        currentPeriodEnd: nextPaymentDate,
        nextPaymentDate,
      },
    });

    const paymentId =
      subscriptionResult.data?.paymentReferenceCode ||
      subscriptionResult.paymentId ||
      subscriptionResult.data?.orderReferenceCode ||
      null;

    const createdPayment = await prisma.payment.create({
      data: {
        amount: subscription.plan.price,
        currency: subscription.plan.currency || 'TRY',
        status: 'SUCCESS',
        iyzicoPaymentId: paymentId,
        subscriptionId,
      },
    });

    try {
      const shopifyOrder = await createShopifyOrderForSubscription(subscription, paymentId, ['abonelik', 'ilk-odeme']);
      if (shopifyOrder) {
        await prisma.payment.update({
          where: { id: createdPayment.id },
          data: {
            shopifyOrderId: shopifyOrder.id?.toString(),
            shopifyOrderName: shopifyOrder.name,
          },
        });

        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { lastShopifyOrderId: shopifyOrder.id?.toString() },
        });
      }
    } catch (shopifyError) {
      console.error('Shopify siparis olusturma hatasi:', shopifyError);
    }

    return redirectToResult('success', 'Aboneliginiz basariyla olusturuldu!');
  } catch (error) {
    console.error('iyzico callback error:', error);
    return redirectToResult('error', 'Bir hata olustu: ' + error.message);
  }
}
