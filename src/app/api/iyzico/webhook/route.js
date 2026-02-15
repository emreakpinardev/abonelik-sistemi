import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createOrder } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

function extractSubscriptionIdFromAnyText(value) {
  const text = String(value || '');
  const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
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

async function createShopifyOrderForRenewal(subscription, paymentId) {
  if (!subscription?.plan?.shopifyVariantId) return null;

  return await createOrder({
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
    tags: ['abonelik', 'iyzico-webhook-renewal'],
    iyzicoPaymentId: paymentId || '',
  });
}

/**
 * POST /api/iyzico/webhook
 */
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('iyzico webhook received:', JSON.stringify(body, null, 2));

    const iyziEventType = body.iyziEventType || body.eventType;
    const payload = body.data || body;

    const subscriptionReferenceCode =
      payload.subscriptionReferenceCode ||
      body.iyziReferenceCode ||
      body.subscriptionReferenceCode ||
      payload.referenceCode ||
      body.referenceCode ||
      null;

    let subscription = null;

    if (subscriptionReferenceCode) {
      subscription = await prisma.subscription.findFirst({
        where: { iyzicoSubscriptionRef: subscriptionReferenceCode },
        include: { plan: true },
      });
    }

    // Fallback: match by conversationId/internal references when iyzico ref was not saved yet.
    if (!subscription) {
      const conversationCandidates = [
        payload.conversationId,
        body.conversationId,
        payload.referenceCode,
        body.referenceCode,
        payload.subscriptionReferenceCode,
        body.subscriptionReferenceCode,
        payload.iyziReferenceCode,
        body.iyziReferenceCode,
      ];

      let inferredSubscriptionId = null;
      for (const candidate of conversationCandidates) {
        inferredSubscriptionId = extractSubscriptionIdFromAnyText(candidate);
        if (inferredSubscriptionId) break;
      }

      if (inferredSubscriptionId) {
        subscription = await prisma.subscription.findUnique({
          where: { id: inferredSubscriptionId },
          include: { plan: true },
        });
      }
    }

    if (!subscription) {
      return NextResponse.json({ received: true, skipped: true, reason: 'subscription not found' });
    }

    if (iyziEventType === 'SUBSCRIPTION_ORDER_SUCCESS') {
      const now = new Date();
      const nextPaymentDate = calculateNextPaymentDate(now, subscription.plan.interval, subscription.plan.intervalCount);

      const paymentId = payload.paymentReferenceCode || payload.paymentId || body.paymentId || null;
      const paymentTransactionId = payload.paymentTransactionId || body.paymentTransactionId || null;

      let payment = null;
      if (paymentId) {
        const existingByPaymentId = await prisma.payment.findFirst({
          where: {
            subscriptionId: subscription.id,
            iyzicoPaymentId: String(paymentId),
          },
          orderBy: { createdAt: 'desc' },
        });
        if (existingByPaymentId) {
          payment = await prisma.payment.update({
            where: { id: existingByPaymentId.id },
            data: {
              status: 'SUCCESS',
              errorMessage: null,
              iyzicoPaymentTransactionId: paymentTransactionId ? String(paymentTransactionId) : existingByPaymentId.iyzicoPaymentTransactionId,
            },
          });
        }
      }

      if (!payment) {
        payment = await prisma.payment.create({
          data: {
            amount: Number(payload.paidPrice || payload.price || subscription.plan.price),
            currency: payload.currencyCode || subscription.plan.currency || 'TRY',
            status: 'SUCCESS',
            iyzicoPaymentId: paymentId ? String(paymentId) : null,
            iyzicoPaymentTransactionId: paymentTransactionId ? String(paymentTransactionId) : null,
            subscriptionId: subscription.id,
          },
        });
      }

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          ...(subscriptionReferenceCode ? { iyzicoSubscriptionRef: subscriptionReferenceCode } : {}),
          currentPeriodStart: now,
          currentPeriodEnd: nextPaymentDate,
          nextPaymentDate,
        },
      });

      try {
        const order = await createShopifyOrderForRenewal(subscription, paymentId);
        if (order) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              shopifyOrderId: order.id?.toString(),
              shopifyOrderName: order.name,
            },
          });

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { lastShopifyOrderId: order.id?.toString() },
          });
        }
      } catch (shopifyError) {
        console.error('Shopify renewal order error:', shopifyError);
      }
    } else if (iyziEventType === 'SUBSCRIPTION_ORDER_FAILURE') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAYMENT_FAILED' },
      });

      await prisma.payment.create({
        data: {
          amount: Number(payload.paidPrice || payload.price || subscription.plan.price),
          currency: payload.currencyCode || subscription.plan.currency || 'TRY',
          status: 'FAILED',
          iyzicoPaymentId: payload.paymentReferenceCode || payload.paymentId || body.paymentId || null,
          errorMessage: payload.errorMessage || body.errorMessage || 'SUBSCRIPTION_ORDER_FAILURE',
          subscriptionId: subscription.id,
        },
      });
    } else if (iyziEventType === 'SUBSCRIPTION_CANCEL') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
    } else {
      console.log('Unhandled webhook type:', iyziEventType);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true, error: error.message });
  }
}
