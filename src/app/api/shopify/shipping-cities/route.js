import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_CITIES = [
  'Istanbul',
  'Izmir',
  'Ankara',
  'Balikesir',
  'Bartin',
  'Bilecik',
  'Bolu',
  'Bursa',
  'Canakkale',
  'Cankiri',
  'Edirne',
  'Eskisehir',
  'Karabuk',
  'Kastamonu',
  'Kirikkale',
  'Kirklareli',
  'Kocaeli',
  'Kutahya',
  'Manisa',
  'Sakarya',
  'Tekirdag',
  'Usak',
  'Yalova',
  'Zonguldak',
];

/**
 * GET /api/shopify/shipping-cities
 * Checkout'ta izin verilen sabit sehir listesi.
 */
export async function GET() {
  return NextResponse.json({
    cities: ALLOWED_CITIES,
    source: 'fixed-whitelist',
  });
}
