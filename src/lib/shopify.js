/**
 * Shopify Admin API client
 * Uses GraphQL/REST for orders and product/customer operations.
 */

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
const SHOPIFY_REST_URL = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}`;

/**
 * Shopify GraphQL API call
 */
async function shopifyGraphQL(query, variables = {}) {
    const response = await fetch(SHOPIFY_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${text}`);
    }

    const data = await response.json();

    if (data.errors) {
        throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
}

/**
 * Shopify REST API call
 */
async function shopifyREST(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${SHOPIFY_REST_URL}${endpoint}`, options);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shopify REST error: ${response.status} - ${text}`);
    }

    return response.json();
}

/**
 * Create Shopify order (payment already captured by iyzico)
 */
export async function createOrder({
    customerEmail,
    customerName,
    lineItems,
    shippingAddress,
    billingAddress,
    note = '',
    noteAttributes = [],
    tags = [],
    financialStatus = 'paid', // payment captured by iyzico
    iyzicoPaymentId = '',
}) {
    // Split full name into first/last
    const nameParts = customerName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const orderData = {
        order: {
            email: customerEmail,
            financial_status: financialStatus,
            send_receipt: true,
            send_fulfillment_receipt: true,
            note: note || `iyzico Subscription Payment - Payment ID: ${iyzicoPaymentId}`,
            tags: ['abonelik', 'iyzico', ...tags].join(', '),
            line_items: lineItems.map(item => ({
                variant_id: item.variantId,
                quantity: item.quantity || 1,
                price: item.price,
                ...(item.properties && Object.keys(item.properties).length > 0
                    ? { properties: Object.entries(item.properties).map(([name, value]) => ({ name, value: String(value ?? '') })) }
                    : {}),
            })),
            ...(Array.isArray(noteAttributes) && noteAttributes.length > 0
                ? { note_attributes: noteAttributes.map((attr) => ({ name: String(attr.name || ''), value: String(attr.value || '') })) }
                : {}),
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: customerEmail,
            },
            billing_address: billingAddress ? {
                first_name: firstName,
                last_name: lastName,
                address1: billingAddress.address || '',
                city: billingAddress.city || '',
                country: billingAddress.country || 'TR',
                zip: billingAddress.zipCode || '',
            } : undefined,
            shipping_address: shippingAddress ? {
                first_name: firstName,
                last_name: lastName,
                address1: shippingAddress.address || '',
                city: shippingAddress.city || '',
                country: shippingAddress.country || 'TR',
                zip: shippingAddress.zipCode || '',
            } : undefined,
            transactions: [
                {
                    kind: 'sale',
                    status: 'success',
                    amount: lineItems.reduce((sum, item) => sum + parseFloat(item.price) * (item.quantity || 1), 0).toFixed(2),
                    gateway: 'iyzico',
                },
            ],
        },
    };

    const result = await shopifyREST('/orders.json', 'POST', orderData);
    return result.order;
}

/**
 * Fetch products from Shopify
 */
export async function getProducts() {
    const result = await shopifyREST('/products.json?status=active&limit=50');
    return result.products;
}

/**
 * Fetch single product from Shopify
 */
export async function getProduct(productId) {
    const result = await shopifyREST(`/products/${productId}.json`);
    return result.product;
}

/**
 * Find customer by email
 */
export async function findCustomerByEmail(email) {
    const result = await shopifyREST(`/customers/search.json?query=email:${encodeURIComponent(email)}`);
    return result.customers?.[0] || null;
}

/**
 * Create customer in Shopify
 */
export async function createCustomer({ email, firstName, lastName, phone }) {
    const result = await shopifyREST('/customers.json', 'POST', {
        customer: {
            email,
            first_name: firstName,
            last_name: lastName,
            phone,
            verified_email: true,
            send_email_welcome: false,
        },
    });
    return result.customer;
}

export { shopifyGraphQL, shopifyREST };

