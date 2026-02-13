import { NextResponse } from 'next/server';

/**
 * GET /api/auth
 * Shopify OAuth başlatma
 * Shopify admin'den uygulama açıldığında buraya yönlendirilir
 */
export async function GET(request) {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');

    if (!shop) {
        return NextResponse.json({ error: 'Shop parametresi gerekli' }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
    const scopes = 'write_orders,read_orders,read_products,write_customers,read_customers';

    // Shopify OAuth onay sayfasına yönlendir
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return NextResponse.redirect(authUrl);
}
