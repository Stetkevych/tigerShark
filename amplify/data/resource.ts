import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({

  // ── User Profile ─────────────────────────────────────────────
  UserProfile: a
    .model({
      userId:      a.string().required(),
      username:    a.string().required(),
      displayName: a.string().required(),
      bio:         a.string(),
      avatarColor: a.string(),
      balance:     a.float().default(0),
      stripeCustomerId: a.string(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  // ── Message Thread (between two users) ───────────────────────
  Thread: a
    .model({
      participantA: a.string().required(),
      participantB: a.string().required(),
      lastMessage:  a.string(),
      lastMessageAt: a.datetime(),
      unreadA:      a.integer().default(0),
      unreadB:      a.integer().default(0),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  // ── Individual Message ────────────────────────────────────────
  Message: a
    .model({
      threadId:  a.string().required(),
      senderId:  a.string().required(),
      content:   a.string().required(),
      read:      a.boolean().default(false),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  // ── Transaction (payment record) ─────────────────────────────
  Transaction: a
    .model({
      senderId:        a.string().required(),
      recipientId:     a.string().required(),
      senderName:      a.string(),
      recipientName:   a.string(),
      amount:          a.float().required(),
      memo:            a.string(),
      status:          a.enum(['pending', 'completed', 'failed']),
      stripePaymentId: a.string(),
      type:            a.enum(['send', 'request', 'topup', 'withdraw']),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
