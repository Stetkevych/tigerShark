const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { action } = body;

    // ── Create Payment Intent (top up wallet) ─────────────────
    if (action === 'createPaymentIntent') {
      const { amount, currency = 'usd', customerId } = body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // convert to cents
        currency,
        customer: customerId || undefined,
        automatic_payment_methods: { enabled: true },
        metadata: { type: 'topup' },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        }),
      };
    }

    // ── Create or Get Stripe Customer ─────────────────────────
    if (action === 'createCustomer') {
      const { email, name, userId } = body;

      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { userId },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ customerId: customer.id }),
      };
    }

    // ── P2P Transfer (internal wallet transfer via Stripe) ────
    if (action === 'p2pTransfer') {
      const { amount, senderId, recipientId, memo } = body;

      // Record the transfer as a Stripe payment intent with metadata
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          type: 'p2p',
          senderId,
          recipientId,
          memo: memo || '',
        },
        confirm: false,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
        }),
      };
    }

    // ── Get Payment Methods for customer ─────────────────────
    if (action === 'getPaymentMethods') {
      const { customerId } = body;
      const methods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ paymentMethods: methods.data }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Unknown action' }),
    };

  } catch (err) {
    console.error('Stripe Lambda error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
