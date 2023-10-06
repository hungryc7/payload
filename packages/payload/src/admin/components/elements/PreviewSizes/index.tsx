import React, { useEffect, useState } from 'react'

import type { SanitizedCollectionConfig } from '../../../../exports/types'
import type { FileSizes, Upload } from '../../../../uploads/types'
import type { Data } from '../../forms/Form/types'

import Meta from '../FileDetails/Meta'
import './index.scss'

const baseClass = 'preview-sizes'

const sortSizes = (sizes: FileSizes, imageSizes: Upload['imageSizes']) => {
  if (!imageSizes || imageSizes.length === 0) return sizes

  const orderedSizes: FileSizes = {}

  imageSizes.forEach(({ name }) => {
    if (sizes[name]) {
      orderedSizes[name] = sizes[name]
    }
  })

  return orderedSizes
}

const PreviewSizes: React.FC<{
  collection: SanitizedCollectionConfig
  doc?: Data & {
    sizes?: FileSizes
  }
  updatedAt?: string
}> = ({ collection, doc, updatedAt }) => {
  const {
    upload: { imageSizes, staticURL },
  } = collection
  const { sizes } = doc

  const [orderedSizes, setOrderedSizes] = useState<FileSizes>(() => sortSizes(sizes, imageSizes))
  const [selectedSize, setSelectedSize] = useState<null | string>(
    orderedSizes?.[imageSizes[0]?.name]?.filename ? imageSizes[0]?.name : null,
  )
  const [appendUrl, setAppendUrl] = useState<boolean>(false)

  const generateImageUrl = (filename) => {
    const query = appendUrl ? `?${Date.now()}` : ''
    return `${staticURL}/${filename}${query}`
  }

  useEffect(() => {
    setOrderedSizes(sortSizes(sizes, imageSizes))
  }, [sizes, imageSizes, updatedAt])

  useEffect(() => {
    setAppendUrl(true)
  }, [updatedAt])

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__imageWrap`}>
        <div className={`${baseClass}__meta`}>
          <div className={`${baseClass}__sizeName`}>{selectedSize}</div>
          <Meta {...(selectedSize && orderedSizes[selectedSize])} staticURL={staticURL} />
        </div>
        <img
          alt={doc.filename}
          className={`${baseClass}__preview`}
          src={generateImageUrl(`${orderedSizes[selectedSize]?.filename}`)}
        />
      </div>
      <div className={`${baseClass}__listWrap`}>
        <div className={`${baseClass}__list`}>
          {Object.entries(orderedSizes).map(([key, val]) => {
            const selected = selectedSize === key
            if (val?.filename) {
              return (
                <div
                  className={[`${baseClass}__sizeOption`, selected && `${baseClass}--selected`]
                    .filter(Boolean)
                    .join(' ')}
                  key={key}
                  onClick={() => setSelectedSize(key)}
                  onKeyDown={(e) => {
                    if (e.keyCode === 13) {
                      setSelectedSize(key)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`${baseClass}__image`}>
                    <img alt={val.filename} src={generateImageUrl(val.filename)} />
                  </div>
                  <div className={`${baseClass}__sizeMeta`}>
                    <div className={`${baseClass}__sizeName`}>{key}</div>
                    <Meta {...val} staticURL={staticURL} />
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
export default PreviewSizes
