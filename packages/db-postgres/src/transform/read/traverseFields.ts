/* eslint-disable no-param-reassign */
import type { SanitizedConfig } from 'payload/config'
import type { Field, TabAsField } from 'payload/types'

import { fieldAffectsData } from 'payload/types'

import type { BlocksMap } from '../../utilities/createBlocksMap'

import { transformHasManyNumber } from './hasManyNumber'
import { transformRelationship } from './relationship'

type TraverseFieldsArgs = {
  /**
   * Pre-formatted blocks map
   */
  blocks: BlocksMap
  /**
   * The full Payload config
   */
  config: SanitizedConfig
  /**
   * The data reference to be mutated within this recursive function
   */
  dataRef: Record<string, unknown>
  /**
   * Column prefix can be built up by group and named tab fields
   */
  fieldPrefix: string
  /**
   * An array of Payload fields to traverse
   */
  fields: (Field | TabAsField)[]
  /**
   * All hasMany number fields, as returned by Drizzle, keyed on an object by field path
   */
  numbers: Record<string, Record<string, unknown>[]>
  /**
   * The current field path (in dot notation), used to merge in relationships
   */
  path: string
  /**
   * All related documents, as returned by Drizzle, keyed on an object by field path
   */
  relationships: Record<string, Record<string, unknown>[]>
  /**
   * Data structure representing the nearest table from db
   */
  table: Record<string, unknown>
}

