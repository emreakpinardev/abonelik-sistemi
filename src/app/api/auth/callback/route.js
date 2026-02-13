import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

        if (!code || !shop) {
            return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
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
            console.error('Token veritabanına kaydedilemedi (sorun değil, .env kullanılabilir):', dbError.message);
        }

        // Admin panele yönlendir
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>Kurulum Başarılı</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0f; color: #f0f0f5;">
          <div style="text-align: center; max-width: 500px; padding: 48px;">
            <h1 style="font-size: 48px; margin-bottom: 16px;">✅</h1>
            <h2 style="margin-bottom: 8px;">Kurulum Başarılı!</h2>
            <p style="color: #9494a8; margin-bottom: 8px;">Mağaza: ${shop}</p>
            <p style="color: #6c5ce7; font-weight: bold; margin-bottom: 24px;">Access Token alındı ve kaydedildi.</p>
            <p style="background: #1a1a2e; padding: 16px; border-radius: 8px; font-size: 13px; word-break: break-all; border: 1px solid #2d2d44; margin-bottom: 24px;">
              <strong>Token:</strong><br/>${accessToken}
            </p>
            <p style="color: #ff6b6b; font-size: 13px;">⚠️ Bu tokeni güvenli bir yere kopyalayın ve .env dosyanıza ekleyin!</p>
          </div>
        </body>
      </html>
    `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error) {
        console.error('OAuth callback error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
