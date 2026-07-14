import { defineFunction, secret } from '@aws-amplify/backend';

export const stripePayment = defineFunction({
  name: 'stripePayment',
  entry: './index.mjs',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
  },
  timeoutSeconds: 30,
});
