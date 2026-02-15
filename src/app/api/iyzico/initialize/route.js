import { NextResponse } from 'next/server';
import {
  initializeCheckoutForm,
  initializeSubscriptionCheckoutForm,
  createSubscriptionProduct,
  createSubscriptionPricingPlan,
} from '@/lib/iyzico';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function parseFrequency(freq) {
  let interval = 'MONTHLY';
  let intervalCount = 1;

  if (!freq) return { interval, intervalCount };

  const parts = String(freq).split('_');
  const count = Number.parseInt(parts[0], 10) || 1;
  const unit = (parts[1] || 'month').toLowerCase();

  if (unit === 'week') {
    interval = 'WEEKLY';
    intervalCount = count;
  } else if (unit === 'minute') {
    interval = 'MINUTELY';
    intervalCount = count;
  } else {
    interval = 'MONTHLY';
    intervalCount = count;
  }

  return { interval, intervalCount };
}

function firstCsvValue(value) {
  return String(value || '')
    .split(',')[0]
    .trim();
}

function toIyzicoPaymentInterval(interval, intervalCount) {
  const count = Math.max(1, Number(intervalCount) || 1);

  switch (interval) {
    case 'WEEKLY':
      return { paymentInterval: 'WEEKLY', paymentIntervalCount: count };
    case 'YEARLY':
      return { paymentInterval: 'YEARLY', paymentIntervalCount: count };
    case 'QUARTERLY':
      return { paymentInterval: 'MONTHLY', paymentIntervalCount: count * 3 };
    case 'MINUTELY':
      // Subscription API does not support minutely in production.
      return { paymentInterval: 'DAILY', paymentIntervalCount: 1 };
    case 'MONTHLY':
    default:
      return { paymentInterval: 'MONTHLY', paymentIntervalCount: count };
  }
}

function parseAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  let normalized = raw
    .replace(/\s+/g, '')
    .replace(/₺/g, '')
    .replace(/TL/gi, '')
    .replace(/[^0-9,.-]/g, '');

  if (!normalized) return 0;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  const separatorIndex = Math.max(lastComma, lastDot);

  if (separatorIndex >= 0) {
    const fractionalRaw = normalized.slice(separatorIndex + 1).replace(/[.,]/g, '');
    const separatorCount = (normalized.match(/[.,]/g) || []).length;
    const isLikelyThousandsOnly = separatorCount === 1 && fractionalRaw.length === 3;

    if (isLikelyThousandsOnly) {
      normalized = normalized.replace(/[.,]/g, '');
    } else {
      const integerPart = normalized.slice(0, separatorIndex).replace(/[.,]/g, '');
      const fractionPart = fractionalRaw;
      normalized = `${integerPart}.${fractionPart}`;
    }
  } else {
    normalized = normalized.replace(/[.,]/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRequestedPlanPrice(productPrice, cartItems) {
  const fromTotal = parseAmount(productPrice);
  if (fromTotal > 0) return fromTotal;

  if (!Array.isArray(cartItems) || cartItems.length === 0) return 0;

  return cartItems.reduce((sum, item) => {
    const linePrice = parseAmount(item?.line_price);
    if (linePrice > 0) return sum + linePrice;

    const unit = parseAmount(item?.price);
    const quantity = Math.max(1, Number.parseInt(item?.quantity, 10) || 1);
    return sum + (unit > 0 ? unit * quantity : 0);
  }, 0);
}

async function ensureIyzicoPlanReferences(plan) {
  let productReferenceCode = plan.iyzicoProductReferenceCode;
  let pricingPlanReferenceCode = plan.iyzicoPricingPlanReferenceCode;

  if (!productReferenceCode) {
    let productResult = await createSubscriptionProduct({
      name: `${plan.name}`,
      description: plan.description || `Plan ${plan.id}`,
      conversationId: `create_product_${plan.id}`,
    });

    // Some merchants return "Urun zaten var." when same product name is reused.
    // Retry once with a unique product name and keep the created reference on this plan.
    const normalizedProductError = String(productResult.errorMessage || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      productResult.status !== 'success' &&
      normalizedProductError.includes('urun zaten var')
    ) {
      productResult = await createSubscriptionProduct({
        name: `${plan.name} - ${plan.id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
        description: plan.description || `Plan ${plan.id}`,
        conversationId: `create_product_retry_${plan.id}`,
      });
    }

    if (productResult.status !== 'success') {
      throw new Error(productResult.errorMessage || 'iyzico product olusturulamadi');
    }

    productReferenceCode =
      productResult.data?.referenceCode ||
      productResult.referenceCode ||
      productResult.data?.productReferenceCode;

    if (!productReferenceCode) {
      throw new Error('iyzico product reference code alinmadi');
    }
  }

  if (!pricingPlanReferenceCode) {
    const mapped = toIyzicoPaymentInterval(plan.interval, plan.intervalCount);

    const pricingResult = await createSubscriptionPricingPlan({
      name: `${plan.name}`,
      price: plan.price,
      currency: plan.currency || 'TRY',
      paymentInterval: mapped.paymentInterval,
      paymentIntervalCount: mapped.paymentIntervalCount,
      productReferenceCode,
      trialPeriodDays: plan.trialDays || 0,
      conversationId: `create_pricing_${plan.id}`,
    });

    if (pricingResult.status !== 'success') {
      throw new Error(pricingResult.errorMessage || 'iyzico pricing plan olusturulamadi');
    }

    pricingPlanReferenceCode =
      pricingResult.data?.referenceCode ||
      pricingResult.referenceCode ||
      pricingResult.data?.pricingPlanReferenceCode;

    if (!pricingPlanReferenceCode) {
      throw new Error('iyzico pricing plan reference code alinmadi');
    }
  }

  if (
    plan.iyzicoProductReferenceCode !== productReferenceCode ||
    plan.iyzicoPricingPlanReferenceCode !== pricingPlanReferenceCode
  ) {
    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        iyzicoProductReferenceCode: productReferenceCode,
        iyzicoPricingPlanReferenceCode: pricingPlanReferenceCode,
      },
    });
  }

  return { productReferenceCode, pricingPlanReferenceCode };
}

/**
 * POST /api/iyzico/initialize
 * Starts iyzico checkout for one-time and subscription flows.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      type = 'subscription',
      planId,
      productId,
      productPrice,
      productName,
      variantId,
      cartItems = [],
      subscriptionFrequency,
      customerEmail,
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerIdentityNumber,
    } = body;

    const basketId = uuidv4();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '85.34.78.112';

    // Subscription flow: iyzico Subscription API
    if (type === 'subscription') {
      let plan = null;
      const requestedPlanPrice = getRequestedPlanPrice(productPrice, cartItems);

      const { interval, intervalCount } = parseFrequency(subscriptionFrequency);
      const firstItem = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems[0] : null;
      const normalizedProductId = firstItem?.id ? String(firstItem.id) : firstCsvValue(productId);
      const normalizedVariantId = firstItem?.variant_id ? String(firstItem.variant_id) : firstCsvValue(variantId);

      if (planId) {
        plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          return NextResponse.json({ error: 'Plan bulunamadi' }, { status: 404 });
        }

        if (!plan.active) {
          plan = await prisma.plan.findFirst({
            where: {
              active: true,
              interval,
              intervalCount,
              OR: [
                ...(plan.shopifyProductId ? [{ shopifyProductId: String(plan.shopifyProductId) }] : []),
                ...(plan.shopifyVariantId ? [{ shopifyVariantId: String(plan.shopifyVariantId) }] : []),
              ],
            },
            orderBy: { updatedAt: 'desc' },
          });
        }
      } else if (normalizedProductId) {
        plan = await prisma.plan.findFirst({
          where: {
            active: true,
            shopifyProductId: normalizedProductId,
            interval,
            intervalCount,
            ...(normalizedVariantId ? { OR: [{ shopifyVariantId: normalizedVariantId }, { shopifyVariantId: null }] } : {}),
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (!plan) {
          const autoPrice = requestedPlanPrice;
          if (autoPrice <= 0) {
            return NextResponse.json({ error: 'Gecersiz fiyat' }, { status: 400 });
          }

          plan = await prisma.plan.create({
            data: {
              name: productName || 'Abonelik Plani',
              description: `Shopify urunu: ${productName || normalizedProductId}`,
              price: autoPrice,
              currency: 'TRY',
              interval,
              intervalCount,
              shopifyProductId: normalizedProductId,
              shopifyVariantId: normalizedVariantId || null,
              active: true,
            },
          });
        }
      } else {
        return NextResponse.json({ error: 'Abonelik icin plan veya urun bilgisi gerekli' }, { status: 400 });
      }

      if (!plan || !plan.active) {
        return NextResponse.json(
          {
            error: 'Bu plan aktif degil',
            details: 'Secilen plan pasif/arsivde. Panelden plani yeniden urune uygula.',
          },
          { status: 400 }
        );
      }

      // Keep iyzico pricing plan in sync with current checkout total (KDV dahil fiyat).
      if (requestedPlanPrice > 0 && Math.abs(Number(plan.price || 0) - requestedPlanPrice) > 0.01) {
        plan = await prisma.plan.update({
          where: { id: plan.id },
          data: {
            price: requestedPlanPrice,
            iyzicoPricingPlanReferenceCode: null,
          },
        });
      }

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
          iyzicoSubscriptionRef: null,
        },
      });

      const { pricingPlanReferenceCode } = await ensureIyzicoPlanReferences(plan);

      const subscriptionResult = await initializeSubscriptionCheckoutForm({
        conversationId: `sub_checkout_${subscription.id}`,
        pricingPlanReferenceCode,
        subscriptionInitialStatus: 'ACTIVE',
        callbackUrl: `${appUrl}/api/iyzico/callback?subscriptionId=${subscription.id}`,
        customer: {
          name: customerName,
          surname: customerName,
          email: customerEmail,
          gsmNumber: customerPhone || '+905350000000',
          identityNumber: customerIdentityNumber || '11111111111',
          billingAddress: {
            contactName: customerName,
            city: customerCity || 'Istanbul',
            country: 'Turkey',
            address: customerAddress || 'Istanbul Turkiye',
            zipCode: '34000',
          },
          shippingAddress: {
            contactName: customerName,
            city: customerCity || 'Istanbul',
            country: 'Turkey',
            address: customerAddress || 'Istanbul Turkiye',
            zipCode: '34000',
          },
          ip: clientIp,
        },
      });

      if (subscriptionResult.status === 'success') {
        const token = subscriptionResult.token;
        const paymentPageUrl =
          subscriptionResult.checkoutFormPageUrl ||
          subscriptionResult.paymentPageUrl ||
          (token ? `https://cpp.iyzipay.com?token=${encodeURIComponent(token)}&lang=tr` : null);

        return NextResponse.json({
          success: true,
          checkoutFormContent: subscriptionResult.checkoutFormContent,
          paymentPageUrl,
          token,
        });
      }

      console.error('iyzico subscription initialize error:', JSON.stringify(subscriptionResult));
      return NextResponse.json(
        {
          error: 'iyzico abonelik checkout baslatilamadi',
          details: subscriptionResult.errorMessage,
          errorCode: subscriptionResult.errorCode,
        },
        { status: 400 }
      );
    }

    // One-time flow: existing checkout form API
    const price = parseAmount(productPrice);
    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Gecersiz fiyat' }, { status: 400 });
    }

    const itemName = productName || 'Urun';
    const itemId = productId || `PROD-${basketId.substring(0, 8)}`;

    const nameParts = String(customerName || '').trim().split(' ');
    const firstName = nameParts[0] || 'Musteri';
    const lastName = nameParts.slice(1).join(' ') || 'Musteri';

    const result = await initializeCheckoutForm({
      price,
      paidPrice: price,
      currency: 'TRY',
      basketId,
      callbackUrl: `${appUrl}/api/iyzico/callback?type=single&productId=${productId || ''}&variantId=${variantId || ''}`,
      buyer: {
        id: `BUYER-${basketId.substring(0, 8)}`,
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
          category1: 'Urun',
          itemType: 'VIRTUAL',
          price: price.toString(),
        },
      ],
      paymentGroup: 'PRODUCT',
    });

    if (result.status === 'success') {
      return NextResponse.json({
        success: true,
        checkoutFormContent: result.checkoutFormContent,
        paymentPageUrl: result.paymentPageUrl,
        token: result.token,
      });
    }

    console.error('iyzico one-time initialize error:', JSON.stringify(result));
    return NextResponse.json(
      {
        error: 'iyzico checkout baslatilamadi',
        details: result.errorMessage,
        errorCode: result.errorCode,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('iyzico initialize error:', error);
    return NextResponse.json(
      {
        error: 'Bir hata olustu',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
