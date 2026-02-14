import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shopify/shipping-cities
 * Shopify shipping zones'dan kargo gonderilen sehirleri ceker
 * Sadece Turkiye'deki tanimli province'lari dondurur
 */
export async function GET() {
    try {
        const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
        const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

        if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
            return NextResponse.json({ error: 'Shopify ayarlari eksik' }, { status: 500 });
        }

        const res = await fetch(
            `https://${SHOPIFY_DOMAIN}/admin/api/2024-10/shipping_zones.json`,
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!res.ok) {
            // API hata verirse fallback: tum illeri dondur
            return NextResponse.json({ cities: getDefaultCities(), source: 'fallback' });
        }

        const data = await res.json();
        const zones = data.shipping_zones || [];

        // Turkiye'deki province'lari topla
        const citySet = new Set();

        for (const zone of zones) {
            const countries = zone.countries || [];
            for (const country of countries) {
                if (country.code === 'TR' || country.name === 'Turkey' || country.name === 'Türkiye') {
                    const provinces = country.provinces || [];
                    if (provinces.length === 0) {
                        // Province belirtilmemis = tum Turkiye'ye gonderiliyor
                        return NextResponse.json({ cities: getDefaultCities(), source: 'all-turkey' });
                    }
                    for (const prov of provinces) {
                        citySet.add(prov.name);
                    }
                }
            }
        }

        // Hic sehir bulunamazsa fallback
        if (citySet.size === 0) {
            return NextResponse.json({ cities: getDefaultCities(), source: 'fallback-empty' });
        }

        // Alfabetik sirala
        const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b, 'tr'));

        return NextResponse.json({ cities, source: 'shopify' });
    } catch (error) {
        console.error('Shipping cities error:', error);
        return NextResponse.json({ cities: getDefaultCities(), source: 'error-fallback' });
    }
}

function getDefaultCities() {
    return [
        'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
        'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
        'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
        'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
        'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir',
        'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
        'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop',
        'Şırnak', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
    ];
}
