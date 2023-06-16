import { Config as GeneratedTypes } from 'payload/generated-types';
import { PreferenceRequest } from '../types';
import { Where } from '../../types';

async function findOne(args: PreferenceRequest): Promise<GeneratedTypes['collections']['_preference']> {
  const {
    req: {
      payload,
    },
    user,
    key,
  } = args;

  const where: Where = {
    and: [
      { key: { equals: key } },
      { 'user.value': { equals: user.id } },
      { 'user.relationTo': { equals: user.collection } },
    ],
  };

  const { docs } = await payload.find({
    collection: 'payload-preferences',
    where,
    depth: 0,
    user,
  });

  if (docs.length === 0) return null;

  return docs[0];
}

export default findOne;
