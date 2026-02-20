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

function extractDeliveryInfoFromConversationId(conversationId = '') {
  const marker = '__dlv_';
  const raw = String(conversationId || '');
  const idx = raw.indexOf(marker);
  if (idx < 0) return { deliveryDate: '', deliveryDay: '', deliveryDayName: '' };
  const token = raw.slice(idx + marker.length).trim();
  if (!token) return { deliveryDate: '', deliveryDay: '', deliveryDayName: '' };

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [deliveryDate = '', deliveryDay = '', deliveryDayName = ''] = decoded.split('~');
    return {
      deliveryDate: String(deliveryDate || '').trim(),
      deliveryDay: String(deliveryDay || '').trim(),
      deliveryDayName: String(deliveryDayName || '').trim(),
    };
  } catch (_) {
    return { deliveryDate: '', deliveryDay: '', deliveryDayName: '' };
  }
}

function buildDeliveryMeta(deliveryInfo = {}) {
  const deliveryDate = String(deliveryInfo.deliveryDate || '').trim();
  const deliveryDay = String(deliveryInfo.deliveryDay || '').trim();
  const deliveryDayName = String(deliveryInfo.deliveryDayName || '').trim();
  const fallbackText = '(belirtilmedi)';

  const lineItemProperties = {
    'Delivery date': deliveryDate || fallbackText,
    delivery_date: deliveryDate || fallbackText,
    'Teslimat Gunu': deliveryDayName || fallbackText,
    delivery_day: deliveryDay || fallbackText,
  };
  const noteAttributes = [
    { name: 'Delivery date', value: deliveryDate || fallbackText },
    { name: 'delivery_date', value: deliveryDate || fallbackText },
    { name: 'Teslimat Gunu', value: deliveryDayName || fallbackText },
    { name: 'delivery_day', value: deliveryDay || fallbackText },
  ];
  return { lineItemProperties, noteAttributes };
}

function buildDeliveryNote(deliveryInfo = {}) {
  const deliveryDate = String(deliveryInfo.deliveryDate || '').trim();
  const deliveryDay = String(deliveryInfo.deliveryDay || '').trim();
  const deliveryDayName = String(deliveryInfo.deliveryDayName || '').trim();
  const parts = [];
  if (deliveryDate) parts.push(`Delivery date: ${deliveryDate}`);
  if (deliveryDayName) parts.push(`Teslimat Gunu: ${deliveryDayName}`);
  if (deliveryDay) parts.push(`delivery_day: ${deliveryDay}`);
  return parts.join(' | ');
}

async function createShopifyOrderForRenewal(subscription, paymentId, deliveryInfo = {}) {
  if (!subscription?.plan?.shopifyVariantId) return null;
  const deliveryMeta = buildDeliveryMeta(deliveryInfo);
  const deliveryNote = buildDeliveryNote(deliveryInfo);

  return await createOrder({
    customerEmail: subscription.customerEmail,
    customerName: subscription.customerName,
    lineItems: [
      {
        variantId: subscription.plan.shopifyVariantId,
        quantity: 1,
        price: subscription.plan.price.toString(),
        properties: deliveryMeta.lineItemProperties,
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
    note: deliveryNote
      ? `iyzico Subscription Payment - Payment ID: ${paymentId || ''} | ${deliveryNote}`
      : undefined,
    noteAttributes: deliveryMeta.noteAttributes,
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
    const deliveryInfo = extractDeliveryInfoFromConversationId(
      payload?.conversationId || body?.conversationId || payload?.referenceCode || body?.referenceCode || ''
    );

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
        const order = await createShopifyOrderForRenewal(subscription, paymentId, deliveryInfo);
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
