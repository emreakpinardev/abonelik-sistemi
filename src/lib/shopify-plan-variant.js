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

function buildOptionValue({ interval, intervalCount, price }) {
  return `Subscription ${intervalCount} ${String(interval).toLowerCase()}`;
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
  const optionValue = buildOptionValue({ interval, intervalCount, price: normalizedPrice });

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
  const matched = variants.find((v) => String(v.sku || '') === sku);
  if (matched) {
    if (String(matched.price) !== normalizedPrice) {
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

  const created = await shopifyREST(`/products/${productId}/variants.json`, 'POST', { variant: variantPayload });
  const createdId = created?.variant?.id;
  if (!createdId) {
    throw new Error('Shopify variant olusturulamadi');
  }
  return String(createdId);
}
