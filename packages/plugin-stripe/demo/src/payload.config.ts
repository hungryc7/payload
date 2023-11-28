import path from 'path'
import { buildConfig } from 'payload/config'
import { viteBundler } from '@payloadcms/bundler-vite'
// import { webpackBundler } from '@payloadcms/bundler-webpack'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import stripePlugin from '../../src'
import Customers from './collections/Customers'
import Products from './collections/Products'
import Users from './collections/Users'
import { subscriptionCreatedOrUpdated } from './webhooks/subscriptionCreatedOrUpdated'
import { subscriptionDeleted } from './webhooks/subscriptionDeleted'
import { syncPriceJSON } from './webhooks/syncPriceJSON'

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_CMS_URL,
  admin: {
    user: Users.slug,
    bundler: viteBundler(),
    // bundler: webpackBundler(),
  },
  collections: [Users, Customers, Products],
  editor: lexicalEditor({}),
  localization: {
    locales: ['en', 'es', 'de'],
    defaultLocale: 'en',
    fallback: true,
  },
  plugins: [
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      isTestKey: process.env.PAYLOAD_PUBLIC_IS_STRIPE_TEST_KEY === 'true',
      logs: true,
      sync: [
        {
          collection: 'customers',
          stripeResourceType: 'customers',
          stripeResourceTypeSingular: 'customer',
          fields: [
            {
              fieldPath: 'name',
              stripeProperty: 'name',
            },
            {
              fieldPath: 'email',
              stripeProperty: 'email',
            },
            // NOTE: nested fields are not supported yet, because the Stripe API keeps everything separate at the top-level
            // because of this, we need to wire our own custom webhooks to handle these changes
            // In the future, support for nested fields may look something like this:
            // {
            //   field: 'subscriptions.name',
            //   property: 'plan.name',
            // }
          ],
        },
        {
          collection: 'products',
          stripeResourceType: 'products',
          stripeResourceTypeSingular: 'product',
          fields: [
            {
              fieldPath: 'name',
              stripeProperty: 'name',
            },
            {
              fieldPath: 'price.stripePriceID',
              stripeProperty: 'default_price',
            },
          ],
        },
      ],
      rest: false,
      webhooks: {
        'customer.subscription.created': subscriptionCreatedOrUpdated,
        'customer.subscription.updated': subscriptionCreatedOrUpdated,
        'customer.subscription.deleted': subscriptionDeleted,
        'product.created': syncPriceJSON,
        'product.updated': syncPriceJSON,
      },
      stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET,
    }),
  ],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI,
  }),
})
