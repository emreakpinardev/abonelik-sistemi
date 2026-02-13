import { NextResponse } from 'next/server';

/**
 * GET /api/auth
 * Shopify OAuth başlatma
 * Shopify admin iframe içinde çalıştığı için JavaScript ile yönlendirme yapıyoruz
 */
export async function GET(request) {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');

    if (!shop) {
        return NextResponse.json({ error: 'Shop parametresi gerekli' }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
    const redirectUri = `${appUrl}/api/auth/callback`;
    const scopes = 'write_orders,read_orders,read_products,write_customers,read_customers';

    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    // iframe içinde server-side redirect çalışmaz
    // JavaScript ile parent window'u yönlendiriyoruz
    return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Yönlendiriliyor...</title>
        <script>
          // iframe içindeyse parent'ı yönlendir
          if (window.top !== window.self) {
            window.top.location.href = "${authUrl}";
          } else {
            window.location.href = "${authUrl}";
          }
        </script>
      </head>
      <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0f; color: #f0f0f5;">
        <p>Shopify'a yönlendiriliyorsunuz...</p>
      </body>
    </html>
  `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
    });
}
