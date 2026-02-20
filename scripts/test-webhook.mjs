import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    event: 'success',
    subscriptionId: '',
    subscriptionRef: '',
    email: '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--event' && argv[i + 1]) args.event = String(argv[++i]).toLowerCase();
    else if (token === '--subscription-id' && argv[i + 1]) args.subscriptionId = String(argv[++i]);
    else if (token === '--subscription-ref' && argv[i + 1]) args.subscriptionRef = String(argv[++i]);
    else if (token === '--email' && argv[i + 1]) args.email = String(argv[++i]);
    else if (token === '--url' && argv[i + 1]) args.baseUrl = String(argv[++i]);
    else if (token === 'success' || token === 'failure' || token === 'cancel') args.event = token;
  }

  return args;
}

function resolveEventType(event) {
  if (event === 'failure') return 'SUBSCRIPTION_ORDER_FAILURE';
  if (event === 'cancel') return 'SUBSCRIPTION_CANCEL';
  return 'SUBSCRIPTION_ORDER_SUCCESS';
}

async function findSubscription({ subscriptionId, subscriptionRef, email }) {
  if (subscriptionId) {
    return prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
  }

  if (subscriptionRef) {
    return prisma.subscription.findFirst({
      where: { iyzicoSubscriptionRef: subscriptionRef },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (email) {
    return prisma.subscription.findFirst({
      where: { customerEmail: email },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  return prisma.subscription.findFirst({
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

function buildPayload(eventType, subscription) {
  const now = Date.now();
  const paymentRef = `manual-test-${now}`;

  return {
    iyziEventType: eventType,
    data: {
      subscriptionReferenceCode: subscription.iyzicoSubscriptionRef || undefined,
      // Webhook route can infer subscription by UUID in conversationId fallback.
      conversationId: `manual-test-${subscription.id}`,
      paymentReferenceCode: paymentRef,
      paymentTransactionId: `${paymentRef}-tx`,
      paidPrice: String(subscription.plan?.price ?? 0),
      price: String(subscription.plan?.price ?? 0),
      currencyCode: subscription.plan?.currency || 'TRY',
      errorMessage: eventType === 'SUBSCRIPTION_ORDER_FAILURE' ? 'Manual failure test' : undefined,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const eventType = resolveEventType(args.event);

  const subscription = await findSubscription(args);
  if (!subscription) {
    console.error('No subscription found. Pass --subscription-id / --subscription-ref / --email.');
    process.exitCode = 1;
    return;
  }

  const payload = buildPayload(eventType, subscription);
  const endpoint = `${args.baseUrl.replace(/\/$/, '')}/api/iyzico/webhook`;

  console.log('Posting webhook test');
  console.log(JSON.stringify({
    endpoint,
    eventType,
    subscriptionId: subscription.id,
    subscriptionRef: subscription.iyzicoSubscriptionRef || null,
    email: subscription.customerEmail,
  }, null, 2));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  console.log('Webhook response');
  console.log(JSON.stringify({ status: response.status, body: json }, null, 2));

  if (!response.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
