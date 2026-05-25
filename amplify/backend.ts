import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { stripePayment } from './functions/stripePayment/resource';

defineBackend({
  auth,
  data,
  stripePayment,
});
