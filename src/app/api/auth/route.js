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
  const scopes = 'write_orders,read_orders,read_products,write_customers,read_customers,read_script_tags,write_script_tags';
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  // Shopify iframe icinde calisiyor - JavaScript ile top window redirect
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Redirecting...</title>
</head>
<body>
<script>
  var url = "${authUrl}";
  if (window.top === window.self) {
    window.location.href = url;
  } else {
    window.top.location.href = url;
  }
</script>
<noscript><a href="${authUrl}">Click here</a></noscript>
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
