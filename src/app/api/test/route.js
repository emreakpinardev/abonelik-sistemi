import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const results = { prisma: false, iyzipay: false, uuid: false };

    try {
        const prisma = (await import('@/lib/prisma')).default;
        results.prisma = true;

        // Try a simple query
        const count = await prisma.plan.count();
        results.prismaQuery = `OK (${count} plans)`;
    } catch (e) {
        results.prismaError = e.message;
    }

    try {
        const iyzico = await import('@/lib/iyzico');
        results.iyzipay = true;
    } catch (e) {
        results.iyzipayError = e.message;
    }

    try {
        const { v4 } = await import('uuid');
        results.uuid = true;
        results.uuidTest = v4();
    } catch (e) {
        results.uuidError = e.message;
    }

    // Check env vars
    results.envVars = {
        IYZICO_API_KEY: !!process.env.IYZICO_API_KEY,
        IYZICO_SECRET_KEY: !!process.env.IYZICO_SECRET_KEY,
        IYZICO_BASE_URL: !!process.env.IYZICO_BASE_URL,
        DATABASE_URL: !!process.env.DATABASE_URL,
        SHOPIFY_ACCESS_TOKEN: !!process.env.SHOPIFY_ACCESS_TOKEN,
        NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    };

    return NextResponse.json(results, { status: 200 });
}
