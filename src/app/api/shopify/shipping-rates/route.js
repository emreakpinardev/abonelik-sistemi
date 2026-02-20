import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Shopify Admin API ile shipping zones/rates bilgisi alir.
 * variant_ids verilirse ilgili urunlerin delivery profile'ina gore filtre uygular.
 * GET /api/shopify/shipping-rates?city=Istanbul&variant_ids=123,456
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || 'Istanbul';
    const variantIdsParam = searchParams.get('variant_ids') || '';
    const variantIds = variantIdsParam
      .split(',')
      .map((v) => v.trim())
      .filter((v) => /^\d+$/.test(v));

    const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
    const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

    if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
      return NextResponse.json({ rates: getDefaultRates() });
    }

    // Zone/profile based approximation
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

    const allowedProfiles = await getAllowedProfilesForVariants({
      shopDomain: SHOPIFY_DOMAIN,
      accessToken: SHOPIFY_TOKEN,
      apiVersion: API_VERSION,
      variantIds,
    });
    const allowedProfileIds = allowedProfiles.ids;
    const allowedProfileNames = allowedProfiles.names;
    const shouldFilterByProfile = allowedProfileIds.size > 0 || allowedProfileNames.size > 0;
    console.log(
      '[Shipping] city:',
      city,
      '| zones:',
      zones.length,
      '| profile filter:',
      shouldFilterByProfile
        ? `ids=[${Array.from(allowedProfileIds).join(',')}] names=[${Array.from(allowedProfileNames).join(',')}]`
        : 'none'
    );

    const rates = [];
    for (const zone of zones) {
      const zoneProfileId = getZoneProfileId(zone);
      if (shouldFilterByProfile) {
        let keep = true;
        if (allowedProfileIds.size > 0 && zoneProfileId) {
          keep = allowedProfileIds.has(zoneProfileId);
        } else if (allowedProfileNames.size > 0) {
          const zoneName = String(zone.name || '').toLowerCase();
          keep = Array.from(allowedProfileNames).some((n) => zoneName.includes(n.toLowerCase()));
        }
        if (!keep) continue;
      }

      const isTurkey = zone.countries?.some(
        (c) =>
          c.code === 'TR' ||
          c.name?.toLowerCase().includes('turkey') ||
          c.name?.toLowerCase().includes('turkiye')
      );

      const isRestOfWorld =
        zone.name?.toLowerCase().includes('rest of world') ||
        zone.name?.toLowerCase().includes('domestic');

      if (isTurkey || isRestOfWorld || zones.length === 1) {
        rates.push(...collectRatesFromZone(zone));
      }
    }

    if (rates.length === 0 && shouldFilterByProfile) {
      const fallbackRates = buildRatesFromZones(zones);
      if (fallbackRates.length > 0) {
        console.log('[Shipping] profile filtresiyle rate yok, filtresiz fallback donuyor');
        return NextResponse.json({ rates: fallbackRates });
      }
    }

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

function collectRatesFromZone(zone) {
  const rates = [];

  const priceRates = zone.price_based_shipping_rates || [];
  for (const rate of priceRates) {
    const lower = String(rate.name || '').toLowerCase();
    rates.push({
      id: `price_${rate.id}`,
      name: rate.name,
      price: rate.price || '0.00',
      delivery_days: lower.includes('hizli') || lower.includes('express')
        ? '1-3 Is Gunu'
        : lower.includes('ucretsiz') || lower.includes('free')
          ? '7-10 Is Gunu'
          : '3-5 Is Gunu',
    });
  }

  const weightRates = zone.weight_based_shipping_rates || [];
  for (const rate of weightRates) {
    rates.push({
      id: `weight_${rate.id}`,
      name: rate.name,
      price: rate.price || '0.00',
      delivery_days: '3-7 Is Gunu',
    });
  }

  const carrierRates = zone.carrier_shipping_rate_providers || [];
  for (const carrier of carrierRates) {
    rates.push({
      id: `carrier_${carrier.id}`,
      name: carrier.carrier_service?.name || 'Kargo',
      price: '0.00',
      delivery_days: '3-5 Is Gunu',
    });
  }

  return rates;
}

