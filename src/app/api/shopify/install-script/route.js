import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/install-script
 * Shopify magazaya ScriptTag ekler
 * Bu endpoint bir kez calistirilir - scripti magazaya kaydeder
 */
export async function POST(request) {
    try {
        const shop = process.env.SHOPIFY_SHOP_URL;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;

        if (!shop || !accessToken) {
            return NextResponse.json({ error: 'SHOPIFY_SHOP_URL veya SHOPIFY_ACCESS_TOKEN eksik' }, { status: 400 });
        }

        const scriptUrl = `${appUrl}/api/script/buttons.js`;

        // Oncelikle mevcut script'leri kontrol et
        const listRes = await fetch(`https://${shop}/admin/api/2024-01/script_tags.json`, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });
        const listData = await listRes.json();

        // Ayni URL'de script varsa silme
        if (listData.script_tags) {
            for (const tag of listData.script_tags) {
                if (tag.src.includes('/api/script/buttons.js')) {
                    await fetch(`https://${shop}/admin/api/2024-01/script_tags/${tag.id}.json`, {
                        method: 'DELETE',
                        headers: {
                            'X-Shopify-Access-Token': accessToken,
                        },
                    });
                }
            }
        }

        // Yeni ScriptTag olustur
        const res = await fetch(`https://${shop}/admin/api/2024-01/script_tags.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                script_tag: {
                    event: 'onload',
                    src: scriptUrl,
                    display_scope: 'online_store',
                },
            }),
        });

        const data = await res.json();

        if (res.ok) {
            return NextResponse.json({
                success: true,
                message: 'Script mağazaya başarıyla eklendi!',
                scriptTag: data.script_tag,
            });
        } else {
            return NextResponse.json({
                error: 'Script eklenemedi',
                details: data,
            }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({
            error: 'Bir hata oluştu',
            details: error.message,
        }, { status: 500 });
    }
}

/**
 * GET /api/shopify/install-script
 * Mevcut script tag'leri listeler
 */
export async function GET() {
    try {
        const shop = process.env.SHOPIFY_SHOP_URL;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

        if (!shop || !accessToken) {
            return NextResponse.json({ error: 'SHOPIFY_SHOP_URL veya SHOPIFY_ACCESS_TOKEN eksik' }, { status: 400 });
        }

        const res = await fetch(`https://${shop}/admin/api/2024-01/script_tags.json`, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });

        const data = await res.json();
        return NextResponse.json({
            success: true,
            scriptTags: data.script_tags || [],
        });
    } catch (error) {
        return NextResponse.json({
            error: error.message,
        }, { status: 500 });
    }
}
