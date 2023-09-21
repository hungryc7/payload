import type { SanitizedCollectionConfig, TypeWithID } from '../collections/config/types'
import type { PayloadRequest } from '../express/types'
import type { SanitizedGlobalConfig } from '../globals/config/types'
import type { Payload } from '../payload'

import sanitizeInternalFields from '../utilities/sanitizeInternalFields'
import { enforceMaxVersions } from './enforceMaxVersions'

type Args = {
  autosave?: boolean
  collection?: SanitizedCollectionConfig
  docWithLocales: any
  draft?: boolean
  global?: SanitizedGlobalConfig
  id?: number | string
  payload: Payload
  req?: PayloadRequest
}

export const saveVersion = async ({
  id,
  autosave,
  collection,
  docWithLocales: doc,
  draft,
  global,
  payload,
  req,
}: Args): Promise<TypeWithID> => {
  let result
  let entityConfig
  let createNewVersion = true
  const now = new Date().toISOString()

  if (collection) {
    entityConfig = collection
  }

  if (global) {
    entityConfig = global
  }
  const versionData = { ...doc }
  if (draft) versionData._status = 'draft'
  if (versionData._id) delete versionData._id

  try {
    if (autosave) {
      const { docs } = await payload.db.findVersions({
        collection: entityConfig.slug,
        limit: 1,
        req,
        sort: '-updatedAt',
        where: {
          parent: {
            equals: id,
          },
        },
      })
      const [latestVersion] = docs

      // overwrite the latest version if it's set to autosave
      if ((latestVersion as any)?.autosave === true) {
        createNewVersion = false

        const data: Record<string, unknown> = {
          createdAt: new Date(latestVersion.createdAt).toISOString(),
          updatedAt: draft ? now : new Date(doc.updatedAt).toISOString(),
          version: versionData,
        }

        result = await payload.db.updateVersion({
          id: latestVersion.id,
          collectionSlug: entityConfig.slug,
          req,
          versionData: data,
        })
      }
    }

    if (createNewVersion) {
      result = await payload.db.createVersion({
        autosave: Boolean(autosave),
        collectionSlug: entityConfig.slug,
        createdAt: doc?.createdAt ? new Date(doc.createdAt).toISOString() : now,
        parent: collection ? id : undefined,
        req,
        updatedAt: draft ? now : new Date(doc.updatedAt).toISOString(),
        versionData,
      })
    }
  } catch (err) {
    let errorMessage: string

    if (collection)
      errorMessage = `There was an error while saving a version for the ${collection.labels.singular} with ID ${id}.`
    if (global)
      errorMessage = `There was an error while saving a version for the global ${global.label}.`
    payload.logger.error(errorMessage)
    payload.logger.error(err)
  }

  let max = 100

  if (collection && typeof collection.versions.maxPerDoc === 'number')
    max = collection.versions.maxPerDoc
  if (global && typeof global.versions.max === 'number') max = global.versions.max

  if (createNewVersion && max > 0) {
    await enforceMaxVersions({
      id,
      collection,
      global,
      max,
      payload,
      req,
    })
  }

  result = JSON.parse(JSON.stringify(result))

  let createdVersion = result.version
  createdVersion.createdAt = result.createdAt
  createdVersion.updatedAt = result.updatedAt

  createdVersion = sanitizeInternalFields(createdVersion)
  createdVersion.id = id

  return createdVersion
}
