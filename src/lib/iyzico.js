import Iyzipay from 'iyzipay';

// iyzico API istemcisi
const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com',
});

/**
 * iyzico checkout form başlat (ilk abonelik ödemesi)
 * 3D Secure ile kart bilgilerini toplar ve tokenize eder
 */
export async function initializeCheckoutForm({
    price,
    paidPrice,
    currency = 'TRY',
    basketId,
    paymentGroup = 'SUBSCRIPTION',
    callbackUrl,
    buyer,
    shippingAddress,
    billingAddress,
    basketItems,
    enableInstallment = 0,
    cardUserKey = null,
}) {
    return new Promise((resolve, reject) => {
        const request = {
            locale: 'tr',
            conversationId: basketId,
            price: price.toString(),
            paidPrice: paidPrice.toString(),
            currency: currency,
            basketId: basketId,
            paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
            callbackUrl: callbackUrl,
            enabledInstallments: [1], // Tek çekim
            buyer: buyer,
            shippingAddress: shippingAddress,
            billingAddress: billingAddress,
            basketItems: basketItems,
        };

        // Eğer daha önce kart kaydedilmişse
        if (cardUserKey) {
            request.cardUserKey = cardUserKey;
        }

        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * iyzico checkout form sonucunu al
 */
export async function retrieveCheckoutForm(token) {
    return new Promise((resolve, reject) => {
        const request = {
            locale: 'tr',
            token: token,
        };

        iyzipay.checkoutForm.retrieve(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Kayıtlı kartla tekrarlayan ödeme çek
 * Bu fonksiyon cron job ile çağrılır
 */
export async function createPaymentWithSavedCard({
    price,
    paidPrice,
    currency = 'TRY',
    conversationId,
    cardUserKey,
    cardToken,
    buyer,
    shippingAddress,
    billingAddress,
    basketItems,
}) {
    return new Promise((resolve, reject) => {
        const request = {
            locale: 'tr',
            conversationId: conversationId,
            price: price.toString(),
            paidPrice: paidPrice.toString(),
            currency: currency,
            installment: '1',
            paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
            paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
            paymentCard: {
                cardUserKey: cardUserKey,
                cardToken: cardToken,
            },
            buyer: buyer,
            shippingAddress: shippingAddress,
            billingAddress: billingAddress,
            basketItems: basketItems,
        };

        iyzipay.payment.create(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Kayıtlı kartları listele
 */
export async function retrieveCards(cardUserKey) {
    return new Promise((resolve, reject) => {
        const request = {
            locale: 'tr',
            cardUserKey: cardUserKey,
        };

        iyzipay.cardList.retrieve(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * 3D Secure ile ödeme başlat
 */
export async function initializeThreeDS({
    price,
    paidPrice,
    currency = 'TRY',
    conversationId,
    cardUserKey,
    cardToken,
    callbackUrl,
    buyer,
    shippingAddress,
    billingAddress,
    basketItems,
}) {
    return new Promise((resolve, reject) => {
        const request = {
            locale: 'tr',
            conversationId: conversationId,
            price: price.toString(),
            paidPrice: paidPrice.toString(),
            currency: currency,
            installment: '1',
            paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
            paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
            callbackUrl: callbackUrl,
            paymentCard: {
                cardUserKey: cardUserKey,
                cardToken: cardToken,
            },
            buyer: buyer,
            shippingAddress: shippingAddress,
            billingAddress: billingAddress,
            basketItems: basketItems,
        };

        iyzipay.threedsInitialize.create(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

export default iyzipay;
