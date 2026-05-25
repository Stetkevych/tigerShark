import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { action } = body;

    if (action === 'createPaymentIntent') {
      const { amount, currency = 'usd', customerId } = body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        customer: customerId || undefined,
        automatic_payment_methods: { enabled: true },
        metadata: { type: 'topup' },
      });
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        }),
      };
    }

    if (action === 'createCustomer') {
      const { email, name, userId } = body;
      const customer = await stripe.customers.create({ email, name, metadata: { userId } });
      return { statusCode: 200, headers, body: JSON.stringify({ customerId: customer.id }) };
    }

    if (action === 'p2pTransfer') {
      const { amount, senderId, recipientId, memo } = body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: { type: 'p2p', senderId, recipientId, memo: memo || '' },
        confirm: false,
      });
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ paymentIntentId: paymentIntent.id, status: paymentIntent.status }),
      };
    }

    if (action === 'getPaymentMethods') {
      const { customerId } = body;
      const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
      return { statusCode: 200, headers, body: JSON.stringify({ paymentMethods: methods.data }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    console.error('Stripe Lambda error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
