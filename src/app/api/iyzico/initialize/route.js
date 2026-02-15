import { NextResponse } from 'next/server';
import { initializeCheckoutForm } from '@/lib/iyzico';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function parseFrequency(freq) {
  let interval = 'MONTHLY';
  let intervalCount = 1;

  if (!freq) return { interval, intervalCount };

  const parts = String(freq).split('_');
  const count = parseInt(parts[0], 10) || 1;
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
  return String(value || '').split(',')[0].trim();
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

    let price;
    let itemName;
    let itemId;
    let callbackParam;

    const basketId = uuidv4();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '85.34.78.112';

    if (type === 'subscription') {
      let plan = null;

      const { interval, intervalCount } = parseFrequency(subscriptionFrequency);
      const firstItem = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems[0] : null;
      const normalizedProductId = firstItem?.id ? String(firstItem.id) : firstCsvValue(productId);
      const normalizedVariantId = firstItem?.variant_id ? String(firstItem.variant_id) : firstCsvValue(variantId);

      if (planId) {
        plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          return NextResponse.json({ error: 'Plan bulunamadi' }, { status: 404 });
        }

        // If this exact plan is archived, attempt to find an active equivalent.
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
        // Prefer active plan matching product + frequency (+ variant when available)
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
          const autoPrice = parseFloat(productPrice) || 0;
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
            error: 'Bu plan artik aktif degil',
            details: 'Secilen plan pasif/arsivde. Panelden plani yeniden urune uygula.',
          },
          { status: 400 }
        );
      }

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
      price = parseFloat(productPrice);
      if (!price || price <= 0) {
        return NextResponse.json({ error: 'Gecersiz fiyat' }, { status: 400 });
      }
      itemName = productName || 'Urun';
      itemId = productId || `PROD-${basketId.substring(0, 8)}`;
      callbackParam = `type=single&productId=${productId || ''}&variantId=${variantId || ''}`;
    }

    const nameParts = String(customerName || '').trim().split(' ');
    const firstName = nameParts[0] || 'Musteri';
    const lastName = nameParts.slice(1).join(' ') || 'Musteri';

    const result = await initializeCheckoutForm({
      price,
      paidPrice: price,
      currency: 'TRY',
      basketId,
      callbackUrl: `${appUrl}/api/iyzico/callback?${callbackParam}`,
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
          category1: type === 'subscription' ? 'Abonelik' : 'Urun',
          itemType: 'VIRTUAL',
          price: price.toString(),
        },
      ],
      paymentGroup: type === 'subscription' ? 'SUBSCRIPTION' : 'PRODUCT',
    });

    if (result.status === 'success') {
      return NextResponse.json({
        success: true,
        checkoutFormContent: result.checkoutFormContent,
        paymentPageUrl: result.paymentPageUrl,
        token: result.token,
      });
    }

    console.error('iyzico error:', JSON.stringify(result));
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

