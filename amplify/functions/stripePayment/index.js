import { request } from 'https';

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY;

function stripeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? new URLSearchParams(data).toString() : '';
    const options = {
      hostname: 'api.stripe.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) } catch { resolve(raw) }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const { action } = body;

    if (action === 'createPaymentIntent') {
      const { amount, currency = 'usd', customerId } = body;
      const data = {
        amount: String(Math.round(amount * 100)),
        currency,
        'automatic_payment_methods[enabled]': 'true',
        'metadata[type]': 'topup',
      };
      if (customerId) data.customer = customerId;
      const pi = await stripeRequest('POST', '/v1/payment_intents', data);
      return { statusCode: 200, headers, body: JSON.stringify({ clientSecret: pi.client_secret, paymentIntentId: pi.id }) };
    }

    if (action === 'createCustomer') {
      const { email, name, userId } = body;
      const customer = await stripeRequest('POST', '/v1/customers', { email, name, 'metadata[userId]': userId });
      return { statusCode: 200, headers, body: JSON.stringify({ customerId: customer.id }) };
    }

    if (action === 'p2pTransfer') {
      const { amount, senderId, recipientId, memo } = body;
      const pi = await stripeRequest('POST', '/v1/payment_intents', {
        amount: String(Math.round(amount * 100)),
        currency: 'usd',
        'payment_method_types[]': 'card',
        'metadata[type]': 'p2p',
        'metadata[senderId]': senderId,
        'metadata[recipientId]': recipientId,
        'metadata[memo]': memo || '',
      });
      return { statusCode: 200, headers, body: JSON.stringify({ paymentIntentId: pi.id, status: pi.status }) };
    }

    if (action === 'getPaymentMethods') {
      const { customerId } = body;
      const methods = await stripeRequest('GET', `/v1/payment_methods?customer=${customerId}&type=card`, null);
      return { statusCode: 200, headers, body: JSON.stringify({ paymentMethods: methods.data }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    console.error('Stripe Lambda error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
