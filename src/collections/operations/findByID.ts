/* eslint-disable no-underscore-dangle */
import memoize from 'micro-memoize';
import { PayloadRequest } from '../../express/types';
import { Collection, TypeWithID } from '../config/types';
import { NotFound } from '../../errors';
import executeAccess from '../../auth/executeAccess';
import replaceWithDraftIfAvailable from '../../versions/drafts/replaceWithDraftIfAvailable';
import { afterRead } from '../../fields/hooks/afterRead';
import { combineQueries } from '../../database/combineQueries';
import type { FindOneArgs } from '../../database/types';

export type Arguments = {
  collection: Collection
  id: string | number
  req: PayloadRequest
  disableErrors?: boolean
  currentDepth?: number
  overrideAccess?: boolean
  showHiddenFields?: boolean
  depth?: number
  draft?: boolean
}

async function findByID<T extends TypeWithID>(
  incomingArgs: Arguments,
): Promise<T> {
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
    depth,
    collection: {
      config: collectionConfig,
    },
    id,
    req,
    req: {
      t,
      locale,
    },
    disableErrors,
    currentDepth,
    overrideAccess = false,
    showHiddenFields,
    draft: draftEnabled = false,
  } = args;

  // /////////////////////////////////////
  // Access
  // /////////////////////////////////////

  const accessResult = !overrideAccess ? await executeAccess({ req, disableErrors, id }, collectionConfig.access.read) : true;

  // If errors are disabled, and access returns false, return null
  if (accessResult === false) return null;


  const findOneArgs: FindOneArgs = {
    collection: collectionConfig.slug,
    where: combineQueries({ id: { equals: id } }, accessResult),
    locale,
  };

  // /////////////////////////////////////
  // Find by ID
  // /////////////////////////////////////

  if (!findOneArgs.where.and[0].id) throw new NotFound(t);

  if (!req.findByID) req.findByID = {};

  if (!req.findByID[collectionConfig.slug]) {
    const nonMemoizedFindByID = async (query: FindOneArgs) => req.payload.db.findOne(query);

    req.findByID[collectionConfig.slug] = memoize(nonMemoizedFindByID, {
      isPromise: true,
      maxSize: 100,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore This is straight from their docs, bad typings
      transformKey: JSON.stringify,
    });
  }

  let result = await req.findByID[collectionConfig.slug](findOneArgs) as T;

  if (!result) {
    if (!disableErrors) {
      throw new NotFound(t);
    }

    return null;
  }

  // Clone the result - it may have come back memoized
  result = JSON.parse(JSON.stringify(result));


  // /////////////////////////////////////
  // Replace document with draft if available
  // /////////////////////////////////////

  if (collectionConfig.versions?.drafts && draftEnabled) {
    result = await replaceWithDraftIfAvailable({
      entity: collectionConfig,
      entityType: 'collection',
      doc: result,
      accessResult,
      req,
      overrideAccess,
    });
  }

  // /////////////////////////////////////
  // beforeRead - Collection
  // /////////////////////////////////////

  await collectionConfig.hooks.beforeRead.reduce(async (priorHook, hook) => {
    await priorHook;

    result = await hook({
      req,
      query: findOneArgs.where,
      doc: result,
    }) || result;
  }, Promise.resolve());

  // /////////////////////////////////////
  // afterRead - Fields
  // /////////////////////////////////////

  result = await afterRead({
    currentDepth,
    doc: result,
    depth,
    entityConfig: collectionConfig,
    overrideAccess,
    req,
    showHiddenFields,
  });

  // /////////////////////////////////////
  // afterRead - Collection
  // /////////////////////////////////////

  await collectionConfig.hooks.afterRead.reduce(async (priorHook, hook) => {
    await priorHook;

    result = await hook({
      req,
      query: findOneArgs.where,
      doc: result,
    }) || result;
  }, Promise.resolve());

  // /////////////////////////////////////
  // Return results
  // /////////////////////////////////////

  return result;
}

export default findByID;
