import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Shopify Carrier Service API üzerinden kargo yöntemlerini çeker
 * Shopify Admin API ile shipping zones ve rates bilgisi alınır
 * GET /api/shopify/shipping-rates?city=Istanbul
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const city = searchParams.get('city') || 'Istanbul';

        const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
        const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
        const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

        if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
            return NextResponse.json({ rates: getDefaultRates() });
        }

        // Shopify Admin API ile shipping zones bilgisini cek
        const res = await fetch(
            `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/shipping_zones.json`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!res.ok) {
            console.error('Shopify shipping zones hatasi:', res.status);
            return NextResponse.json({ rates: getDefaultRates() });
        }

        const data = await res.json();
        const zones = data.shipping_zones || [];
        console.log('[Shipping] Zones bulundu:', zones.length, 'adet. Isimler:', zones.map(z => z.name).join(', '));

        // Turkiye icin uygun zone'u bul
        const rates = [];
        for (const zone of zones) {
            // Zone'un Turkiye'yi icerip icermedigini kontrol et
            const isTurkey = zone.countries?.some(c =>
                c.code === 'TR' || c.name?.toLowerCase().includes('turkey') || c.name?.toLowerCase().includes('türkiye')
            );

            // "Rest of World" zone'u da kabul et
            const isRestOfWorld = zone.name?.toLowerCase().includes('rest of world') || zone.name?.toLowerCase().includes('domestic');

            if (isTurkey || isRestOfWorld || zones.length === 1) {
                // Bu zone'daki price-based shipping rate'leri al
                const priceRates = zone.price_based_shipping_rates || [];
                for (const rate of priceRates) {
                    rates.push({
                        id: `price_${rate.id}`,
                        name: rate.name,
                        price: rate.price || '0.00',
                        delivery_days: rate.name.toLowerCase().includes('hızlı') || rate.name.toLowerCase().includes('express')
                            ? '1-3 İş Günü'
                            : rate.name.toLowerCase().includes('ücretsiz') || rate.name.toLowerCase().includes('free')
                                ? '7-10 İş Günü'
                                : '3-5 İş Günü',
                    });
                }

                // Weight-based rate'ler
                const weightRates = zone.weight_based_shipping_rates || [];
                for (const rate of weightRates) {
                    rates.push({
                        id: `weight_${rate.id}`,
                        name: rate.name,
                        price: rate.price || '0.00',
                        delivery_days: '3-7 İş Günü',
                    });
                }

                // Carrier-based rate'ler (3PL entegrasyonlari)
                const carrierRates = zone.carrier_shipping_rate_providers || [];
                for (const carrier of carrierRates) {
                    // Carrier service rate'leri gercek zamanli hesaplanir, burada sadece listeriz
                    rates.push({
                        id: `carrier_${carrier.id}`,
                        name: carrier.carrier_service?.name || 'Kargo',
                        price: '0.00',
                        delivery_days: '3-5 İş Günü',
                    });
                }
            }
        }

        console.log('[Shipping] Bulunan rate sayisi:', rates.length, rates.map(r => `${r.name}:${r.price}`).join(', '));

        // Eger hicbir rate bulamazsa varsayilanlari dondur
        if (rates.length === 0) {
            console.log('[Shipping] Rate bulunamadi, varsayilan donuyor');
            return NextResponse.json({ rates: getDefaultRates() });
        }

        return NextResponse.json({ rates });
    } catch (err) {
        console.error('Shipping rates hatasi:', err);
        return NextResponse.json({ rates: getDefaultRates() });
    }
}

function getDefaultRates() {
    return [
        {
            id: 'free',
            name: 'Ücretsiz Kargo',
            price: '0.00',
            delivery_days: '7-10 İş Günü',
        },
        {
            id: 'express',
            name: 'Hızlı Kargo',
            price: '49.90',
            delivery_days: '1-3 İş Günü',
        },
    ];
}
