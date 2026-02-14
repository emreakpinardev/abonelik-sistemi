import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';

        if (!shopDomain || !accessToken) {
            return NextResponse.json({ error: 'Shopify credentials missing' }, { status: 500 });
        }

        const url = `https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`;
        const response = await fetch(url, {
            headers: { 'X-Shopify-Access-Token': accessToken }
        });

        const data = await response.json();

        // Check if our script is installed
        // We look for src ending with '/api/script'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
        const scriptUrl = `${appUrl}/api/script`;

        const installedScript = data.script_tags.find(s => s.src === scriptUrl);

        return NextResponse.json({
            installed: !!installedScript,
            scriptTag: installedScript || null,
            allScripts: data.script_tags
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
        const scriptUrl = `${appUrl}/api/script`;

        if (!shopDomain || !accessToken) {
            return NextResponse.json({ error: 'Shopify credentials missing' }, { status: 500 });
        }

        // First check if already installed to avoid duplicates
        const checkRes = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`, {
            headers: { 'X-Shopify-Access-Token': accessToken }
        });
        const checkData = await checkRes.json();
        const existing = checkData.script_tags.find(s => s.src === scriptUrl);

        if (existing) {
            return NextResponse.json({ success: true, message: 'Already installed', scriptTag: existing });
        }

        // Install
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

        if (!response.ok) {
            const errText = await response.text();
            throw new Error('Shopify API Error: ' + errText);
        }

        const data = await response.json();
        return NextResponse.json({ success: true, scriptTag: data.script_tag });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';

        if (!shopDomain || !accessToken) {
            return NextResponse.json({ error: 'Shopify credentials missing' }, { status: 500 });
        }

        if (!id) {
            // If ID not provided, find and delete ours
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
            const scriptUrl = `${appUrl}/api/script`;

            const checkRes = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/script_tags.json`, {
                headers: { 'X-Shopify-Access-Token': accessToken }
            });
            const checkData = await checkRes.json();
            const existing = checkData.script_tags.find(s => s.src === scriptUrl);

            if (!existing) {
                return NextResponse.json({ success: true, message: 'Script not found to delete' });
            }

            // Recursively call validation or just proceed
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
        throw new Error('Failed to delete script tag');
    }

    return NextResponse.json({ success: true });
}