// Traverse fields recursively, transforming data
// for each field type into required Payload shape
export const traverseFields = <T extends Record<string, unknown>>({
  blocks,
  config,
  dataRef,
  fieldPrefix,
  fields,
  numbers,
  path,
  relationships,
  table,
}: TraverseFieldsArgs): T => {
  const sanitizedPath = path ? `${path}.` : path

  const formatted = fields.reduce((result, field) => {
    if (field.type === 'tabs') {
      traverseFields({
        blocks,
        config,
        dataRef,
        fieldPrefix,
        fields: field.tabs.map((tab) => ({ ...tab, type: 'tab' })),
        numbers,
        path,
        relationships,
        table,
      })
    }

    if (
      field.type === 'collapsible' ||
      field.type === 'row' ||
      (field.type === 'tab' && !('name' in field))
    ) {
      traverseFields({
        blocks,
        config,
        dataRef,
        fieldPrefix,
        fields: field.fields,
        numbers,
        path,
        relationships,
        table,
      })
    }

    if (fieldAffectsData(field)) {
      const fieldName = `${fieldPrefix || ''}${field.name}`
      const fieldData = table[fieldName]

      if (field.type === 'array') {
        if (Array.isArray(fieldData)) {
          if (field.localized) {
            result[field.name] = fieldData.reduce((arrayResult, row) => {
              if (typeof row._locale === 'string') {
                if (!arrayResult[row._locale]) arrayResult[row._locale] = []

                const rowResult = traverseFields<T>({
                  blocks,
                  config,
                  dataRef: row,
                  fieldPrefix: '',
                  fields: field.fields,
                  numbers,
                  path: `${sanitizedPath}${field.name}.${row._order - 1}`,
                  relationships,
                  table: row,
                })

                arrayResult[row._locale].push(rowResult)
                delete rowResult._locale
              }

              return arrayResult
            }, {})
          } else {
            result[field.name] = fieldData.map((row, i) => {
              return traverseFields<T>({
                blocks,
                config,
                dataRef: row,
                fieldPrefix: '',
                fields: field.fields,
                numbers,
                path: `${sanitizedPath}${field.name}.${i}`,
                relationships,
                table: row,
              })
            })
          }
        }

        return result
      }

      if (field.type === 'blocks') {
        const blockFieldPath = `${sanitizedPath}${field.name}`

        if (Array.isArray(blocks[blockFieldPath])) {
          if (field.localized) {
            result[field.name] = {}

            blocks[blockFieldPath].forEach((row) => {
              if (typeof row._locale === 'string') {
                if (!result[field.name][row._locale]) result[field.name][row._locale] = []
                result[field.name][row._locale].push(row)
                delete row._locale
              }
            })

            Object.entries(result[field.name]).forEach(([locale, localizedBlocks]) => {
              result[field.name][locale] = localizedBlocks.map((row) => {
                const block = field.blocks.find(({ slug }) => slug === row.blockType)

                if (block) {
                  const blockResult = traverseFields<T>({
                    blocks,
                    config,
                    dataRef: row,
                    fieldPrefix: '',
                    fields: block.fields,
                    numbers,
                    path: `${blockFieldPath}.${row._order - 1}`,
                    relationships,
                    table: row,
                  })

                  delete blockResult._order
                  return blockResult
                }

                return {}
              })
            })
          } else {
            result[field.name] = blocks[blockFieldPath].map((row, i) => {
              delete row._order
              const block = field.blocks.find(({ slug }) => slug === row.blockType)

              if (block) {
                return traverseFields<T>({
                  blocks,
                  config,
                  dataRef: row,
                  fieldPrefix: '',
                  fields: block.fields,
                  numbers,
                  path: `${blockFieldPath}.${i}`,
                  relationships,
                  table: row,
                })
              }

              return {}
            })
          }
        }

        return result
      }

      if (field.type === 'relationship' || field.type === 'upload') {
        const relationPathMatch = relationships[`${sanitizedPath}${field.name}`]
        if (!relationPathMatch) return result

        if (field.localized) {
          result[field.name] = {}
          const relationsByLocale: Record<string, Record<string, unknown>[]> = {}

          relationPathMatch.forEach((row) => {
            if (typeof row.locale === 'string') {
              if (!relationsByLocale[row.locale]) relationsByLocale[row.locale] = []
              relationsByLocale[row.locale].push(row)
            }
          })

          Object.entries(relationsByLocale).forEach(([locale, relations]) => {
            transformRelationship({
              field,
              locale,
              ref: result,
              relations,
            })
          })
        } else {
          transformRelationship({
            field,
            ref: result,
            relations: relationPathMatch,
          })
        }

        return result
      }

      if (field.type === 'number' && field.hasMany) {
        const numberPathMatch = numbers[`${sanitizedPath}${field.name}`]
        if (!numberPathMatch) return result

        if (field.localized) {
          result[field.name] = {}
          const numbersByLocale: Record<string, Record<string, unknown>[]> = {}

          numberPathMatch.forEach((row) => {
            if (typeof row.locale === 'string') {
              if (!numbersByLocale[row.locale]) numbersByLocale[row.locale] = []
              numbersByLocale[row.locale].push(row)
            }
          })

          Object.entries(numbersByLocale).forEach(([locale, numbers]) => {
            transformHasManyNumber({
              field,
              locale,
              numberRows: numbers,
              ref: result,
            })
          })
        } else {
          transformHasManyNumber({
            field,
            numberRows: numberPathMatch,
            ref: result,
          })
        }

        return result
      }

      if (field.type === 'select' && field.hasMany) {
        if (Array.isArray(fieldData)) {
          if (field.localized) {
            result[field.name] = fieldData.reduce((selectResult, row) => {
              if (typeof row._locale === 'string') {
                selectResult[row._locale] = row.value
              }

              return selectResult
            }, {})
          } else {
            result[field.name] = fieldData.map(({ value }) => value)
          }
        }
        return result
      }

      const localizedFieldData = {}
      const valuesToTransform: {
        ref: Record<string, unknown>
        table: Record<string, unknown>
      }[] = []

      if (field.localized && Array.isArray(table._locales)) {
        table._locales.forEach((localeRow) => {
          valuesToTransform.push({ ref: localizedFieldData, table: localeRow })
        })
      } else {
        valuesToTransform.push({ ref: result, table })
      }

      valuesToTransform.forEach(({ ref, table }) => {
        const fieldData = table[`${fieldPrefix || ''}${field.name}`]
        const locale = table?._locale

        switch (field.type) {
          case 'tab':
          case 'group': {
            const groupFieldPrefix = `${fieldPrefix || ''}${field.name}_`
            const groupData = {}

            if (field.localized) {
              if (typeof locale === 'string' && !ref[locale]) ref[locale] = {}

              Object.entries(ref).forEach(([groupLocale, groupLocaleData]) => {
                ref[groupLocale] = traverseFields<Record<string, unknown>>({
                  blocks,
                  config,
                  dataRef: groupLocaleData as Record<string, unknown>,
                  fieldPrefix: groupFieldPrefix,
                  fields: field.fields,
                  numbers,
                  path: `${sanitizedPath}${field.name}`,
                  relationships,
                  table,
                })
              })
            } else {
              ref[field.name] = traverseFields<Record<string, unknown>>({
                blocks,
                config,
                dataRef: groupData as Record<string, unknown>,
                fieldPrefix: groupFieldPrefix,
                fields: field.fields,
                numbers,
                path: `${sanitizedPath}${field.name}`,
                relationships,
                table,
              })
            }

            break
          }

          case 'number': {
            let val = fieldData
            // TODO: handle hasMany
            if (typeof fieldData === 'string') {
              val = Number.parseFloat(fieldData)
            }

            if (typeof locale === 'string') {
              ref[locale] = val
            } else {
              result[field.name] = val
            }

            break
          }

          case 'date': {
            let val = fieldData

            if (typeof fieldData === 'string') {
              val = new Date(fieldData).toISOString()
            }

            if (typeof locale === 'string') {
              ref[locale] = val
            } else {
              result[field.name] = val
            }

            break
          }

          default: {
            if (typeof locale === 'string') {
              ref[locale] = fieldData
            } else {
              result[field.name] = fieldData
            }

            break
          }
        }
      })

      if (Object.keys(localizedFieldData).length > 0) {
        result[field.name] = localizedFieldData
      }

      return result
    }

    return result
  }, dataRef)

  return formatted as T
}
