import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/subscription/renew
 * Legacy endpoint: renewals are now handled by iyzico Subscription API + webhook.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    migrated: true,
    message: 'Renewal cron is disabled. iyzico Subscription API handles renewals via webhooks.',
    timestamp: new Date().toISOString(),
  });
}
