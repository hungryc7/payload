import Stripe from 'stripe';
import { PayloadRequest } from 'payload/dist/types';
import { StripeConfig } from '../types';
import { Response } from 'express';

export const stripeWebhooks = (
  req: PayloadRequest,
  res: Response,
  next: any,
  stripeConfig: StripeConfig
) => {
  const {
    stripeSecretKey,
    stripeWebhooksEndpointSecret,
    webhooks
  } = stripeConfig;

  if (webhooks && stripeWebhooksEndpointSecret) {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-08-01' });

    const stripeSignature = req.headers['stripe-signature'];

    if (stripeSignature) {
      let event: Stripe.Event | undefined;

      try {
        event = stripe.webhooks.constructEvent(req.body, stripeSignature, stripeWebhooksEndpointSecret);
      } catch (err: any) {
        res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event) {
        if (typeof webhooks === 'function') {
          webhooks(event, stripe, stripeConfig);
        }

        if (typeof webhooks === 'object') {
          const webhookEventHandler = webhooks[event.type];
          if (typeof webhookEventHandler === 'function') {
            webhookEventHandler(event, stripe, stripeConfig)
          };
        }
      }
    }
  }

  res.json({ received: true });
};
