import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cancelIyzicoSubscription } from '@/lib/iyzico';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscription/cancel
 * Aboneligi iptal eder (iyzico + local)
 */
export async function POST(request) {
  try {
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Abonelik ID gerekli' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Abonelik bulunamadi' }, { status: 404 });
    }

    if (subscription.iyzicoSubscriptionRef) {
      const cancelResult = await cancelIyzicoSubscription({
        subscriptionReferenceCode: subscription.iyzicoSubscriptionRef,
        reason: 'USER_CANCELLED',
        conversationId: `cancel_${subscriptionId}`,
      });

      const normalizedCancelError = String(cancelResult?.errorMessage || '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const alreadyCancelled =
        normalizedCancelError.includes('already') && normalizedCancelError.includes('cancel');

      if (cancelResult.status !== 'success' && !alreadyCancelled) {
        return NextResponse.json(
          {
            error: 'iyzico abonelik iptal edilemedi',
            details: cancelResult.errorMessage,
            errorCode: cancelResult.errorCode,
          },
          { status: 400 }
        );
      }
    }

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Abonelik iptal edildi',
    });
  } catch (error) {
    console.error('Cancel error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
