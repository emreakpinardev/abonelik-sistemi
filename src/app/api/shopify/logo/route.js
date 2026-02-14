import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Shopify mağaza logosunu getirir
 * GET /api/shopify/logo
 * Doğrudan resim olarak döner (img src olarak kullanılabilir)
 */
export async function GET() {
    try {
        const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
        const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
        const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

        if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
            return new NextResponse(null, { status: 404 });
        }

        // Aktif temayı bul
        const themesRes = await fetch(
            `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/themes.json`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!themesRes.ok) {
            return new NextResponse(null, { status: 404 });
        }

        const themesData = await themesRes.json();
        const activeTheme = themesData.themes?.find(t => t.role === 'main');

        if (!activeTheme) {
            return new NextResponse(null, { status: 404 });
        }

        // Temanın settings_data.json dosyasını oku
        const settingsRes = await fetch(
            `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!settingsRes.ok) {
            return new NextResponse(null, { status: 404 });
        }

        const settingsData = await settingsRes.json();
        const settingsJson = JSON.parse(settingsData.asset?.value || '{}');

        // Logo URL'sini farklı tema yapılarından bul
        let logoUrl = null;

        // Dawn / modern temalar
        const current = settingsJson.current || {};
        const sections = current.sections || {};

        // Header section'ında logo
        for (const [key, section] of Object.entries(sections)) {
            if (section.type === 'header' && section.settings?.logo) {
                logoUrl = section.settings.logo;
                break;
            }
        }

        // Eski format: current.settings
        if (!logoUrl && current.settings?.logo) {
            logoUrl = current.settings.logo;
        }

        // Daha eski format: kök settings
        if (!logoUrl && settingsJson.settings?.logo) {
            logoUrl = settingsJson.settings.logo;
        }

        if (!logoUrl) {
            // Shopify files API ile logo dosyasını ara
            const filesRes = await fetch(
                `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/files.json?filename=logo`,
                {
                    headers: {
                        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (filesRes.ok) {
                const filesData = await filesRes.json();
                const logoFile = filesData.files?.find(f =>
                    f.filename?.toLowerCase().includes('logo')
                );
                if (logoFile?.url) {
                    logoUrl = logoFile.url;
                }
            }
        }

        if (!logoUrl) {
            return new NextResponse(null, { status: 404 });
        }

        // Logo Shopify CDN URL ise doğrudan redirect et
        if (logoUrl.startsWith('//')) {
            logoUrl = 'https:' + logoUrl;
        }

        // Logo URL'sine redirect
        return NextResponse.redirect(logoUrl, { status: 302 });
    } catch (err) {
        console.error('Logo hatasi:', err);
        return new NextResponse(null, { status: 404 });
    }
}
