import type { Response } from 'express'
import type { Config as GeneratedTypes } from 'payload/generated-types'
import type { MarkOptional } from 'ts-essentials'

import type { Collection } from '../../collections/config/types'
import type { PayloadRequest } from '../../express/types'

import { Forbidden } from '../../errors'
import { initTransaction } from '../../utilities/initTransaction'
import { killTransaction } from '../../utilities/killTransaction'

export type Arguments<T extends { [field: number | string | symbol]: unknown }> = {
  collection: Collection
  data: MarkOptional<T, 'createdAt' | 'id' | 'sizes' | 'updatedAt'> & {
    email: string
    password: string
  }
  req: PayloadRequest
  res: Response
}

export type Result<T> = {
  message: string
  user: T
}

async function registerFirstUser<TSlug extends keyof GeneratedTypes['collections']>(
  args: Arguments<GeneratedTypes['collections'][TSlug]>,
): Promise<Result<GeneratedTypes['collections'][TSlug]>> {
  const {
    collection: {
      config,
      config: {
        auth: { verify },
        slug,
      },
    },
    data,
    req,
    req: { payload },
  } = args

  try {
    const shouldCommit = await initTransaction(req)

    const doc = await payload.db.findOne({
      collection: config.slug,
      req,
    })

    if (doc) throw new Forbidden(req.t)

    // /////////////////////////////////////
    // Register first user
    // /////////////////////////////////////

    const result = await payload.create<TSlug>({
      collection: slug as TSlug,
      data,
      overrideAccess: true,
      req,
    })

    // auto-verify (if applicable)
    if (verify) {
      await payload.update({
        id: result.id,
        collection: slug,
        data: {
          _verified: true,
        },
      })
    }

    // /////////////////////////////////////
    // Log in new user
    // /////////////////////////////////////

    const { token } = await payload.login({
      ...args,
      collection: slug,
    })

    const resultToReturn = {
      ...result,
      token,
    }

    if (shouldCommit) await payload.db.commitTransaction(req.transactionID)

    return {
      message: 'Registered and logged in successfully. Welcome!',
      user: resultToReturn,
    }
  } catch (error: unknown) {
    await killTransaction(req)
    throw error
  }
}

export default registerFirstUser
