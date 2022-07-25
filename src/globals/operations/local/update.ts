import { Payload } from '../../..';
import { Document } from '../../../types';
import { PayloadRequest } from '../../../express/types';
import { TypeWithID } from '../../config/types';
import update from '../update';
import { getDataLoader } from '../../../collections/dataloader';

export type Options = {
  slug: string
  depth?: number
  locale?: string
  fallbackLocale?: string
  data: Record<string, unknown>
  user?: Document
  overrideAccess?: boolean
  showHiddenFields?: boolean
  draft?: boolean
}

export default async function updateLocal<T extends TypeWithID = any>(payload: Payload, options: Options): Promise<T> {
  const {
    slug: globalSlug,
    depth,
    locale = payload.config.localization ? payload.config.localization?.defaultLocale : null,
    fallbackLocale = null,
    data,
    user,
    overrideAccess = true,
    showHiddenFields,
    draft,
  } = options;

  const globalConfig = payload.globals.config.find((config) => config.slug === globalSlug);

  const reqToUse = {
    user,
    payloadAPI: 'local',
    locale,
    fallbackLocale,
    payload,
  } as PayloadRequest;

  reqToUse.payloadDataLoader = getDataLoader(reqToUse);

  return update({
    slug: globalSlug,
    data,
    depth,
    globalConfig,
    overrideAccess,
    showHiddenFields,
    draft,
    req: reqToUse,
  });
}
