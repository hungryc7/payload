import { AccessResult } from '../../config/types';
import { Where } from '../../types';
import { Payload } from '../..';
import { PaginatedDocs } from '../../mongoose/types';
import { Collection, CollectionModel, TypeWithID } from '../../collections/config/types';
import { hasWhereAccessResult } from '../../auth';
import { appendVersionToQueryKey } from './appendVersionToQueryKey';
import sanitizeInternalFields from '../../utilities/sanitizeInternalFields';
import replaceWithDraftIfAvailable from './replaceWithDraftIfAvailable';

type AggregateVersion<T> = {
  _id: string
  version: T
  updatedAt: string
  createdAt: string
}

type VersionCollectionMatchMap<T> = {
  [_id: string | number]: {
    updatedAt: string
    createdAt: string
    version: T
  }
}

type Args = {
  accessResult: AccessResult
  collection: Collection
  locale: string
  paginationOptions: any
  payload: Payload
  query: Record<string, unknown>
  where: Where
}

export const mergeDrafts = async <T extends TypeWithID>({
  accessResult,
  collection,
  locale,
  payload,
  paginationOptions,
  query,
  where: incomingWhere,
}: Args): Promise<PaginatedDocs<T>> => {
  console.log('---------STARTING---------');
  // Query the main collection, non-paginated, for any IDs that match the query
  const mainCollectionFind = await collection.Model.find(query, { updatedAt: 1 }, { limit: paginationOptions.limit }).lean();

  // Create object "map" for performant lookup
  const mainCollectionMatchMap = mainCollectionFind.reduce((map, { _id, updatedAt }) => {
    const newMap = map;
    newMap[_id] = updatedAt;
    return newMap;
  }, {});

  console.log({ mainCollectionMatchMap });

  // Query the versions collection with a version-specific query
  const VersionModel = payload.versions[collection.config.slug] as CollectionModel;

  const where = appendVersionToQueryKey(incomingWhere || {});

  const versionQueryToBuild: { where: Where } = {
    where: {
      ...where,
      and: [
        ...where?.and || [],
        {
          'version._status': {
            equals: 'draft',
          },
        },
      ],
    },
  };

  if (hasWhereAccessResult(accessResult)) {
    const versionAccessResult = appendVersionToQueryKey(accessResult);
    versionQueryToBuild.where.and.push(versionAccessResult);
  }

  const versionQuery = await VersionModel.buildQuery(versionQueryToBuild, locale);

  const versionCollectionQuery = await VersionModel.aggregate<AggregateVersion<T>>([
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: '$parent',
        versionID: { $first: '$_id' },
        version: { $first: '$version' },
        updatedAt: { $first: '$updatedAt' },
        createdAt: { $first: '$createdAt' },
      },
    },
    { $match: versionQuery },
    { $limit: paginationOptions.limit },
  ]);

  const includedParentIDs: (string | number)[] = [];

  // Create object "map" for performant lookup
  // and in the same loop, check if there are matched versions without a matched parent
  // This means that the newer version's parent should appear in the main query.
  // To do so, add the version's parent ID into an explicit `includedIDs` array

  const versionCollectionMatchMap = versionCollectionQuery.reduce<VersionCollectionMatchMap<T>>((map, { _id, updatedAt, createdAt, version }) => {
    const newMap = map;
    newMap[_id] = { version, updatedAt, createdAt };

    const matchedParent = mainCollectionMatchMap[_id];
    if (!matchedParent) includedParentIDs.push(_id);
    return newMap;
  }, {});

  console.log({ versionCollectionMatchMap });
  console.log({ includedParentIDs });

  // Now we need to explicitly exclude any parent matches that have newer versions
  // which did NOT appear in the versions query

  const parentsWithoutNewerVersions = await Promise.all(Object.entries(mainCollectionMatchMap).map(async ([parentDocID, parentDocUpdatedAt]) => {
    // If there is a matched version, and it's newer, this parent should remain
    if (versionCollectionMatchMap[parentDocID] && versionCollectionMatchMap[parentDocID].updatedAt > parentDocUpdatedAt) {
      return null;
    }

    // Otherwise, we need to check if there are newer versions present
    // that did not get returned from the versions query. If there are,
    // this says that the newest version does not match the incoming query,
    // and the parent ID should be excluded
    const versionsQuery = await VersionModel.find({
      updatedAt: {
        $gt: parentDocUpdatedAt,
      },
    }, {}, { limit: 1 }).lean();

    if (versionsQuery.length > 0) {
      return parentDocID;
    }

    return null;
  }));

  console.log({ parentsWithoutNewerVersions });

  const excludedParentIDs = parentsWithoutNewerVersions.filter((result) => Boolean(result));

  console.log({ excludedParentIDs });

  // Run a final query against the main collection,
  // passing in the ids to exclude and include
  // so that they appear correctly
  // in paginated results, properly paginated
  const finalQueryToBuild: { where: Where } = {
    where: {
      and: [],
    },
  };

  finalQueryToBuild.where.and.push({ or: [] });

  if (hasWhereAccessResult(accessResult)) {
    finalQueryToBuild.where.and.push(accessResult);
  }

  if (where) {
    finalQueryToBuild.where.and[0].or.push(where);
  }

  if (includedParentIDs.length > 0) {
    finalQueryToBuild.where.and[0].or.push({
      id: {
        in: includedParentIDs,
      },
    });
  }

  if (excludedParentIDs.length > 0) {
    finalQueryToBuild.where.and[0].or.push({
      id: {
        not_in: excludedParentIDs,
      },
    });
  }

  console.log({ finalPayloadQuery: JSON.stringify(finalQueryToBuild, null, 2) });

  const finalQuery = await collection.Model.buildQuery(finalQueryToBuild, locale);

  let result = await collection.Model.paginate(finalQuery, paginationOptions);

  result = {
    ...result,
    docs: await Promise.all(result.docs.map(async (doc) => {
      let sanitizedDoc = JSON.parse(JSON.stringify(doc));
      sanitizedDoc.id = sanitizedDoc._id;
      sanitizedDoc = sanitizeInternalFields(sanitizedDoc);

      const matchedVersion = versionCollectionMatchMap[sanitizedDoc.id];

      if (matchedVersion) {
        return {
          ...sanitizedDoc,
          ...matchedVersion.version,
          createdAt: matchedVersion.createdAt,
          updatedAt: matchedVersion.updatedAt,
        };
      }

      return replaceWithDraftIfAvailable({
        accessResult,
        payload,
        entity: collection.config,
        entityType: 'collection',
        doc: sanitizedDoc,
        locale,
      });
    })),
  };

  return result;
};
