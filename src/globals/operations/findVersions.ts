import { Where } from '../../types';
import { PayloadRequest } from '../../express/types';
import executeAccess from '../../auth/executeAccess';
import sanitizeInternalFields from '../../utilities/sanitizeInternalFields';
import type { PaginatedDocs } from '../../database/types';
import { SanitizedGlobalConfig } from '../config/types';
import { afterRead } from '../../fields/hooks/afterRead';
import { buildVersionGlobalFields } from '../../versions/buildGlobalFields';
import { TypeWithVersion } from '../../versions/types';
import { validateQueryPaths } from '../../database/queryValidation/validateQueryPaths';
import { combineQueries } from '../../database/combineQueries';

export type Arguments = {
  globalConfig: SanitizedGlobalConfig
  where?: Where
  page?: number
  limit?: number
  sort?: string
  depth?: number
  req?: PayloadRequest
  overrideAccess?: boolean
  showHiddenFields?: boolean
}

async function findVersions<T extends TypeWithVersion<T>>(
  args: Arguments,
): Promise<PaginatedDocs<T>> {
  const {
    where,
    page,
    limit,
    depth,
    globalConfig,
    sort,
    req,
    req: {
      locale,
      payload,
    },
    overrideAccess,
    showHiddenFields,
  } = args;

  const versionFields = buildVersionGlobalFields(globalConfig);

  // /////////////////////////////////////
  // Access
  // /////////////////////////////////////

  const accessResults = !overrideAccess ? await executeAccess({ req }, globalConfig.access.readVersions) : true;

  await validateQueryPaths({
    globalConfig,
    versionFields,
    where,
    req,
    overrideAccess,
  });

  const fullWhere = combineQueries(where, accessResults);

  // /////////////////////////////////////
  // Find
  // /////////////////////////////////////

  const paginatedDocs = await payload.db.findGlobalVersions<T>({
    where: fullWhere,
    page: page || 1,
    limit: limit ?? 10,
    sort,
    global: globalConfig.slug,
    locale,
  });

  // /////////////////////////////////////
  // afterRead - Fields
  // /////////////////////////////////////

  let result = {
    ...paginatedDocs,
    docs: await Promise.all(paginatedDocs.docs.map(async (data) => ({
      ...data,
      version: await afterRead({
        depth,
        doc: data.version,
        entityConfig: globalConfig,
        req,
        overrideAccess,
        showHiddenFields,
        findMany: true,
      }),
    }))),
  } as PaginatedDocs<T>;

  // /////////////////////////////////////
  // afterRead - Global
  // /////////////////////////////////////

  result = {
    ...result,
    docs: await Promise.all(result.docs.map(async (doc) => {
      const docRef = doc;

      await globalConfig.hooks.afterRead.reduce(async (priorHook, hook) => {
        await priorHook;

        docRef.version = await hook({ req, query: fullWhere, doc: doc.version, findMany: true }) || doc.version;
      }, Promise.resolve());

      return docRef;
    })),
  };

  // /////////////////////////////////////
  // Return results
  // /////////////////////////////////////

  result = {
    ...result,
    docs: result.docs.map((doc) => sanitizeInternalFields<T>(doc)),
  };

  return result;
}

export default findVersions;
