import type { Where } from '../../types';
import executeAccess from '../../auth/executeAccess';
import { AccessResult } from '../../config/types';
import replaceWithDraftIfAvailable from '../../versions/drafts/replaceWithDraftIfAvailable';
import { afterRead } from '../../fields/hooks/afterRead';
import { SanitizedGlobalConfig } from '../config/types';
import { PayloadRequest } from '../../express/types';
import { initTransaction } from '../../utilities/initTransaction';
import { killTransaction } from '../../utilities/killTransaction';

type Args = {
  globalConfig: SanitizedGlobalConfig
  locale?: string
  req: PayloadRequest
  slug: string
  depth?: number
  showHiddenFields?: boolean
  draft?: boolean
  overrideAccess?: boolean
}

async function findOne<T extends Record<string, unknown>>(args: Args): Promise<T> {
  const {
    globalConfig,
    req,
    req: {
      payload,
      locale,
    },
    slug,
    depth,
    showHiddenFields,
    draft: draftEnabled = false,
    overrideAccess = false,
  } = args;

  try {
    const shouldCommit = await initTransaction(req);

    // /////////////////////////////////////
    // Retrieve and execute access
    // /////////////////////////////////////

    let accessResult: AccessResult;

    if (!overrideAccess) {
      accessResult = await executeAccess({ req }, globalConfig.access.read);
    }

    // /////////////////////////////////////
    // Perform database operation
    // /////////////////////////////////////

    let doc = await req.payload.db.findGlobal({
      slug,
      locale,
      where: overrideAccess ? undefined : accessResult as Where,
      req,
    });
    if (!doc) {
      doc = {};
    }

    // /////////////////////////////////////
    // Replace document with draft if available
    // /////////////////////////////////////

    if (globalConfig.versions?.drafts && draftEnabled) {
      doc = await replaceWithDraftIfAvailable({
        entity: globalConfig,
        entityType: 'global',
        doc,
        req,
        overrideAccess,
        accessResult,
      });
    }

    // /////////////////////////////////////
    // Execute before global hook
    // /////////////////////////////////////

    await globalConfig.hooks.beforeRead.reduce(async (priorHook, hook) => {
      await priorHook;

      doc = await hook({
        req,
        doc,
      }) || doc;
    }, Promise.resolve());

    // /////////////////////////////////////
    // Execute field-level hooks and access
    // /////////////////////////////////////

    doc = await afterRead({
      depth,
      doc,
      entityConfig: globalConfig,
      req,
      overrideAccess,
      showHiddenFields,
    });

    // /////////////////////////////////////
    // Execute after global hook
    // /////////////////////////////////////

    await globalConfig.hooks.afterRead.reduce(async (priorHook, hook) => {
      await priorHook;

      doc = await hook({
        req,
        doc,
      }) || doc;
    }, Promise.resolve());

    // /////////////////////////////////////
    // Return results
    // /////////////////////////////////////

    if (shouldCommit) await payload.db.commitTransaction(req.transactionID);

    return doc;
  } catch (error: unknown) {
    await killTransaction(req);
    throw error;
  }
}

export default findOne;
