import { getProduct, shopifyREST } from '@/lib/shopify';

function toPriceString(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Gecersiz plan fiyati');
  }
  return n.toFixed(2);
}

function buildSku({ productId, interval, intervalCount, price }) {
  const cents = Math.round(Number(price) * 100);
  return `SUB-${productId}-${interval}-${intervalCount}-${cents}`;
}

function buildOptionValue({ interval, intervalCount }) {
  const count = Math.max(1, Number(intervalCount) || 1);
  const normalizedInterval = String(interval || 'MONTHLY').toUpperCase();

  if (normalizedInterval === 'WEEKLY') return `Abonelik ${count} haftada bir`;
  if (normalizedInterval === 'DAILY') return `Abonelik ${count} gunde bir`;
  if (normalizedInterval === 'MINUTELY') return `Abonelik ${count} dakikada bir`;
  if (normalizedInterval === 'YEARLY') return `Abonelik ${count} yılda bir`;
  return `Abonelik ${count} ayda bir`;
}

function buildLegacyOptionValue({ interval, intervalCount }) {
  const count = Math.max(1, Number(intervalCount) || 1);
  const normalizedInterval = String(interval || 'MONTHLY').toUpperCase();
  if (normalizedInterval === 'WEEKLY') return `${count} haftada bir`;
  if (normalizedInterval === 'DAILY') return `${count} gunde bir`;
  if (normalizedInterval === 'MINUTELY') return `${count} dakikada bir`;
  if (normalizedInterval === 'YEARLY') return `${count} yılda bir`;
  return `${count} ayda bir`;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function findMatchingVariant(variants, { sku, optionValues }) {
  const normalizedSku = normalizeText(sku);
  const normalizedOptionValues = (optionValues || [])
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const bySku = variants.find((v) => normalizeText(v.sku) === normalizedSku);
  if (bySku) return bySku;

  const byOption1 = variants.find((v) => normalizedOptionValues.includes(normalizeText(v.option1)));
  if (byOption1) return byOption1;

  // Some stores use multi-option titles like "Subscription 2 weekly / Default"
  return variants.find((v) => normalizedOptionValues.some((option) => normalizeText(v.title).startsWith(option)));
}

async function getAllProductVariants(productId) {
  try {
    const data = await shopifyREST(`/products/${productId}/variants.json?limit=250`);
    return Array.isArray(data?.variants) ? data.variants : [];
  } catch (_) {
    return [];
  }
}

export async function ensurePlanVariant({
  productId,
  price,
  interval = 'MONTHLY',
  intervalCount = 1,
  existingVariantId = null,
}) {
  if (!productId) return null;

  const normalizedPrice = toPriceString(price);
  const sku = buildSku({ productId, interval, intervalCount, price: normalizedPrice });
  const optionValue = buildOptionValue({ interval, intervalCount });
  const legacyOptionValue = buildLegacyOptionValue({ interval, intervalCount });
  const optionValues = [optionValue, legacyOptionValue];

  if (existingVariantId) {
    try {
      await shopifyREST(`/variants/${existingVariantId}.json`, 'PUT', {
        variant: {
          id: Number(existingVariantId),
          price: normalizedPrice,
          sku,
          inventory_policy: 'continue',
          option1: optionValue,
        },
      });
      return String(existingVariantId);
    } catch (_) {
      // If provided variantId is invalid/outdated, fallback to auto-discovery/create.
    }
  }

  const product = await getProduct(productId);
  if (!product) {
    throw new Error(`Shopify urun bulunamadi: ${productId}`);
  }

  const variants = product.variants || [];
  const extraVariants = await getAllProductVariants(productId);
  const allVariants = [...variants, ...extraVariants];
  const matched = findMatchingVariant(allVariants, { sku, optionValues });
  if (matched) {
    if (
      String(matched.price) !== normalizedPrice ||
      String(matched.sku || '') !== sku ||
      String(matched.option1 || '') !== optionValue
    ) {
      await shopifyREST(`/variants/${matched.id}.json`, 'PUT', {
        variant: {
          id: matched.id,
          price: normalizedPrice,
          sku,
          inventory_policy: 'continue',
          option1: optionValue,
        },
      });
    }
    return String(matched.id);
  }

  const variantPayload = {
    product_id: Number(productId),
    price: normalizedPrice,
    sku,
    taxable: true,
    requires_shipping: true,
    inventory_policy: 'continue',
  };

  if (product.options && product.options.length >= 1) {
    variantPayload.option1 = optionValue;
    if (product.options.length >= 2) variantPayload.option2 = 'Default';
    if (product.options.length >= 3) variantPayload.option3 = 'Default';
  }

  try {
    const created = await shopifyREST(`/products/${productId}/variants.json`, 'POST', { variant: variantPayload });
    const createdId = created?.variant?.id;
    if (!createdId) {
      throw new Error('Shopify variant olusturulamadi');
    }
    return String(createdId);
  } catch (error) {
    const message = String(error?.message || '');
    const isDuplicateVariantError =
      message.includes('Shopify REST error: 422') && message.toLowerCase().includes('already exists');

    if (!isDuplicateVariantError) {
      throw error;
    }

    // A variant with the same option value already exists (often after soft-delete/archive flows).
    // Re-fetch product and bind the existing variant instead of failing the request.
    const productAfterCreateError = await getProduct(productId);
    const variantsAfterCreateError = productAfterCreateError?.variants || [];
    const extraAfterCreateError = await getAllProductVariants(productId);
    const existing = findMatchingVariant(
      [...variantsAfterCreateError, ...extraAfterCreateError],
      { sku, optionValues }
    );

    if (!existing?.id) {
      throw error;
    }

    await shopifyREST(`/variants/${existing.id}.json`, 'PUT', {
      variant: {
        id: existing.id,
        price: normalizedPrice,
        sku,
        inventory_policy: 'continue',
        option1: optionValue,
      },
    });

    return String(existing.id);
  }
}

