/**
 * iyzico islemleri - resmi iyzipay npm paketi kullanilarak
 * Manuel imza/auth hesabi yerine SDK kullanilir, boylece signature hatalari engellenir.
 */
// @ts-ignore - iyzipay resmi SDK, TS tipi yok
const Iyzipay = require('iyzipay');

const iyzipay = new Iyzipay({
  apiKey: (process.env.IYZICO_API_KEY || '').trim(),
  secretKey: (process.env.IYZICO_SECRET_KEY || '').trim(),
  uri: (process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com').trim(),
});

function sdkCall(method, request) {
  return new Promise((resolve, reject) => {
    method.call(method, request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function formatPriceForIyzico(price) {
  const parsed = parseFloat(String(price ?? ''));
  if (!isFinite(parsed)) return '0.0';
  const normalized = parsed.toString();
  return normalized.includes('.') ? normalized : `${normalized}.0`;
}

/**
 * iyzico checkout form baslat (tek seferlik odeme)
 */
export async function initializeCheckoutForm({
  price,
  paidPrice,
  currency = 'TRY',
  basketId,
  callbackUrl,
  buyer,
  shippingAddress,
  billingAddress,
  basketItems,
  paymentGroup = 'PRODUCT',
}) {
  const formattedItems = (basketItems || []).map((item) => ({
    ...item,
    price: formatPriceForIyzico(item.price),
  }));

  const request = {
    locale: 'tr',
    conversationId: basketId,
    price: formatPriceForIyzico(price),
    paidPrice: formatPriceForIyzico(paidPrice),
    currency,
    basketId,
    paymentGroup,
    callbackUrl,
    enabledInstallments: [1],
    buyer,
    shippingAddress,
    billingAddress,
    basketItems: formattedItems,
  };

  return new Promise((resolve, reject) => {
    iyzipay.checkoutFormInitialize.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * iyzico checkout form sonucunu al (tek seferlik)
 */
export async function retrieveCheckoutForm(token) {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutForm.retrieve({ locale: 'tr', token }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: urun olustur
 */
export async function createSubscriptionProduct({ name, description, locale = 'tr', conversationId }) {
  const request = {
    locale,
    conversationId: conversationId || `sub_product_${Date.now()}`,
    name: String(name || 'Abonelik Urunu').slice(0, 200),
    description: String(description || '').slice(0, 1000),
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscriptionProduct.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: fiyat plani olustur
 */
export async function createSubscriptionPricingPlan({
  name,
  price,
  currency = 'TRY',
  paymentInterval = 'MONTHLY',
  paymentIntervalCount = 1,
  productReferenceCode,
  trialPeriodDays = 0,
  locale = 'tr',
  conversationId,
}) {
  if (!productReferenceCode) throw new Error('productReferenceCode gerekli');

  const request = {
    locale,
    conversationId: conversationId || `sub_plan_${Date.now()}`,
    name: String(name || 'Abonelik Plani').slice(0, 200),
    price: formatPriceForIyzico(price),
    currencyCode: currency,
    paymentInterval,
    paymentIntervalCount: Number(paymentIntervalCount) || 1,
    planPaymentType: 'RECURRING',
    trialPeriodDays: Number(trialPeriodDays) || 0,
    productReferenceCode,
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscriptionPricingPlan.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: fiyat plani detayi getir
 */
export async function retrieveSubscriptionPricingPlan({ pricingPlanReferenceCode, locale = 'tr', conversationId }) {
  if (!pricingPlanReferenceCode) throw new Error('pricingPlanReferenceCode gerekli');

  const request = {
    locale,
    conversationId: conversationId || `check_plan_${Date.now()}`,
    pricingPlanReferenceCode,
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscriptionPricingPlan.retrieve(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: checkout baslat
 */
export async function initializeSubscriptionCheckoutForm({
  conversationId,
  pricingPlanReferenceCode,
  subscriptionInitialStatus = 'ACTIVE',
  customer,
  callbackUrl,
  locale = 'tr',
}) {
  const request = {
    locale,
    conversationId: conversationId || `sub_checkout_${Date.now()}`,
    pricingPlanReferenceCode,
    subscriptionInitialStatus,
    customer,
    callbackUrl,
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscriptionCheckoutForm.initialize(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: kart guncelleme checkout baslat
 */
export async function initializeSubscriptionCardUpdateCheckoutForm({
  callbackUrl,
  customerReferenceCode,
  subscriptionReferenceCode,
  conversationId,
  locale = 'tr',
}) {
  if (!callbackUrl) throw new Error('callbackUrl gerekli');
  if (!customerReferenceCode && !subscriptionReferenceCode) {
    throw new Error('customerReferenceCode veya subscriptionReferenceCode gerekli');
  }

  const request = {
    locale,
    conversationId: conversationId || `sub_card_update_${Date.now()}`,
    callbackUrl,
    ...(customerReferenceCode ? { customerReferenceCode } : {}),
    ...(subscriptionReferenceCode ? { subscriptionReferenceCode } : {}),
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscriptionCardUpdateCheckoutForm.initialize(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: checkout sonucu al
 */
export async function retrieveSubscriptionCheckoutForm(token, conversationId?) {
  const request = {
    locale: 'tr',
    token,
    ...(conversationId ? { conversationId } : {}),
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscriptionCheckoutForm.retrieve(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Subscription API: aboneligi iptal et
 */
export async function cancelIyzicoSubscription({ subscriptionReferenceCode, reason, locale = 'tr', conversationId }) {
  const request = {
    locale,
    conversationId: conversationId || `sub_cancel_${Date.now()}`,
    subscriptionReferenceCode,
    ...(reason ? { cancellationReason: reason } : {}),
  };

  return new Promise((resolve, reject) => {
    iyzipay.subscription.cancel(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Kayitli kartla tekrarlayan odeme cek (legacy)
 */
export async function createPaymentWithSavedCard({
  price,
  paidPrice,
  currency = 'TRY',
  conversationId,
  cardUserKey,
  cardToken,
  buyer,
  shippingAddress,
  billingAddress,
  basketItems,
}) {
  const request = {
    locale: 'tr',
    conversationId,
    price: price.toString(),
    paidPrice: paidPrice.toString(),
    currency,
    installment: '1',
    paymentChannel: 'WEB',
    paymentGroup: 'SUBSCRIPTION',
    paymentCard: { cardUserKey, cardToken },
    buyer,
    shippingAddress,
    billingAddress,
    basketItems,
  };

  return new Promise((resolve, reject) => {
    iyzipay.payment.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Kayitli kartlari listele
 */
export async function retrieveCards(cardUserKey) {
  return new Promise((resolve, reject) => {
    iyzipay.cardList.retrieve({ locale: 'tr', cardUserKey }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Odeme iadesi yap (refund)
 */
export async function refundPayment({ paymentTransactionId, price, currency = 'TRY', conversationId }) {
  const request = {
    locale: 'tr',
    conversationId: conversationId || `refund_${Date.now()}`,
    paymentTransactionId,
    price: price.toString(),
    currency,
  };

  return new Promise((resolve, reject) => {
    iyzipay.refund.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
