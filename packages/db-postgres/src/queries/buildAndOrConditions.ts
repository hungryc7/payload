import { Where } from 'payload/types';
import { Field } from 'payload/dist/fields/config/types';
import { SQL } from 'drizzle-orm';
import { parseParams } from './parseParams';
import { PostgresAdapter } from '../types';

export async function buildAndOrConditions({
  where,
  collectionSlug,
  globalSlug,
  adapter,
  locale,
  fields,
}: {
  where: Where[],
  collectionSlug?: string,
  globalSlug?: string,
  adapter: PostgresAdapter
  locale?: string,
  fields: Field[],
}): Promise<SQL[]> {
  const completedConditions = [];
  // Loop over all AND / OR operations and add them to the AND / OR query param
  // Operations should come through as an array
  // eslint-disable-next-line no-restricted-syntax
  for (const condition of where) {
    // If the operation is properly formatted as an object
    if (typeof condition === 'object') {
      // eslint-disable-next-line no-await-in-loop
      const result = await parseParams({
        where: condition,
        collectionSlug,
        globalSlug,
        adapter,
        locale,
        fields,
      });
      if (Object.keys(result).length > 0) {
        completedConditions.push(result);
      }
    }
  }
  return completedConditions;
}
