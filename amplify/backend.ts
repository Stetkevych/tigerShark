import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { stripePayment } from './functions/stripePayment/resource';
import { CfnUrl, FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { Stack } from 'aws-cdk-lib';
import { AnyPrincipal } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  stripePayment,
});

const lambdaFn = backend.stripePayment.resources.lambda;

const fnUrl = new CfnUrl(Stack.of(lambdaFn), 'StripePaymentFunctionUrl', {
  targetFunctionArn: lambdaFn.functionArn,
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowOrigins: ['*'],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});

// Grant public invoke permission
lambdaFn.addPermission('AllowFunctionUrlInvoke', {
  principal: new AnyPrincipal(),
  action: 'lambda:InvokeFunctionUrl',
  functionUrlAuthType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    stripeLambdaUrl: fnUrl.attrFunctionUrl,
  },
});
