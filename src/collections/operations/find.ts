import { Where } from '../../types';
import { PayloadRequest } from '../../express/types';
import executeAccess from '../../auth/executeAccess';
import { Collection, TypeWithID } from '../config/types';
import { PaginatedDocs } from '../../mongoose/types';
import { AccessResult } from '../../config/types';
import { afterRead } from '../../fields/hooks/afterRead';
import { validateQueryPaths } from '../../database/queryValidation/validateQueryPaths';
import { appendVersionToQueryKey } from '../../versions/drafts/appendVersionToQueryKey';
import { buildVersionCollectionFields } from '../../versions/buildCollectionFields';
import { combineQueries } from '../../database/combineQueries';

export type Arguments = {
  collection: Collection
  where?: Where
  page?: number
  limit?: number
  sort?: string
  depth?: number
  currentDepth?: number
  req?: PayloadRequest
  overrideAccess?: boolean
  disableErrors?: boolean
  pagination?: boolean
  showHiddenFields?: boolean
  draft?: boolean
}

async function find<T extends TypeWithID & Record<string, unknown>>(
  incomingArgs: Arguments,
): Promise<PaginatedDocs<T>> {
  let args = incomingArgs;

  // /////////////////////////////////////
  // beforeOperation - Collection
  // /////////////////////////////////////

  await args.collection.config.hooks.beforeOperation.reduce(async (priorHook, hook) => {
    await priorHook;

    args = (await hook({
      args,
      operation: 'read',
    })) || args;
  }, Promise.resolve());

  const {
    where,
    page,
    limit,
    depth,
    currentDepth,
    draft: draftsEnabled,
    collection,
    collection: {
      config: collectionConfig,
    },
    sort,
    req,
    req: {
      locale,
      payload,
    },
    overrideAccess,
    disableErrors,
    showHiddenFields,
    pagination = true,
  } = args;

  // /////////////////////////////////////
  // Access
  // /////////////////////////////////////

  let accessResult: AccessResult;

  if (!overrideAccess) {
    accessResult = await executeAccess({ req, disableErrors }, collectionConfig.access.read);

    // If errors are disabled, and access returns false, return empty results
    if (accessResult === false) {
      return {
        docs: [],
        totalDocs: 0,
        totalPages: 1,
        page: 1,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
        limit,
      };
    }
  }

  // /////////////////////////////////////
  // Find
  // /////////////////////////////////////

  const usePagination = pagination && limit !== 0;
  const sanitizedLimit = limit ?? (usePagination ? 10 : 0);
  const sanitizedPage = page || 1;

  let result: PaginatedDocs<T>;

  let fullWhere = combineQueries(where, accessResult);

  if (collectionConfig.versions?.drafts && draftsEnabled) {
    fullWhere = appendVersionToQueryKey(fullWhere);

    await validateQueryPaths({
      collectionConfig: collection.config,
      where: fullWhere,
      req,
      overrideAccess,
      versionFields: buildVersionCollectionFields(collection.config),
    });

    result = await payload.db.queryDrafts<T>({
      collection: collectionConfig.slug,
      where: fullWhere,
      page: sanitizedPage,
      limit: sanitizedLimit,
      sort,
      pagination: usePagination,
      locale,
    });
  } else {
    await validateQueryPaths({
      collectionConfig,
      where,
      req,
      overrideAccess,
    });

    result = await payload.db.find<T>({
      collection: collectionConfig.slug,
      where: fullWhere,
      page: sanitizedPage,
      limit: sanitizedLimit,
      sort,
      locale,
      pagination,
    });
  }

  // /////////////////////////////////////
  // beforeRead - Collection
  // /////////////////////////////////////

  result = {
    ...result,
    docs: await Promise.all(result.docs.map(async (doc) => {
      let docRef = doc;

      await collectionConfig.hooks.beforeRead.reduce(async (priorHook, hook) => {
        await priorHook;

        docRef = await hook({ req, query: fullWhere, doc: docRef }) || docRef;
      }, Promise.resolve());

      return docRef;
    })),
  };

  // /////////////////////////////////////
  // afterRead - Fields
  // /////////////////////////////////////

  result = {
    ...result,
    docs: await Promise.all(result.docs.map(async (doc) => afterRead<T>({
      depth,
      currentDepth,
      doc,
      entityConfig: collectionConfig,
      overrideAccess,
      req,
      showHiddenFields,
      findMany: true,
    }))),
  };

  // /////////////////////////////////////
  // afterRead - Collection
  // /////////////////////////////////////

  result = {
    ...result,
    docs: await Promise.all(result.docs.map(async (doc) => {
      let docRef = doc;

      await collectionConfig.hooks.afterRead.reduce(async (priorHook, hook) => {
        await priorHook;

        docRef = await hook({ req, query: fullWhere, doc: docRef, findMany: true }) || doc;
      }, Promise.resolve());

      return docRef;
    })),
  };

  // /////////////////////////////////////
  // Return results
  // /////////////////////////////////////

  return result;
}

export default find;
