import { NextResponse } from 'next/server';
import crypto from 'crypto';

function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop || '');
}

/**
 * GET /api/auth
 * Shopify OAuth - iframe compatible redirect
 */
export async function GET(request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');

  if (!shop) {
    return NextResponse.json({ error: 'Shop parameter required' }, { status: 400 });
  }
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'SHOPIFY_CLIENT_ID missing' }, { status: 500 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
  const redirectUri = encodeURIComponent(`${appUrl}/api/auth/callback`);
  const scopes = 'write_orders,read_orders,read_products,write_products,write_customers,read_customers,read_script_tags,write_script_tags';
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  // Otomatik redirect yerine kullanici tiklamasi ile top window redirect.
  // Bu, bazi tarayicilarda/iframe akisinda ERR_BLOCKED_BY_RESPONSE sorununu azaltir.
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shopify Authorization</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; }
  .card { max-width: 520px; margin: 40px auto; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; }
  .btn { background: #111; color: #fff; border: 0; border-radius: 8px; padding: 12px 16px; cursor: pointer; font-weight: 600; }
  .muted { color: #555; font-size: 14px; line-height: 1.45; }
  a { color: #111; }
</style>
</head>
<body>
<div class="card">
  <h2>Shopify izin onayi gerekiyor</h2>
  <p class="muted">Tarayici guvenlik kisitlari nedeniyle otomatik yonlendirme kapatildi. Devam etmek icin butona tiklayin.</p>
  <p><button class="btn" id="go">Shopify iznine git</button></p>
  <p class="muted">Acilmazsa su linki kullanin:
    <a href="${authUrl}" target="_top" rel="noopener">Izin ekranini ac</a>
  </p>
</div>
<script>
  var url = "${authUrl}";
  document.getElementById('go').addEventListener('click', function () {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  });
</script>
<noscript><a href="${authUrl}" target="_top" rel="noopener">Click here</a></noscript>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
    },
  });
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 300,
  });
  return response;
}
