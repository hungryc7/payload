import { UpdateOne } from 'payload/database';
import toSnakeCase from 'to-snake-case';
import { SQL } from 'drizzle-orm';
import buildQuery from '../queries/buildQuery';
import { upsertRow } from '../upsertRow';

export const updateOne: UpdateOne = async function updateOne({
  collection: collectionSlug,
  data,
  draft,
  id,
  locale,
  req,
  where,
}) {
  const collection = this.payload.collections[collectionSlug].config;

  let query: SQL<unknown>;

  if (where) {
    query = await buildQuery({
      adapter: this,
      collectionSlug,
      locale,
      where,
    });
  }

  const result = await upsertRow({
    adapter: this,
    data,
    fallbackLocale: req.fallbackLocale,
    fields: collection.fields,
    id,
    locale: req.locale,
    operation: 'update',
    tableName: toSnakeCase(collectionSlug),
    where: query,
  });

  return result;
};
