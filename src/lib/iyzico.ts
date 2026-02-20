import crypto from 'crypto';

/**
 * iyzico REST API client - native fetch ile (iyzipay SDK Turbopack ile uyumsuz)
 *
 * Resmi iyzipay SDK kaynak kodu (lib/utils.js) incelenerek dogrulanan imza formulu:
 * signature = HMAC-SHA256(secretKey, randomString + uri + JSON.stringify(body))
 * Header: IYZWSv2 base64("apiKey:VALUE&randomKey:VALUE&signature:VALUE")
 *
 * NOT: apiKey imzanin ICINE dahil EDILMEZ, sadece base64 headerda gider.
 */

const API_KEY = (process.env.IYZICO_API_KEY || '').trim();
const SECRET_KEY = (process.env.IYZICO_SECRET_KEY || '').trim();
const BASE_URL = (process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com').trim();

function generateRandomString() {
  // SDK ile ayni format: hrtime[0] + random
  return Date.now().toString() + Math.random().toString(36).slice(2, 10);
}

function generateAuthorizationHeader(uri: string, body: object, randomString: string): string {
  // Resmi SDK utils.js - generateHashV2:
  // HMAC-SHA256(secretKey, randomString + uri + JSON.stringify(body))
  const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(randomString + uri + bodyString)
    .digest('hex');

  const authorizationParams = [
    'apiKey:' + API_KEY,
    'randomKey:' + randomString,
    'signature:' + signature,
  ];

  return 'IYZWSv2 ' + Buffer.from(authorizationParams.join('&')).toString('base64');
}

async function iyzicoRequest(path: string, body: object, method = 'POST'): Promise<any> {
  const randomString = generateRandomString();
  const payload = body || {};
  const pathForSignature = path.split('?')[0];

  const authorization = generateAuthorizationHeader(
    pathForSignature,
    method === 'GET' ? {} : payload,
    randomString
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: authorization,
    'x-iyzi-rnd': randomString,
    'x-iyzi-client-version': 'iyzipay-node-2.0.65',
  };

  console.info('[iyzico] REQUEST', {
    url: BASE_URL + path,
    method,
    authType: 'IYZWSv2',
    formula: 'HMAC-SHA256(secretKey, randomString + uri + body)',
    apiKeyPrefix: API_KEY ? API_KEY.slice(0, 8) + '...' : 'EKSIK',
    bodyKeys: Object.keys(payload),
  });

  const response = await fetch(BASE_URL + path, {
    method,
    headers,
    ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }),
  });

  const raw = await response.text();
  console.info('[iyzico] RESPONSE', {
    url: BASE_URL + path,
    httpStatus: response.status,
    rawBody: raw.slice(0, 400),
  });

  try {
    return JSON.parse(raw);
  } catch {
    return {
      status: 'failure',
      errorCode: String(response.status || ''),
      errorMessage: 'Non-JSON response from iyzico',
      rawResponseSnippet: raw.slice(0, 500),
    };
  }
}

function formatPriceForIyzico(price: any): string {
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
}: any) {
  const formattedItems = (basketItems || []).map((item: any) => ({
    ...item,
    price: formatPriceForIyzico(item.price),
  }));

  const body = {
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

  return await iyzicoRequest('/payment/iyzipos/checkoutform/initialize/auth/ecom', body);
}

/**
 * iyzico checkout form sonucunu al (tek seferlik)
 */
export async function retrieveCheckoutForm(token: string) {
  const body = { locale: 'tr', token };
  return await iyzicoRequest('/payment/iyzipos/checkoutform/auth/ecom/detail', body);
}

/**
 * Subscription API: urun olustur
 */
export async function createSubscriptionProduct({ name, description, locale = 'tr', conversationId }: any) {
  const body: any = {
    locale,
    conversationId: conversationId || `sub_product_${Date.now()}`,
    name: String(name || 'Abonelik Urunu').slice(0, 200),
    description: String(description || '').slice(0, 1000),
  };

  return await iyzicoRequest('/v2/subscription/products', body);
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
}: any) {
  if (!productReferenceCode) throw new Error('productReferenceCode gerekli');

  const body = {
    locale,
    conversationId: conversationId || `sub_plan_${Date.now()}`,
    name: String(name || 'Abonelik Plani').slice(0, 200),
    price: formatPriceForIyzico(price),
    currencyCode: currency,
    paymentInterval,
    paymentIntervalCount: Number(paymentIntervalCount) || 1,
    planPaymentType: 'RECURRING',
    trialPeriodDays: Number(trialPeriodDays) || 0,
  };

  return await iyzicoRequest(`/v2/subscription/products/${productReferenceCode}/pricing-plans`, body);
}

