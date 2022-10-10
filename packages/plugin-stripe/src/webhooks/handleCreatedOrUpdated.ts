import { SanitizedStripeConfig, StripeWebhookHandler } from '../types';

type HandleCreatedOrUpdated = (args: Parameters<StripeWebhookHandler>[0] & {
  syncConfig: SanitizedStripeConfig['sync'][0]
  resourceType: string
}) => void;

export const handleCreatedOrUpdated: HandleCreatedOrUpdated = async (args) => {
  const {
    payload,
    event,
    resourceType,
    stripeConfig,
    config: payloadConfig,
    syncConfig
  } = args;

  const { logs } = stripeConfig || {};

  const stripeDoc: any = event?.data?.object || {};

  const {
    id: stripeID,
    object: eventObject
  } = stripeDoc;

  // NOTE: the Stripe API does not nest fields, everything is an object at the top level
  // if the event object and resource type don't match, this change was not top-level
  const isNestedChange = eventObject !== resourceType;

  // let stripeID = docID;
  // if (isNestedChange) {
  //   const parentResource = stripeDoc[resourceType];
  //   stripeID = parentResource;
  // }

  if (isNestedChange) {
    if (logs) payload.logger.info(`- This change occurred on a nested field of ${resourceType}. Nested fields are not yet supported.`);
  }

  if (!isNestedChange) {
    if (logs) payload.logger.info(`- A new document was created or updated in Stripe, now syncing to Payload...`);

    const collectionSlug = syncConfig?.collection;

    const isAuthCollection = Boolean(payloadConfig?.collections?.find((collection) => collection.slug === collectionSlug)?.auth);

    // First, search for an existing document in Payload
    const payloadQuery = await payload.find({
      collection: collectionSlug,
      where: {
        stripeID: {
          equals: stripeID,
        },
      },
    });

    const foundDoc = payloadQuery.docs[0] as any;

    // combine all properties of the Stripe doc and match their respective fields within the document
    let syncedData = syncConfig.fields.reduce((acc, field) => {
      const {
        fieldName,
        stripeProperty
      } = field;

      acc[fieldName] = stripeDoc[stripeProperty];
      return acc;
    }, {} as Record<string, any>);

    syncedData = {
      ...syncedData,
      stripeID,
      skipSync: true,
    }

    if (!foundDoc) {
      if (logs) payload.logger.info(`- No existing '${collectionSlug}' document found with Stripe ID: '${stripeID}', creating new...`);

      // auth docs must use unique emails
      let authDoc = null;

      if (isAuthCollection) {
        try {
          if (stripeDoc?.email) {
            const authQuery = await payload.find({
              collection: collectionSlug,
              where: {
                email: {
                  equals: stripeDoc.email,
                },
              },
            });

            authDoc = authQuery.docs[0] as any;

            if (authDoc) {
              if (logs) payload.logger.info(`- Account already exists with e-mail: ${stripeDoc.email}, updating now...`);

              // account exists by email, so update it instead
              try {
                await payload.update({
                  collection: collectionSlug,
                  id: authDoc.id,
                  data: syncedData,
                });

                if (logs) payload.logger.info(`✅ Successfully updated '${collectionSlug}' document in Payload with ID: '${authDoc.id}.'`);
              } catch (err: any) {
                if (logs) payload.logger.error(`- Error updating existing '${collectionSlug}' document: ${err.message}`);
              }
            }
          } else {
            if (logs) payload.logger.error(`No email was provided from Stripe, cannot create new '${collectionSlug}' document.`);
          }
        } catch (error: any) {
          if (logs) payload.logger.error(`Error looking up '${collectionSlug}' document in Payload: ${error?.message}`);
        }
      }

      if (!isAuthCollection || (isAuthCollection && !authDoc)) {
        try {
          if (logs) payload.logger.info(`- Creating new '${collectionSlug}' document in Payload with Stripe ID: '${stripeID}'.`);

          await payload.create({
            collection: collectionSlug,
            data: {
              ...syncedData,
              password: 'password', // TODO: figure this out, can Payload auto-generate?
              passwordConfirm: 'password', // TODO: figure this out, can Payload auto-generate?
            },
            disableVerificationEmail: isAuthCollection ? true : undefined,
          });

          if (logs) payload.logger.info(`✅ Successfully created new '${collectionSlug}' document in Payload with Stripe ID: '${stripeID}'.`);
        } catch (error: any) {
          if (logs) payload.logger.error(`Error creating new document in Payload: ${error?.message}`);
        }
      }
    } else {
      if (logs) payload.logger.info(`- Existing '${collectionSlug}' document found in Payload with Stripe ID: '${stripeID}', updating now...`);
      console.log('foundDoc', foundDoc);
      console.log('syncedData', syncedData);
      try {
        await payload.update({
          collection: collectionSlug,
          id: foundDoc.id,
          data: {
            ...foundDoc,
            // price: ''
          }
        }
        );

        if (logs) payload.logger.info(`✅ Successfully updated '${collectionSlug}' document in Payload from Stripe ID: '${stripeID}'.`);
      } catch (error: any) {
        if (logs) payload.logger.error(`Error updating '${collectionSlug}' document in Payload: ${error?.message}`);
      }
    }
  }
}