function getZoneProfileId(zone) {
  if (!zone || typeof zone !== 'object') return null;
  const direct =
    zone.profile_id ||
    zone.shipping_profile_id ||
    zone.profileId ||
    zone.profile?.id ||
    zone.shipping_profile?.id ||
    null;
  if (direct == null) return null;
  const gidMatch = String(direct).match(/\/(\d+)$/);
  if (gidMatch) return gidMatch[1];
  const n = parseInt(String(direct), 10);
  return Number.isFinite(n) ? String(n) : String(direct);
}

async function getAllowedProfilesForVariants({ shopDomain, accessToken, apiVersion, variantIds }) {
  const ids = new Set();
  const names = new Set();
  if (!variantIds || variantIds.length === 0) return { ids, names };

  try {
    const gqlUrl = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
    const ids = variantIds.map((id) => `gid://shopify/ProductVariant/${id}`);
    const run = async (query) => {
      const res = await fetch(gqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { ids } }),
      });
      if (!res.ok) return null;
      return res.json();
    };

    // Attempt 1: deliveryProfile directly on ProductVariant
    let json = await run(`
      query VariantProfilesV1($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            deliveryProfile {
              id
              name
            }
          }
        }
      }
    `);
    if (json?.errors?.length) {
      console.warn('[Shipping] VariantProfilesV1 errors:', JSON.stringify(json.errors));
    }
    let nodes = json?.data?.nodes || [];
    for (const node of nodes) {
      const profileGid = node?.deliveryProfile?.id || '';
      const profileName = node?.deliveryProfile?.name || '';
      if (profileName) names.add(String(profileName));
      const m = String(profileGid).match(/\/(\d+)$/);
      if (m) ids.add(m[1]);
    }

    // Attempt 2: deliveryProfile via Product
    if (ids.size === 0 && names.size === 0) {
      json = await run(`
        query VariantProfilesV2($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              product {
                id
                deliveryProfile {
                  id
                  name
                }
              }
            }
          }
        }
      `);
      if (json?.errors?.length) {
        console.warn('[Shipping] VariantProfilesV2 errors:', JSON.stringify(json.errors));
      }
      nodes = json?.data?.nodes || [];
      for (const node of nodes) {
        const profileGid = node?.product?.deliveryProfile?.id || '';
        const profileName = node?.product?.deliveryProfile?.name || '';
        if (profileName) names.add(String(profileName));
        const m = String(profileGid).match(/\/(\d+)$/);
        if (m) ids.add(m[1]);
      }
    }
  } catch (err) {
    console.error('[Shipping] Variant profile lookup hatasi:', err);
  }

  return { ids, names };
}

function buildRatesFromZones(zones) {
  const rates = [];
  for (const zone of zones || []) {
    const isTurkey = zone.countries?.some(
      (c) =>
        c.code === 'TR' ||
        c.name?.toLowerCase().includes('turkey') ||
        c.name?.toLowerCase().includes('turkiye')
    );
    const isRestOfWorld =
      zone.name?.toLowerCase().includes('rest of world') ||
      zone.name?.toLowerCase().includes('domestic');

    if (!(isTurkey || isRestOfWorld || (zones || []).length === 1)) continue;
    rates.push(...collectRatesFromZone(zone));
  }
  return rates;
}

function getDefaultRates() {
  return [
    {
      id: 'free',
      name: 'Ucretsiz Kargo',
      price: '0.00',
      delivery_days: '7-10 Is Gunu',
    },
    {
      id: 'express',
      name: 'Hizli Kargo',
      price: '49.90',
      delivery_days: '1-3 Is Gunu',
    },
  ];
}
