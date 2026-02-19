import { NextResponse } from 'next/server';
import {
  retrieveCheckoutForm,
  retrieveSubscriptionCheckoutForm,
  createIyzicoSubscription,
  createSubscriptionCustomer,
  retrieveIyzicoSubscriptions,
  refundPayment,
} from '@/lib/iyzico';
import { createOrder } from '@/lib/shopify';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[çÇ]/g, 'c')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isSystemLevelIyzicoError(message) {
  const m = normalizeText(message);
  return (
    m.includes('sistem hatasi') ||
    m.includes('system error') ||
    m.includes('internal server error') ||
    m.includes('gecici')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function splitCustomerName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const name = parts[0] || 'Musteri';
  const surname = parts.slice(1).join(' ') || 'Musteri';
  return { name, surname };
}


function firstCsvValue(value) {
  return String(value || '')
    .split(',')[0]
    .trim();
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

function mergeDeliveryInfo(primary = {}, fallback = {}) {
  return {
    deliveryDate: String(primary.deliveryDate || fallback.deliveryDate || '').trim(),
    deliveryDay: String(primary.deliveryDay || fallback.deliveryDay || '').trim(),
    deliveryDayName: String(primary.deliveryDayName || fallback.deliveryDayName || '').trim(),
  };
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

function parseSubscriptionCallbackToken(raw = '') {
  const value = String(raw || '').trim();
  if (!value) {
    return {
      subscriptionId: '',
      deliveryInfo: { deliveryDate: '', deliveryDay: '', deliveryDayName: '' },
    };
  }

  const marker = '__dlv_';
  const idx = value.indexOf(marker);
  if (idx < 0) {
    return {
      subscriptionId: value,
      deliveryInfo: { deliveryDate: '', deliveryDay: '', deliveryDayName: '' },
    };
  }

  const subscriptionId = value.slice(0, idx).trim();
  const token = value.slice(idx + marker.length).trim();
  if (!token) {
    return {
      subscriptionId,
      deliveryInfo: { deliveryDate: '', deliveryDay: '', deliveryDayName: '' },
    };
  }

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [deliveryDate = '', deliveryDay = '', deliveryDayName = ''] = decoded.split('~');
    return {
      subscriptionId,
      deliveryInfo: {
        deliveryDate: String(deliveryDate || '').trim(),
        deliveryDay: String(deliveryDay || '').trim(),
        deliveryDayName: String(deliveryDayName || '').trim(),
      },
    };
  } catch (_) {
    return {
      subscriptionId,
      deliveryInfo: { deliveryDate: '', deliveryDay: '', deliveryDayName: '' },
    };
  }
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

function encodeDeliveryInfoForConversation(deliveryInfo = {}) {
  const deliveryDate = firstCsvValue(deliveryInfo.deliveryDate || '').trim();
  const deliveryDay = firstCsvValue(deliveryInfo.deliveryDay || '').trim();
  const deliveryDayName = firstCsvValue(deliveryInfo.deliveryDayName || '').trim();

  if (!deliveryDate && !deliveryDay && !deliveryDayName) return '';

  const compact = `${deliveryDate}~${deliveryDay}~${deliveryDayName}`;
  return Buffer.from(compact, 'utf8').toString('base64url');
}

function buildCheckoutConversationIdCandidates(subscriptionToken, subscriptionId, deliveryInfo = {}) {
  const candidates = [];
  const push = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  push(`sub_checkout_${subscriptionToken || ''}`);
  push(`sub_checkout_${subscriptionId || ''}`);

  const deliveryToken = encodeDeliveryInfoForConversation(deliveryInfo);
  if (deliveryToken && subscriptionId) {
    push(`sub_checkout_${subscriptionId}__dlv_${deliveryToken}`);
  }

  return candidates;
}

async function retrieveSubscriptionCheckoutWithCandidates(token, conversationIdCandidates = []) {
  let lastResult = null;
  let usedConversationId = conversationIdCandidates[0] || '';

  for (const candidate of conversationIdCandidates) {
    usedConversationId = candidate;
    const result = await retrieveSubscriptionCheckoutForm(token, candidate);
    lastResult = result;
    if (result?.status === 'success') return { result, usedConversationId };
    if (!isSystemLevelIyzicoError(result?.errorMessage || '')) {
      return { result, usedConversationId };
    }
  }

  return { result: lastResult || { status: 'failure', errorMessage: 'iyzico retrieve response is empty' }, usedConversationId };
}

async function createShopifyOrderForSubscription(subscription, paymentId, tags = [], deliveryInfo = {}) {
  if (!subscription?.plan?.shopifyVariantId) return null;
  const deliveryMeta = buildDeliveryMeta(deliveryInfo);
  const deliveryNote = buildDeliveryNote(deliveryInfo);

  const shopifyOrder = await createOrder({
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
    const subscriptionToken = url.searchParams.get('subscriptionId') || '';
    const parsedSubscription = parseSubscriptionCallbackToken(subscriptionToken);
    const subscriptionId = parsedSubscription.subscriptionId;
    let deliveryInfo = {
      deliveryDate: url.searchParams.get('deliveryDate') || '',
      deliveryDay: url.searchParams.get('deliveryDay') || '',
      deliveryDayName: url.searchParams.get('deliveryDayName') || '',
    };
    deliveryInfo = mergeDeliveryInfo(deliveryInfo, parsedSubscription.deliveryInfo);
    const checkoutConversationIdCandidates = buildCheckoutConversationIdCandidates(
      subscriptionToken,
      parsedSubscription.subscriptionId,
      deliveryInfo
    );
    const paymentType = url.searchParams.get('type');
    console.info('[iyzico/callback] incoming', {
      paymentType: paymentType || null,
      hasSubscriptionId: Boolean(subscriptionId),
      hasToken: Boolean(token),
    });

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

    let { result: subscriptionResult, usedConversationId } = await retrieveSubscriptionCheckoutWithCandidates(
      token,
      checkoutConversationIdCandidates
    );
    console.log('iyzico subscription callback result (attempt 1):', JSON.stringify(subscriptionResult, null, 2));
    console.info('[iyzico/callback] retrieve attempt conversation candidates', {
      candidates: checkoutConversationIdCandidates,
      usedConversationId,
    });

    // iyzico can transiently return "Sistem hatasi" even when payment is approved.
    // Retry several times before deciding failure to avoid false-negative statuses.
    if (subscriptionResult.status !== 'success' && isSystemLevelIyzicoError(subscriptionResult.errorMessage)) {
      for (let i = 0; i < 4; i += 1) {
        await sleep(1500);
        const retryResponse = await retrieveSubscriptionCheckoutWithCandidates(token, checkoutConversationIdCandidates);
        const retryResult = retryResponse.result;
        usedConversationId = retryResponse.usedConversationId || usedConversationId;
        console.log(
          `iyzico subscription callback retry result (attempt ${i + 2}):`,
          JSON.stringify(retryResult, null, 2)
        );
        subscriptionResult = retryResult;
        if (subscriptionResult.status === 'success' || !isSystemLevelIyzicoError(subscriptionResult.errorMessage)) {
          break;
        }
      }
    }
    deliveryInfo = mergeDeliveryInfo(
      deliveryInfo,
      extractDeliveryInfoFromConversationId(
        subscriptionResult?.conversationId || subscriptionResult?.data?.conversationId || ''
      )
    );

    const recoveryTrace = [];

    const retrieveErrorMessage =
      subscriptionResult.status === 'success'
        ? ''
        : subscriptionResult.errorMessage || 'iyzico retrieve checkout basarisiz';
    if (retrieveErrorMessage) {
      recoveryTrace.push(`retrieve_failed:${retrieveErrorMessage}`);
      console.error('iyzico subscription checkout retrieve failed, running recovery flow:', {
        subscriptionId,
        message: retrieveErrorMessage,
        tokenTail: String(token || '').slice(-8),
        planRef: subscription.plan?.iyzicoPricingPlanReferenceCode || null,
        hasStoredCustomerRef: Boolean(subscription.iyzicoCustomerRef),
      });
    }

    let resultData = subscriptionResult.data || {};
    let iyzicoSubRef =
      resultData.subscriptionReferenceCode ||
      resultData.subscription?.referenceCode ||
      resultData.subscription?.subscriptionReferenceCode ||
      subscriptionResult.subscriptionReferenceCode ||
      resultData.referenceCode ||
      null;
    let iyzicoCustomerRef =
      resultData.customerReferenceCode ||
      resultData.customer?.referenceCode ||
      resultData.customer?.customerReferenceCode ||
      subscriptionResult.customerReferenceCode ||
      subscriptionResult.customer?.referenceCode ||
      subscription.iyzicoCustomerRef ||
      null;

    // iyzico bazen checkout retrieve cevabini success donse de subscription ref'i birkac saniye gecikmeli uretebiliyor.
    // Bu durumda hemen failure'a dusmeden yeniden sorgulayip referansi almaya calis.
    if (!iyzicoSubRef) {
      for (let i = 0; i < 4; i += 1) {
        await sleep(1500);
        const retryResponse = await retrieveSubscriptionCheckoutWithCandidates(token, checkoutConversationIdCandidates);
        const retryResult = retryResponse.result;
        usedConversationId = retryResponse.usedConversationId || usedConversationId;
        console.log(
          `iyzico subscription callback ref retry (attempt ${i + 2}):`,
          JSON.stringify(retryResult, null, 2)
        );

        if (retryResult?.status === 'success') {
          subscriptionResult = retryResult;
          resultData = retryResult.data || {};
          iyzicoSubRef =
            resultData.subscriptionReferenceCode ||
            resultData.subscription?.referenceCode ||
            resultData.subscription?.subscriptionReferenceCode ||
            retryResult.subscriptionReferenceCode ||
            resultData.referenceCode ||
            iyzicoSubRef ||
            null;
          iyzicoCustomerRef =
            resultData.customerReferenceCode ||
            resultData.customer?.referenceCode ||
            resultData.customer?.customerReferenceCode ||
            retryResult.customerReferenceCode ||
            retryResult.customer?.referenceCode ||
            iyzicoCustomerRef ||
            null;
        }

        if (iyzicoSubRef) {
          break;
        }
      }
    }

    let createSubscriptionError = '';

    if (!iyzicoSubRef && !iyzicoCustomerRef) {
      console.info('[iyzico/callback] attempting customer creation fallback', { subscriptionId });
      try {
        const { name: customerFirstName, surname: customerLastName } = splitCustomerName(subscription.customerName);
        const createdCustomer = await createSubscriptionCustomer({
          conversationId: `sub_customer_${subscriptionId}`,
          customer: {
            name: customerFirstName,
            surname: customerLastName,
            email: subscription.customerEmail,
            gsmNumber: subscription.customerPhone || '+905350000000',
            identityNumber: '74300864791',
            billingAddress: {
              contactName: subscription.customerName || 'Musteri',
              city: subscription.customerCity || 'Istanbul',
              country: 'Turkey',
              address: subscription.customerAddress || 'Istanbul Turkiye',
              zipCode: '34000',
            },
            shippingAddress: {
              contactName: subscription.customerName || 'Musteri',
              city: subscription.customerCity || 'Istanbul',
              country: 'Turkey',
              address: subscription.customerAddress || 'Istanbul Turkiye',
              zipCode: '34000',
            },
            ip: subscription.customerIp || '127.0.0.1',
          },
        });

        if (createdCustomer?.status === 'success') {
          const customerData = createdCustomer.data || {};
          iyzicoCustomerRef =
            customerData.referenceCode ||
            customerData.customerReferenceCode ||
            customerData.customer?.referenceCode ||
            createdCustomer.referenceCode ||
            createdCustomer.customerReferenceCode ||
            iyzicoCustomerRef ||
            null;
        } else {
          createSubscriptionError = createdCustomer?.errorMessage || 'iyzico customer create failed';
          recoveryTrace.push(`customer_create_failed:${createSubscriptionError}`);
          console.error(
            'iyzico customer create after checkout failed:',
            JSON.stringify(createdCustomer, null, 2)
          );
        }
      } catch (customerError) {
        createSubscriptionError = customerError?.message || 'iyzico customer create unexpected error';
        recoveryTrace.push(`customer_create_error:${createSubscriptionError}`);
        console.error('iyzico customer create after checkout error:', customerError);
      }
    }

    if (!iyzicoSubRef && (iyzicoCustomerRef || subscription.plan?.iyzicoPricingPlanReferenceCode)) {
      console.info('[iyzico/callback] attempting subscription creation fallback', {
        subscriptionId,
        customerRefTail: String(iyzicoCustomerRef || '').slice(-8),
        planRef: subscription.plan?.iyzicoPricingPlanReferenceCode || null,
      });
      try {
        const createResult = await createIyzicoSubscription({
          pricingPlanReferenceCode: subscription.plan.iyzicoPricingPlanReferenceCode,
          customerReferenceCode: iyzicoCustomerRef,
          subscriptionInitialStatus: 'ACTIVE',
          conversationId: `sub_create_${subscriptionId}`,
        });

        if (createResult?.status === 'success') {
          const createData = createResult.data || {};
          iyzicoSubRef =
            createData.subscriptionReferenceCode ||
            createData.subscription?.referenceCode ||
            createData.subscription?.subscriptionReferenceCode ||
            createResult.subscriptionReferenceCode ||
            createData.referenceCode ||
            null;

          if (!iyzicoSubRef) {
            createSubscriptionError = 'iyzico subscription create succeeded but subscriptionReferenceCode was empty';
            recoveryTrace.push('subscription_create_success_but_ref_empty');
          }
        } else {
          createSubscriptionError = createResult?.errorMessage || 'iyzico subscription create failed';
          recoveryTrace.push(`subscription_create_failed:${createSubscriptionError}`);
          console.error(
            'iyzico subscription create after checkout failed:',
            JSON.stringify(createResult, null, 2)
          );
        }
      } catch (createError) {
        createSubscriptionError = createError?.message || 'iyzico subscription create unexpected error';
        recoveryTrace.push(`subscription_create_error:${createSubscriptionError}`);
        console.error('iyzico subscription create after checkout error:', createError);
      }
    }

    // Son fallback: iyzico'da abonelik olusmus ama create/retrieve response'una yansimamis olabilir.
    // Musteri + pricing plan ile listeleyip aktif/olusturulmus en guncel abonelik referansini yakala.
    if (!iyzicoSubRef && (iyzicoCustomerRef || subscription.plan?.iyzicoPricingPlanReferenceCode)) {
      console.info('[iyzico/callback] attempting subscription listing fallback', {
        subscriptionId,
        customerRefTail: String(iyzicoCustomerRef || '').slice(-8),
        planRef: subscription.plan?.iyzicoPricingPlanReferenceCode || null,
      });
      try {
        const listedResult = await retrieveIyzicoSubscriptions({
          customerReferenceCode: iyzicoCustomerRef || undefined,
          pricingPlanReferenceCode: subscription.plan?.iyzicoPricingPlanReferenceCode || undefined,
          conversationId: `sub_list_${subscriptionId}`,
          page: 1,
          count: 50,
        });

        if (listedResult?.status === 'success') {
          const rows = listedResult?.data?.items || listedResult?.data || listedResult?.items || [];
          const normalized = Array.isArray(rows) ? rows : [];
          const allowedStatuses = new Set(['ACTIVE', 'TRIALING', 'PENDING']);

          const scoped = normalized.filter((row) =>
            allowedStatuses.has(String(row?.status || '').toUpperCase())
          );

          const byConversation = scoped.find((row) =>
            [
              row?.conversationId,
              row?.initialConversationId,
              row?.referenceCode,
              row?.subscriptionReferenceCode,
            ]
              .map((v) => String(v || ''))
              .some((v) => v.includes(subscriptionId))
          );

          const sortByRecent = (items) =>
            [...items].sort((a, b) => {
              const aTs =
                Date.parse(a?.updatedDate || a?.updatedAt || a?.createdDate || a?.createdAt || a?.startDate || 0) || 0;
              const bTs =
                Date.parse(b?.updatedDate || b?.updatedAt || b?.createdDate || b?.createdAt || b?.startDate || 0) || 0;
              return bTs - aTs;
            });

          const recentScoped = sortByRecent(scoped);
          const recentAll = sortByRecent(normalized);
          const chosen = byConversation || recentScoped[0] || recentAll[0] || null;

          if (chosen) {
            recoveryTrace.push('subscription_list_selected_row');
            console.info('[iyzico/callback] subscription listing fallback selected row', {
              subscriptionId,
              status: chosen.status || null,
              conversationId: chosen.conversationId || chosen.initialConversationId || null,
              refTail: String(chosen.subscriptionReferenceCode || chosen.referenceCode || '').slice(-8),
            });
            iyzicoSubRef =
              chosen.subscriptionReferenceCode ||
              chosen.referenceCode ||
              chosen?.subscription?.referenceCode ||
              null;
          }
        } else {
          recoveryTrace.push(`subscription_list_failed:${listedResult?.errorMessage || 'unknown'}`);
          console.error('iyzico subscription list fallback failed:', JSON.stringify(listedResult, null, 2));
        }
      } catch (listError) {
        recoveryTrace.push(`subscription_list_error:${listError?.message || String(listError || '')}`);
        console.error('iyzico subscription list fallback error:', listError);
      }
    }

    if (!iyzicoSubRef) {
      const missingRefError =
        createSubscriptionError ||
        retrieveErrorMessage ||
        (!iyzicoCustomerRef
          ? 'customerReferenceCode alinmadi'
          : !subscription.plan?.iyzicoPricingPlanReferenceCode
            ? 'pricingPlanReferenceCode bulunamadi'
            : 'subscriptionReferenceCode alinmadi');

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'PAYMENT_FAILED' },
      });

      await prisma.payment.create({
        data: {
          amount: subscription.plan.price,
          currency: subscription.plan.currency || 'TRY',
          status: 'FAILED',
          errorMessage: `Abonelik referansi olusmadi: ${missingRefError}${recoveryTrace.length ? ` | trace=${recoveryTrace.join(' > ')}` : ''}`,
          subscriptionId,
        },
      });

      console.error('[iyzico/callback] subscription reference recovery failed', {
        subscriptionId,
        missingRefError,
        hasCustomerRef: Boolean(iyzicoCustomerRef),
        planRef: subscription.plan?.iyzicoPricingPlanReferenceCode || null,
      });
      return redirectToResult('error', 'Odeme alindi ancak iyzico abonelik olusmadi. Lutfen tekrar deneyin.');
    }

    console.info('[iyzico/callback] subscription reference resolved', {
      subscriptionId,
      subRefTail: String(iyzicoSubRef || '').slice(-8),
      customerRefTail: String(iyzicoCustomerRef || '').slice(-8),
    });

    const now = new Date();
    const nextPaymentDate = calculateNextPaymentDate(now, subscription.plan.interval, subscription.plan.intervalCount);

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        iyzicoSubscriptionRef: iyzicoSubRef || subscription.iyzicoSubscriptionRef,
        iyzicoCustomerRef: iyzicoCustomerRef || subscription.iyzicoCustomerRef,
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

    let createdPayment = null;
    if (paymentId) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          subscriptionId,
          iyzicoPaymentId: String(paymentId),
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existingPayment) {
        createdPayment = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: 'SUCCESS',
            errorMessage: null,
            iyzicoPaymentId: String(paymentId),
          },
        });
      }
    }

    if (!createdPayment) {
      createdPayment = await prisma.payment.create({
        data: {
          amount: subscription.plan.price,
          currency: subscription.plan.currency || 'TRY',
          status: 'SUCCESS',
          iyzicoPaymentId: paymentId ? String(paymentId) : null,
          subscriptionId,
        },
      });
    }

    try {
      const shopifyOrder = await createShopifyOrderForSubscription(
        subscription,
        paymentId,
        ['abonelik', 'ilk-odeme'],
        deliveryInfo
      );
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
