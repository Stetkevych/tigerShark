import { defineFunction, secret } from '@aws-amplify/backend';

export const stripePayment = defineFunction({
  name: 'stripePayment',
  entry: './index.js',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
  },
  timeoutSeconds: 30,
  bundling: {
    externalModules: ['stripe'],
  },
});
