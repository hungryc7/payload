import type { Config as GeneratedTypes } from 'payload/generated-types'

import type { PayloadRequest } from '../../../express/types'
import type { Payload } from '../../../payload'
import type { Document } from '../../../types'

import { getDataLoader } from '../../../collections/dataloader'
import { APIError } from '../../../errors'
import { setRequestContext } from '../../../express/setRequestContext'
import { i18nInit } from '../../../translations/init'
import restoreVersion from '../restoreVersion'

export type Options<T extends keyof GeneratedTypes['globals']> = {
  depth?: number
  fallbackLocale?: string
  id: string
  locale?: string
  overrideAccess?: boolean
  showHiddenFields?: boolean
  slug: string
  user?: Document
}

export default async function restoreVersionLocal<T extends keyof GeneratedTypes['globals']>(
  payload: Payload,
  options: Options<T>,
): Promise<GeneratedTypes['globals'][T]> {
  const {
    depth,
    fallbackLocale = null,
    id,
    locale = payload.config.localization ? payload.config.localization?.defaultLocale : null,
    overrideAccess = true,
    showHiddenFields,
    slug: globalSlug,
    user,
  } = options

  const globalConfig = payload.globals.config.find((config) => config.slug === globalSlug)
  const i18n = i18nInit(payload.config.i18n)

  if (!globalConfig) {
    throw new APIError(`The global with slug ${String(globalSlug)} can't be found.`)
  }

  const req = {
    fallbackLocale,
    i18n,
    locale,
    payload,
    payloadAPI: 'local',
    t: i18n.t,
    user,
  } as PayloadRequest
  setRequestContext(req)

  if (!req.payloadDataLoader) req.payloadDataLoader = getDataLoader(req)

  return restoreVersion({
    depth,
    globalConfig,
    id,
    overrideAccess,
    req,
    showHiddenFields,
  })
}