/**
 * Subscription API: fiyat plani detayi getir (GET)
 */
export async function retrieveSubscriptionPricingPlan({ pricingPlanReferenceCode, locale = 'tr', conversationId }: any) {
  if (!pricingPlanReferenceCode) throw new Error('pricingPlanReferenceCode gerekli');

  const query = new URLSearchParams();
  if (locale) query.set('locale', locale);
  if (conversationId) query.set('conversationId', conversationId);
  const path =
    `/v2/subscription/pricing-plans/${pricingPlanReferenceCode}` +
    (query.toString() ? `?${query.toString()}` : '');

  return await iyzicoRequest(path, {}, 'GET');
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
}: any) {
  const body: any = {
    locale,
    conversationId: conversationId || `sub_checkout_${Date.now()}`,
    pricingPlanReferenceCode,
    subscriptionInitialStatus,
    customer,
    callbackUrl,
  };

  return await iyzicoRequest('/v2/subscription/checkoutform/initialize', body);
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
}: any) {
  if (!callbackUrl) throw new Error('callbackUrl gerekli');
  if (!customerReferenceCode && !subscriptionReferenceCode) {
    throw new Error('customerReferenceCode veya subscriptionReferenceCode gerekli');
  }

  const body: any = {
    locale,
    conversationId: conversationId || `sub_card_update_${Date.now()}`,
    callbackUrl,
  };

  if (customerReferenceCode) body.customerReferenceCode = customerReferenceCode;
  if (subscriptionReferenceCode) body.subscriptionReferenceCode = subscriptionReferenceCode;

  return await iyzicoRequest('/v2/subscription/card-update/checkoutform/initialize', body);
}

/**
 * Subscription API: checkout sonucu al (GET)
 * GET /v2/subscription/checkoutform/{token}
 * Not: imza path'i token dahil tam yol ile hesaplaniyor, body bos.
 */
export async function retrieveSubscriptionCheckoutForm(token: string, conversationId?: string) {
  const queryParams = new URLSearchParams({ locale: 'tr' });
  if (conversationId) queryParams.set('conversationId', conversationId);
  const path = `/v2/subscription/checkoutform/${token}?${queryParams.toString()}`;

  // GET icin body bos, imza: randomString + path_without_query + ''
  return await iyzicoRequest(path, {}, 'GET');
}

/**
 * Subscription API: aboneligi iptal et
 */
export async function cancelIyzicoSubscription({ subscriptionReferenceCode, reason, locale = 'tr', conversationId }: any) {
  const body: any = {
    locale,
    conversationId: conversationId || `sub_cancel_${Date.now()}`,
  };

  if (reason) body.cancellationReason = reason;

  return await iyzicoRequest(`/v2/subscription/subscriptions/${subscriptionReferenceCode}/cancel`, body);
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
}: any) {
  const body = {
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

  return await iyzicoRequest('/payment/auth', body);
}

/**
 * Kayitli kartlari listele
 */
export async function retrieveCards(cardUserKey: string) {
  const body = { locale: 'tr', cardUserKey };
  return await iyzicoRequest('/cardstorage/cards', body);
}

/**
 * Odeme iadesi yap (refund)
 */
export async function refundPayment({ paymentTransactionId, price, currency = 'TRY', conversationId }: any) {
  const body = {
    locale: 'tr',
    conversationId: conversationId || `refund_${Date.now()}`,
    paymentTransactionId,
    price: price.toString(),
    currency,
  };

  return await iyzicoRequest('/payment/refund', body);
}
