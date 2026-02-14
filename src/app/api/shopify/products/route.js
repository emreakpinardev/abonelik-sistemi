import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';

        if (!shopDomain || !accessToken) {
            return NextResponse.json({ error: 'Shopify credentials not configured' }, { status: 500 });
        }

        // Shopify REST API - Products
        // Eger arama varsa title filter kullan, yoksa ilk 50 urunu getir
        let url = `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=50&status=active`;
        if (search) {
            url += `&title=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Shopify API Error:', errorText);
            return NextResponse.json({ error: 'Failed to fetch products from Shopify' }, { status: response.status });
        }

        const data = await response.json();

        // Basitlesitirilmis veri donelilm
        const products = data.products.map(p => ({
            id: p.id,
            title: p.title,
            image: p.image?.src || null,
            variants: p.variants.map(v => ({ id: v.id, title: v.title, price: v.price }))
        }));

        return NextResponse.json({ products });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
