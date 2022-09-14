import path from 'path'
import type { Storage } from '@google-cloud/storage'
import type { CollectionConfig } from 'payload/types'
import type { HandleUpload } from '../../types'

interface Args {
  collection: CollectionConfig
  bucket: string
  acl?: 'Private' | 'Public'
  prefix?: string
  gcs: Storage
}

export const getHandleUpload = ({ gcs, bucket, acl, prefix = '' }: Args): HandleUpload => {
  return async ({ data, file }) => {
    const gcsFile = gcs.bucket(bucket).file(path.posix.join(prefix, file.filename))
    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: file.mimeType,
      },
    })

    if (acl) {
      await gcsFile[`make${acl}`]()
    }

    return data
  }
}
