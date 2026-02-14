import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/status
 * Tum environment variable ve baglanti durumlarini dondurur
 * Sadece admin sifresi ile giris yapanlar gorebilir
 */
export async function GET() {
    const result = {
        // Shopify
        hasShopifyClientId: !!process.env.SHOPIFY_CLIENT_ID,
        hasShopifyClientSecret: !!process.env.SHOPIFY_CLIENT_SECRET,
        shopDomain: process.env.SHOPIFY_STORE_DOMAIN || null,
        hasShopDomain: !!process.env.SHOPIFY_STORE_DOMAIN,
        hasAccessToken: !!process.env.SHOPIFY_ACCESS_TOKEN,
        tokenLast4: process.env.SHOPIFY_ACCESS_TOKEN ? process.env.SHOPIFY_ACCESS_TOKEN.slice(-4) : null,
        apiConnected: false,

        // iyzico
        hasIyzicoKey: !!process.env.IYZICO_API_KEY,
        hasIyzicoSecret: !!process.env.IYZICO_SECRET_KEY,
        iyzicoEnv: 'UNKNOWN',

        // Genel
        appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
        hasCronSecret: !!process.env.CRON_SECRET,
        hasAdminPassword: !!process.env.ADMIN_PASSWORD,
        dbConnected: false,
    };

    // iyzico ortam kontrolu
    const baseUrl = process.env.IYZICO_BASE_URL || '';
    if (baseUrl.includes('sandbox')) result.iyzicoEnv = 'SANDBOX';
    else if (baseUrl.includes('api.iyzipay.com')) result.iyzicoEnv = 'LIVE';

    // Shopify API baglanti testi
    if (result.hasShopDomain && result.hasAccessToken) {
        try {
            // Scopes
            const scopeRes = await fetch(
                `https://${result.shopDomain}/admin/oauth/access_scopes.json`,
                { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN } }
            );
            if (scopeRes.ok) {
                const scopeData = await scopeRes.json();
                result.scopes = scopeData.access_scopes.map(s => s.handle);
            }

            const res = await fetch(
                `https://${result.shopDomain}/admin/api/2024-10/shop.json`,
                { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN } }
            );
            result.apiConnected = res.ok;
        } catch (e) {
            console.error(e);
        }
    }

    // Veritabani baglanti testi
    try {
        await prisma.$queryRaw`SELECT 1`;
        result.dbConnected = true;
    } catch { }

    return NextResponse.json(result);
}
