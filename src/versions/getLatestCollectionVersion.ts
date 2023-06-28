import { docHasTimestamps } from '../types';
import { Payload } from '../payload';
import { SanitizedCollectionConfig, TypeWithID } from '../collections/config/types';
import { TypeWithVersion } from './types';
import type { FindOneArgs } from '../database/types';

type Args = {
  payload: Payload
  query: FindOneArgs
  id: string | number
  config: SanitizedCollectionConfig
}

export const getLatestCollectionVersion = async <T extends TypeWithID = any>({
  payload,
  config,
  query,
  id,
}: Args): Promise<T> => {
  let latestVersion: TypeWithVersion<T>;

  if (config.versions?.drafts) {
    const { docs } = await payload.db.findVersions<T>({
      collection: config.slug,
      where: { parent: { equals: id } },
      sort: [{
        property: 'updatedAt',
        direction: 'desc',
      }],
    });
    [latestVersion] = docs;
  }

  const doc = await payload.db.findOne<T>(query);


  if (!latestVersion || (docHasTimestamps(doc) && latestVersion.updatedAt < doc.updatedAt)) {
    return doc;
  }

  return {
    ...latestVersion.version,
    id,
    updatedAt: latestVersion.updatedAt,
    createdAt: latestVersion.createdAt,
  };
};
