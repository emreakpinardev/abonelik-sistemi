import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getShopifyCredentials() {
    let shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';

    if (!shopDomain || !accessToken) {
        throw new Error('Shopify credentials missing');
    }

    // Sanitize domain
    shopDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!shopDomain.includes('.myshopify.com') && !shopDomain.includes('.')) {
        shopDomain += '.myshopify.com';
    }

    return { shopDomain, accessToken, apiVersion };
}

export async function GET(request) {
    try {
        const { shopDomain, accessToken, apiVersion } = getShopifyCredentials();

        const url = `https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`;
        const response = await fetch(url, {
            headers: { 'X-Shopify-Access-Token': accessToken }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Shopify API Error (GET):', data);
            return NextResponse.json({
                error: 'Failed to fetch script tags',
                details: data.errors
            }, { status: response.status });
        }

        if (!data.script_tags) {
            console.error('Unexpected API Response:', data);
            return NextResponse.json({ error: 'Invalid API response from Shopify' }, { status: 502 });
        }

        // Check if our script is installed
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
        const scriptUrl = `${appUrl}/api/script`;

        const installedScript = data.script_tags.find(s => s.src === scriptUrl);

        return NextResponse.json({
            installed: !!installedScript,
            scriptTag: installedScript || null,
            allScripts: data.script_tags // For debugging
        });

    } catch (error) {
        console.error('API Handler Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { shopDomain, accessToken, apiVersion } = getShopifyCredentials();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
        const scriptUrl = `${appUrl}/api/script`;

        // 1. Check existing
        const checkUrl = `https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`;
        const checkRes = await fetch(checkUrl, {
            headers: { 'X-Shopify-Access-Token': accessToken }
        });

        const checkData = await checkRes.json();

        if (checkRes.ok && checkData.script_tags) {
            const existing = checkData.script_tags.find(s => s.src === scriptUrl);
            if (existing) {
                return NextResponse.json({ success: true, message: 'Already installed', scriptTag: existing });
            }
        } else {
            console.error('Shopify API Check Error:', checkData);
            // Proceed to try install anyway? No, if we can't check, we probably can't install.
            // But maybe valid error?
        }

        // 2. Install
        const url = `https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`;
        const body = {
            script_tag: {
                event: "onload",
                src: scriptUrl
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Shopify Install Error:', data);
            return NextResponse.json({ error: 'Installation failed', details: data.errors }, { status: response.status });
        }

        return NextResponse.json({ success: true, scriptTag: data.script_tag });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const { shopDomain, accessToken, apiVersion } = getShopifyCredentials();

        if (!id) {
            // Find ourselves
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
            const scriptUrl = `${appUrl}/api/script`;

            const checkRes = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`, {
                headers: { 'X-Shopify-Access-Token': accessToken }
            });
            const checkData = await checkRes.json();

            if (!checkRes.ok || !checkData.script_tags) {
                return NextResponse.json({ error: 'Failed to fetch scripts to delete' }, { status: 500 });
            }

            const existing = checkData.script_tags.find(s => s.src === scriptUrl);
            if (!existing) {
                return NextResponse.json({ success: true, message: 'Script not found' });
            }

            return deleteScript(existing.id, shopDomain, accessToken, apiVersion);
        }

        return deleteScript(id, shopDomain, accessToken, apiVersion);

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function deleteScript(id, shopDomain, accessToken, apiVersion) {
    const url = `https://${shopDomain}/admin/api/${apiVersion}/script_tags/${id}.json`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': accessToken }
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error('Failed to delete: ' + JSON.stringify(data.errors));
    }

    return NextResponse.json({ success: true });
}
