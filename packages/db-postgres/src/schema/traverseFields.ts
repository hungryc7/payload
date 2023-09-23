/* eslint-disable no-param-reassign */
import type { Relation } from 'drizzle-orm'
import type { IndexBuilder, PgColumnBuilder, UniqueConstraintBuilder } from 'drizzle-orm/pg-core'
import type { Field, TabAsField } from 'payload/types'

import { relations } from 'drizzle-orm'
import {
  PgNumericBuilder,
  PgVarcharBuilder,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'
import { InvalidConfiguration } from 'payload/errors'
import { fieldAffectsData, optionIsObject } from 'payload/types'
import toSnakeCase from 'to-snake-case'

import type { GenericColumns, PostgresAdapter } from '../types'

import { hasLocalesTable } from '../utilities/hasLocalesTable'
import { buildTable } from './build'
import { createIndex } from './createIndex'
import { parentIDColumnMap } from './parentIDColumnMap'

type Args = {
  adapter: PostgresAdapter
  buildRelationships: boolean
  columnPrefix?: string
  columns: Record<string, PgColumnBuilder>
  disableUnique?: boolean
  fieldPrefix?: string
  fields: (Field | TabAsField)[]
  forceLocalized?: boolean
  indexes: Record<string, (cols: GenericColumns) => IndexBuilder>
  localesColumns: Record<string, PgColumnBuilder>
  localesIndexes: Record<string, (cols: GenericColumns) => IndexBuilder>
  newTableName: string
  parentTableName: string
  relationsToBuild: Map<string, string>
  relationships: Set<string>
}

type Result = {
  hasLocalizedField: boolean
  hasLocalizedManyNumberField: boolean
  hasLocalizedRelationshipField: boolean
  hasManyNumberField: 'index' | boolean
}

export const traverseFields = ({
  adapter,
  buildRelationships,
  columnPrefix,
  columns,
  disableUnique = false,
  fieldPrefix,
  fields,
  forceLocalized,
  indexes,
  localesColumns,
  localesIndexes,
  newTableName,
  parentTableName,
  relationsToBuild,
  relationships,
}: Args): Result => {
  let hasLocalizedField = false
  let hasLocalizedRelationshipField = false
  let hasManyNumberField: 'index' | boolean = false
  let hasLocalizedManyNumberField = false

  let parentIDColType = 'integer'
  if (columns.id instanceof PgNumericBuilder) parentIDColType = 'numeric'
  if (columns.id instanceof PgVarcharBuilder) parentIDColType = 'varchar'

  fields.forEach((field) => {
    if ('name' in field && field.name === 'id') return
    let columnName: string
    let fieldName: string

    let targetTable = columns
    let targetIndexes = indexes

    if (fieldAffectsData(field)) {
      columnName = `${columnPrefix || ''}${toSnakeCase(field.name)}`
      fieldName = `${fieldPrefix || ''}${field.name}`

      // If field is localized,
      // add the column to the locale table instead of main table
      if (adapter.payload.config.localization && (field.localized || forceLocalized)) {
        hasLocalizedField = true
        targetTable = localesColumns
        targetIndexes = localesIndexes
      }

      if (
        (field.unique || field.index) &&
        !['array', 'blocks', 'group', 'point', 'relationship', 'upload'].includes(field.type) &&
        !(field.type === 'number' && field.hasMany === true)
      ) {
        targetIndexes[`${field.name}Idx`] = createIndex({
          name: fieldName,
          columnName,
          unique: disableUnique !== true && field.unique,
        })
      }
    }

    switch (field.type) {
      case 'text':
      case 'email':
      case 'code':
      case 'textarea': {
        targetTable[fieldName] = varchar(columnName)
        break
      }

      case 'number': {
        if (field.hasMany) {
          if (field.localized) {
            hasLocalizedManyNumberField = true
          }

          if (field.index) {
            hasManyNumberField = 'index'
          } else if (!hasManyNumberField) {
            hasManyNumberField = true
          }

          if (field.unique) {
            throw new InvalidConfiguration(
              'Unique is not supported in Postgres for hasMany number fields.',
            )
          }
        } else {
          targetTable[fieldName] = numeric(columnName)
        }
        break
      }

      case 'richText':
      case 'json': {
        targetTable[fieldName] = jsonb(columnName)
        break
      }

      case 'date': {
        targetTable[fieldName] = timestamp(columnName, {
          mode: 'string',
          precision: 3,
          withTimezone: true,
        })
        break
      }

      case 'point': {
        break
      }

      case 'radio':
      case 'select': {
        const enumName = `enum_${newTableName}_${columnPrefix || ''}${toSnakeCase(field.name)}`

        adapter.enums[enumName] = pgEnum(
          enumName,
          field.options.map((option) => {
            if (optionIsObject(option)) {
              return option.value
            }

            return option
          }) as [string, ...string[]],
        )

        if (field.type === 'select' && field.hasMany) {
          const baseColumns: Record<string, PgColumnBuilder> = {
            order: integer('order').notNull(),
            parent: parentIDColumnMap[parentIDColType]('parent_id')
              .references(() => adapter.tables[parentTableName].id, { onDelete: 'cascade' })
              .notNull(),
            value: adapter.enums[enumName]('value'),
          }

          const baseExtraConfig: Record<
            string,
            (cols: GenericColumns) => IndexBuilder | UniqueConstraintBuilder
          > = {}

          if (field.localized) {
            baseColumns.locale = adapter.enums.enum__locales('locale').notNull()
            baseExtraConfig.parentOrderLocale = (cols) =>
              unique().on(cols.parent, cols.order, cols.locale)
          } else {
            baseExtraConfig.parent = (cols) => index('parent_idx').on(cols.parent)
            baseExtraConfig.order = (cols) => index('order_idx').on(cols.order)
          }

          if (field.index) {
            baseExtraConfig.value = (cols) => index('value_idx').on(cols.value)
          }

          const selectTableName = `${newTableName}_${toSnakeCase(fieldName)}`

          buildTable({
            adapter,
            baseColumns,
            baseExtraConfig,
            disableUnique,
            fields: [],
            tableName: selectTableName,
          })

          relationsToBuild.set(fieldName, selectTableName)

          const selectTableRelations = relations(adapter.tables[selectTableName], ({ one }) => {
            const result: Record<string, Relation<string>> = {
              parent: one(adapter.tables[parentTableName], {
                fields: [adapter.tables[selectTableName].parent],
                references: [adapter.tables[parentTableName].id],
              }),
            }

            return result
          })

          adapter.relations[`relation_${selectTableName}`] = selectTableRelations
        } else {
          targetTable[fieldName] = adapter.enums[enumName](fieldName)
        }
        break
      }

      case 'checkbox': {
        targetTable[fieldName] = boolean(columnName)
        break
      }

      case 'array': {
        const baseColumns: Record<string, PgColumnBuilder> = {
          _order: integer('_order').notNull(),
          _parentID: parentIDColumnMap[parentIDColType]('_parent_id')
            .references(() => adapter.tables[parentTableName].id, { onDelete: 'cascade' })
            .notNull(),
        }

        const baseExtraConfig: Record<
          string,
          (cols: GenericColumns) => IndexBuilder | UniqueConstraintBuilder
        > = {}

        if (field.localized && adapter.payload.config.localization) {
          baseColumns._locale = adapter.enums.enum__locales('_locale').notNull()
          baseExtraConfig._parentOrderLocale = (cols) =>
            unique().on(cols._parentID, cols._order, cols._locale)
        } else {
          baseExtraConfig._parentOrder = (cols) => unique().on(cols._parentID, cols._order)
        }

        const arrayTableName = `${newTableName}_${toSnakeCase(field.name)}`

        const { relationsToBuild: subRelationsToBuild } = buildTable({
          adapter,
          baseColumns,
          baseExtraConfig,
          disableUnique,
          fields: field.fields,
          tableName: arrayTableName,
        })

        relationsToBuild.set(fieldName, arrayTableName)

        const arrayTableRelations = relations(adapter.tables[arrayTableName], ({ many, one }) => {
          const result: Record<string, Relation<string>> = {
            _parentID: one(adapter.tables[parentTableName], {
              fields: [adapter.tables[arrayTableName]._parentID],
              references: [adapter.tables[parentTableName].id],
            }),
          }

          if (hasLocalesTable(field.fields)) {
            result._locales = many(adapter.tables[`${arrayTableName}_locales`])
          }

          subRelationsToBuild.forEach((val, key) => {
            result[key] = many(adapter.tables[val])
          })

          return result
        })

        adapter.relations[`relations_${arrayTableName}`] = arrayTableRelations

        break
      }

      case 'blocks': {
        field.blocks.forEach((block) => {
          const blockTableName = `${newTableName}_${toSnakeCase(block.slug)}`
          if (!adapter.tables[blockTableName]) {
            const baseColumns: Record<string, PgColumnBuilder> = {
              _order: integer('_order').notNull(),
              _parentID: parentIDColumnMap[parentIDColType]('_parent_id')
                .references(() => adapter.tables[parentTableName].id, { onDelete: 'cascade' })
                .notNull(),
              _path: text('_path').notNull(),
            }

            const baseExtraConfig: Record<
              string,
              (cols: GenericColumns) => IndexBuilder | UniqueConstraintBuilder
            > = {}

            if (field.localized && adapter.payload.config.localization) {
              baseColumns._locale = adapter.enums.enum__locales('_locale').notNull()
              baseExtraConfig._parentPathOrderLocale = (cols) =>
                unique().on(cols._parentID, cols._path, cols._order, cols._locale)
            } else {
              baseExtraConfig._parentPathOrder = (cols) =>
                unique().on(cols._parentID, cols._path, cols._order)
            }

            const { relationsToBuild: subRelationsToBuild } = buildTable({
              adapter,
              baseColumns,
              baseExtraConfig,
              disableUnique,
              fields: block.fields,
              tableName: blockTableName,
            })

            const blockTableRelations = relations(
              adapter.tables[blockTableName],
              ({ many, one }) => {
                const result: Record<string, Relation<string>> = {
                  _parentID: one(adapter.tables[parentTableName], {
                    fields: [adapter.tables[blockTableName]._parentID],
                    references: [adapter.tables[parentTableName].id],
                  }),
                }

                if (hasLocalesTable(block.fields)) {
                  result._locales = many(adapter.tables[`${blockTableName}_locales`])
                }

                subRelationsToBuild.forEach((val, key) => {
                  result[key] = many(adapter.tables[val])
                })

                return result
              },
            )

            adapter.relations[`relations_${blockTableName}`] = blockTableRelations
          }

          relationsToBuild.set(`_blocks_${block.slug}`, blockTableName)
        })

        break
      }

      case 'tab':
      case 'group': {
        if (!('name' in field)) {
          const {
            hasLocalizedField: groupHasLocalizedField,
            hasLocalizedManyNumberField: groupHasLocalizedManyNumberField,
            hasLocalizedRelationshipField: groupHasLocalizedRelationshipField,
            hasManyNumberField: groupHasManyNumberField,
          } = traverseFields({
            adapter,
            buildRelationships,
            columnPrefix,
            columns,
            disableUnique,
            fieldPrefix,
            fields: field.fields,
            forceLocalized,
            indexes,
            localesColumns,
            localesIndexes,
            newTableName: parentTableName,
            parentTableName,
            relationsToBuild,
            relationships,
          })

          if (groupHasLocalizedField) hasLocalizedField = true
          if (groupHasLocalizedRelationshipField) hasLocalizedRelationshipField = true
          if (groupHasManyNumberField) hasManyNumberField = true
          if (groupHasLocalizedManyNumberField) hasLocalizedManyNumberField = true
          break
        }

        const {
          hasLocalizedField: groupHasLocalizedField,
          hasLocalizedManyNumberField: groupHasLocalizedManyNumberField,
          hasLocalizedRelationshipField: groupHasLocalizedRelationshipField,
          hasManyNumberField: groupHasManyNumberField,
        } = traverseFields({
          adapter,
          buildRelationships,
          columnPrefix: `${columnName}_`,
          columns,
          disableUnique,
          fieldPrefix: `${fieldName}_`,
          fields: field.fields,
          forceLocalized: field.localized,
          indexes,
          localesColumns,
          localesIndexes,
          newTableName: `${parentTableName}_${columnName}`,
          parentTableName,
          relationsToBuild,
          relationships,
        })

        if (groupHasLocalizedField) hasLocalizedField = true
        if (groupHasLocalizedRelationshipField) hasLocalizedRelationshipField = true
        if (groupHasManyNumberField) hasManyNumberField = true
        if (groupHasLocalizedManyNumberField) hasLocalizedManyNumberField = true
        break
      }

      case 'tabs': {
        const {
          hasLocalizedField: tabHasLocalizedField,
          hasLocalizedManyNumberField: tabHasLocalizedManyNumberField,
          hasLocalizedRelationshipField: tabHasLocalizedRelationshipField,
          hasManyNumberField: tabHasManyNumberField,
        } = traverseFields({
          adapter,
          buildRelationships,
          columnPrefix,
          columns,
          disableUnique,
          fieldPrefix,
          fields: field.tabs.map((tab) => ({ ...tab, type: 'tab' })),
          forceLocalized,
          indexes,
          localesColumns,
          localesIndexes,
          newTableName,
          parentTableName,
          relationsToBuild,
          relationships,
        })

        if (tabHasLocalizedField) hasLocalizedField = true
        if (tabHasLocalizedRelationshipField) hasLocalizedRelationshipField = true
        if (tabHasManyNumberField) hasManyNumberField = true
        if (tabHasLocalizedManyNumberField) hasLocalizedManyNumberField = true

        break
      }

      case 'row':
      case 'collapsible': {
        const {
          hasLocalizedField: rowHasLocalizedField,
          hasLocalizedManyNumberField: rowHasLocalizedManyNumberField,
          hasLocalizedRelationshipField: rowHasLocalizedRelationshipField,
          hasManyNumberField: rowHasManyNumberField,
        } = traverseFields({
          adapter,
          buildRelationships,
          columnPrefix,
          columns,
          disableUnique,
          fieldPrefix,
          fields: field.fields,
          forceLocalized,
          indexes,
          localesColumns,
          localesIndexes,
          newTableName: parentTableName,
          parentTableName,
          relationsToBuild,
          relationships,
        })

        if (rowHasLocalizedField) hasLocalizedField = true
        if (rowHasLocalizedRelationshipField) hasLocalizedRelationshipField = true
        if (rowHasManyNumberField) hasManyNumberField = true
        if (rowHasLocalizedManyNumberField) hasLocalizedManyNumberField = true
        break
      }

      case 'relationship':
      case 'upload':
        if (Array.isArray(field.relationTo)) {
          field.relationTo.forEach((relation) => relationships.add(relation))
        } else {
          relationships.add(field.relationTo)
        }

        if (field.localized && adapter.payload.config.localization) {
          hasLocalizedRelationshipField = true
        }
        break

      default:
        break
    }

    const condition = field.admin && field.admin.condition

    if (targetTable[fieldName] && 'required' in field && field.required && !condition) {
      targetTable[fieldName].notNull()
    }
  })

  return {
    hasLocalizedField,
    hasLocalizedManyNumberField,
    hasLocalizedRelationshipField,
    hasManyNumberField,
  }
}
