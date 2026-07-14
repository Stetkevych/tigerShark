import { request } from 'https';

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY;

// Platform fee: 1.5% on card top-ups, $0.25 flat on P2P sends
const TOPUP_FEE_RATE = 0.015;
const SEND_FEE_CENTS = 25;

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
    let body;
    if (typeof event === 'string') body = JSON.parse(event);
    else if (typeof event.body === 'string') body = JSON.parse(event.body);
    else if (event.body && typeof event.body === 'object') body = event.body;
    else body = event;
    const { action } = body;

    // ── Create or fetch Stripe customer ──────────────────────────
    if (action === 'createCustomer') {
      const { email, name, userId } = body;
      const customer = await stripeRequest('POST', '/v1/customers', {
        email, name, 'metadata[userId]': userId,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ customerId: customer.id }) };
    }

    // ── Top-up: create PaymentIntent with platform fee ────────────
    if (action === 'createPaymentIntent') {
      const { amount, customerId, userId, idempotencyKey } = body;
      if (!amount || amount <= 0) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid amount' }) };

      const amountCents = Math.round(amount * 100);
      const feeCents    = Math.round(amountCents * TOPUP_FEE_RATE); // 1.5% platform fee
      const totalCents  = amountCents + feeCents;

      const data = {
        amount:   String(totalCents),
        currency: 'usd',
        'automatic_payment_methods[enabled]': 'true',
        'metadata[type]':        'topup',
        'metadata[userId]':      userId || '',
        'metadata[netAmount]':   String(amountCents),
        'metadata[feeCents]':    String(feeCents),
        'metadata[idempotencyKey]': idempotencyKey || '',
      };
      if (customerId) data.customer = customerId;

      const pi = await stripeRequest('POST', '/v1/payment_intents', data);
      if (pi.error) return { statusCode: 400, headers, body: JSON.stringify({ error: pi.error.message }) };

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          clientSecret:    pi.client_secret,
          paymentIntentId: pi.id,
          totalCharged:    totalCents / 100,
          netAmount:       amountCents / 100,
          fee:             feeCents / 100,
        }),
      };
    }

    // ── P2P send fee calculation (internal balance transfer) ──────
    if (action === 'calcSendFee') {
      const { amount } = body;
      const fee = SEND_FEE_CENTS / 100;
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ amount, fee, total: Number(amount) + fee }),
      };
    }

    // ── Get saved payment methods ─────────────────────────────────
    if (action === 'getPaymentMethods') {
      const { customerId } = body;
      const methods = await stripeRequest('GET', `/v1/payment_methods?customer=${customerId}&type=card`, null);
      return { statusCode: 200, headers, body: JSON.stringify({ paymentMethods: methods.data || [] }) };
    }

    // ── Verify a completed PaymentIntent (called after confirmation) ──
    if (action === 'verifyPaymentIntent') {
      const { paymentIntentId } = body;
      const pi = await stripeRequest('GET', `/v1/payment_intents/${paymentIntentId}`, null);
      if (pi.status !== 'succeeded') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Payment not succeeded: ${pi.status}` }) };
      }
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          status:    pi.status,
          netAmount: Number(pi.metadata?.netAmount || 0) / 100,
          fee:       Number(pi.metadata?.feeCents  || 0) / 100,
          userId:    pi.metadata?.userId,
        }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    console.error('Stripe Lambda error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
