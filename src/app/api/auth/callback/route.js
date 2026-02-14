import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/callback
 * Shopify OAuth callback
 * Shopify onay verdikten sonra buraya yönlendirilir
 * Code'u access token'a çevirir ve veritabanına kaydeder
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');
    const hmac = url.searchParams.get('hmac');
    const state = url.searchParams.get('state');
    const cookieState = request.cookies.get('shopify_oauth_state')?.value;

    if (!code || !shop) {
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
    }
    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.json({ error: 'State dogrulamasi basarisiz' }, { status: 400 });
    }

    const params = new URLSearchParams(url.search);
    params.delete('hmac');
    params.delete('signature');
    const message = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
      .update(message)
      .digest('hex');
    const isValidHmac =
      hmac &&
      generatedHmac.length === hmac.length &&
      crypto.timingSafeEqual(Buffer.from(generatedHmac), Buffer.from(hmac));
    if (!isValidHmac) {
      return NextResponse.json({ error: 'HMAC dogrulamasi basarisiz' }, { status: 400 });
    }

    // Code'u access token'a çevir
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return NextResponse.json({ error: 'Token alınamadı' }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('===========================================');
    console.log('SHOPIFY ACCESS TOKEN ALINDI!');
    console.log('Shop:', shop);
    console.log('Token:', accessToken);
    console.log('===========================================');
    console.log('Bu tokeni .env dosyanıza ekleyin:');
    console.log(`SHOPIFY_ACCESS_TOKEN="${accessToken}"`);
    console.log(`SHOPIFY_STORE_DOMAIN="${shop}"`);
    console.log('===========================================');

    // Token'ı veritabanına kaydet (opsiyonel, .env'ye de eklenebilir)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ShopifyStore" (
          "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          "shop" TEXT UNIQUE NOT NULL,
          "accessToken" TEXT NOT NULL,
          "scopes" TEXT,
          "installedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        INSERT INTO "ShopifyStore" ("shop", "accessToken", "scopes")
        VALUES ($1, $2, $3)
        ON CONFLICT ("shop") 
        DO UPDATE SET "accessToken" = $2, "scopes" = $3
      `, shop, accessToken, tokenData.scope || '');
    } catch (dbError) {
      console.error('Token veritabanına kaydedilemedi:', dbError.message);
    }

    // ============================================================
    // OTOMATIK SCRIPT YUKLEME (buttons.js)
    // ============================================================
    let scriptStatus = 'Script yüklenemedi';
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
      const scriptUrl = `${appUrl}/api/script/buttons.js`;

      // 1. Mevcut scriptleri kontrol et ve temizle
      const listRes = await fetch(`https://${shop}/admin/api/2024-01/script_tags.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });

      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.script_tags) {
          for (const tag of listData.script_tags) {
            if (tag.src.includes('/api/script/buttons.js')) {
              await fetch(`https://${shop}/admin/api/2024-01/script_tags/${tag.id}.json`, {
                method: 'DELETE',
                headers: { 'X-Shopify-Access-Token': accessToken }
              });
            }
          }
        }
      }

      // 2. Yeni scripti ekle
      const installRes = await fetch(`https://${shop}/admin/api/2024-01/script_tags.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          script_tag: {
            event: 'onload',
            src: scriptUrl,
            display_scope: 'online_store'
          }
        })
      });

      if (installRes.ok) {
        scriptStatus = '✅ Script mağazaya başarıyla eklendi!';
        console.log('Script installed successfully');
      } else {
        const err = await installRes.json();
        scriptStatus = '❌ Script eklenirken hata: ' + JSON.stringify(err);
        console.error('Script install error:', err);
      }
    } catch (scriptErr) {
      scriptStatus = '❌ Script hatası: ' + scriptErr.message;
      console.error('Script installation exception:', scriptErr);
    }

    // Kurulum tamamlandi, dogrudan uygulama URL'ine don.
    // Admin app path'e tekrar zorlama bazi magazalarda redirect loop uretiyor.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
    const appEntryUrl = `${appUrl}/?shop=${encodeURIComponent(shop)}&tab=settings&oauth=success`;

    const response = NextResponse.redirect(appEntryUrl);
    response.cookies.set('shopify_oauth_state', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0,
    });
    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(`
        <html><body><h1>Hata Olustu</h1><p>${error.message}</p></body></html>
    `, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}
