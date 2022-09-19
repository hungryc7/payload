# Payload Stripe Plugin

[![NPM](https://img.shields.io/npm/v/@payloadcms/plugin-stripe)](https://www.npmjs.com/package/@payloadcms/plugin-stripe)

A plugin for [Payload CMS](https://github.com/payloadcms/payload) to manage [Stripe](https://stripe.com) through Payload.

Core features:
  - Layers your Stripe account behind [Payload access control](https://payloadcms.com/docs/access-control/overview)
  - Enables a two-way communication channel between Stripe and Payload
    - Proxies the [Stripe REST API](https://stripe.com/docs/api)
    - Proxies [Stripe webhooks](https://stripe.com/docs/webhooks)

## Installation

```bash
  yarn add @payloadcms/plugin-stripe
  # OR
  npm i @payloadcms/plugin-stripe
```

## Basic Usage

In the `plugins` array of your [Payload config](https://payloadcms.com/docs/configuration/overview), call the plugin with [options](#options):

```js
import { buildConfig } from 'payload/config';
import stripePlugin from '@payloadcms/plugin-stripe';

const config = buildConfig({
  plugins: [
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    })
  ]
});

export default config;
```

### Options

- `stripeSecretKey`

  Required. Your Stripe secret key.

- `stripeWebhookEndpointSecret`

  Optional. Your Stripe webhook endpoint secret. This is needed only if you wish to sync data from Stripe to Payload.

- `webhooks`

  Optional. An object of Stripe webhook handlers, keyed to the name of the event. See [webhooks](#webhooks) for more details or for a list of all available webhooks, see [here](https://stripe.com/docs/cli/trigger#trigger-event).

### Endpoints

One core functionality of this plugin is to enable a two-way communication channel between Stripe and Payload. To do this, the following custom endpoints are automatically opened for you.

>NOTE: the `/api` part of these routes may be different based on the settings defined in your Payload config.

- `POST /api/stripe/rest`

  Proxies the [Stripe REST API](https://stripe.com/docs/api) behind [Payload access control](https://payloadcms.com/docs/access-control/overview) and returns the result. If you need to proxy the API server-side, use the [stripeProxy](#node) function.

  ```js
    const res = await fetch(`/api/stripe/rest`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ContentType: 'application/json',
        // Authorization: `JWT ${token}` // NOTE: do this if not in a browser (i.e. curl or Postman)
      },
      body: JSON.stringify({
        stripeMethod: "stripe.subscriptions.list",
        stripeArgs: {
          customer: "abc"
        }
      })
    })
  ```

- `POST /api/stripe/webhooks`

  Returns an http status code. This is where all Stripe webhook events are sent to be handled. See [webhooks](#webhooks).

### Webhooks

[Stripe webhooks](https://stripe.com/docs/webhooks) are used to sync from Stripe to Payload. Webhooks listen for events on your Stripe account so you can trigger reactions to them. Follow the steps below to enable webhooks.

Development:
1. Login using Stripe cli `stripe login`
1. Forward events to localhost `stripe listen --forward-to localhost:3000/api/stripe/webhooks`

Production:
1. Login and [create a new webhook](https://dashboard.stripe.com/test/webhooks/create) from the Stripe dashboard
1. Paste `YOUR_DOMAIN_NAME/api/stripe/webhooks` as the "Webhook Endpoint URL"
1. Select which events to broadcast
1. Then, handle these events using the `webhooks` portion of this plugin's config:

```js
import { buildConfig } from 'payload/config';
import stripePlugin from '@payloadcms/plugin-stripe';

const config = buildConfig({
  plugins: [
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      stripeWebhookEndpointSecret: process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET,
      webhooks: {
        'customer.subscription.updated': () => {}
      }
    })
  ]
});

export default config;
```

For a full list of available webhooks, see [here](https://stripe.com/docs/cli/trigger#trigger-event).

### Node

You can also proxy the Stripe API server-side using the `stripeProxy` function exported by the plugin. This is exactly what the `/api/stripe/rest` endpoint does behind-the-scenes. Here's an example:

```js
import { stripeProxy } from '@payloadcms/plugin-stripe';

export const MyFunction = async () => {
  try {
    const customer = await stripeProxy({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      stripeMethod: 'customers.create',
      stripeArgs: {
        email: data.email,
      }
    });

    if (customer.status === 200) {
      // DO SOMETHING
    }

    if (customer.status >= 400) {
      throw new Error(customer.message);
    }
  } catch (error) {
    console.error(error.message);
  }
}
```

## TypeScript

All types can be directly imported:

```js
import {
  StripeConfig,
  StripeWebhookHandler.
  StripeProxy
} from '@payloadcms/plugin-stripe/dist/types';
```

### Development

For development purposes, there is a full working example of how this plugin might be used in the [demo](./demo) of this repo. This demo can be developed locally using any Stripe account, you just need a working API key. Then:

```bash
git clone git@github.com:payloadcms/plugin-stripe.git \
  cd plugin-stripe && yarn \
  cd demo && yarn \
  cp .env.example .env \
  vim .env \ # add your Stripe creds to this file
  yarn dev
```

Now you have a running Payload server with this plugin installed, so you can authenticate and begin hitting the routes. To do this, open [Postman](https://www.postman.com/) and import [our config](https://github.com/payloadcms/plugin-stripe/blob/main/src/payload-stripe-plugin.postman_collection.json). First, login to retrieve your Payload access token. This token is automatically attached to the header of all other requests.

## Screenshots

  <!-- ![screenshot 1](https://github.com/@payloadcms/plugin-stripe/blob/main/images/screenshot-1.jpg?raw=true) -->
