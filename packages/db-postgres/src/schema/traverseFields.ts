/* eslint-disable no-param-reassign */
import { AnyPgColumnBuilder, integer, pgEnum, pgTable, serial, uniqueIndex, text, varchar, PgColumn, PgTableExtraConfig, index, numeric, PgColumnHKT, IndexBuilder, PgNumericBuilder, PgVarcharBuilder } from 'drizzle-orm/pg-core';
import { Field } from 'payload/types';
import toSnakeCase from 'to-snake-case';
import { fieldAffectsData } from 'payload/dist/fields/config/types';
import { Relation, relations } from 'drizzle-orm';
import { GenericColumns, PostgresAdapter } from '../types';
import { createIndex } from './createIndex';
import { buildTable } from './build';
import { parentIDColumnMap } from './parentIDColumnMap';

type Args = {
  adapter: PostgresAdapter
  arrayBlockRelations: Map<string, string>
  buildRelationships: boolean
  columns: Record<string, AnyPgColumnBuilder>
  columnPrefix?: string
  fieldPrefix?: string
  fields: Field[]
  indexes: Record<string, (cols: GenericColumns) => IndexBuilder>
  localesColumns: Record<string, AnyPgColumnBuilder>
  localesIndexes: Record<string, (cols: GenericColumns) => IndexBuilder>
  newTableName: string
  parentTableName: string
  relationships: Set<string>
}

type Result = {
  hasLocalizedField: boolean
  hasLocalizedRelationshipField: boolean
}

export const traverseFields = ({
  adapter,
  arrayBlockRelations,
  buildRelationships,
  columnPrefix,
  columns,
  fieldPrefix,
  fields,
  indexes,
  localesColumns,
  localesIndexes,
  newTableName,
  parentTableName,
  relationships,
}: Args): Result => {
  let hasLocalizedField = false;
  let hasLocalizedRelationshipField = false;

  let parentIDColType = 'integer';
  if (columns.id instanceof PgNumericBuilder) parentIDColType = 'numeric';
  if (columns.id instanceof PgVarcharBuilder) parentIDColType = 'varchar';

  fields.forEach((field) => {
    if ('name' in field && field.name === 'id') return;
    let columnName: string;

    let targetTable = columns;
    let targetIndexes = indexes;

    if (fieldAffectsData(field)) {
      columnName = `${columnPrefix || ''}${toSnakeCase(field.name)}`;

      // If field is localized,
      // add the column to the locale table instead of main table
      if (field.localized) {
        hasLocalizedField = true;
        targetTable = localesColumns;
        targetIndexes = localesIndexes;
      }

      if (field.unique || field.index) {
        targetIndexes[`${field.name}Idx`] = createIndex({ columnName, name: field.name, unique: field.unique });
      }
    }

    switch (field.type) {
      case 'text':
      case 'email':
      case 'code':
      case 'textarea': {
        // TODO: handle hasMany
        // TODO: handle min / max length
        targetTable[`${fieldPrefix || ''}${field.name}`] = varchar(columnName);
        break;
      }

      case 'number': {
        // TODO: handle hasMany
        // TODO: handle min / max
        targetTable[`${fieldPrefix || ''}${field.name}`] = numeric(columnName);
        break;
      }

      case 'richText':
      case 'json': {
        break;
      }

      case 'date': {
        break;
      }

      case 'point': {
        break;
      }

      case 'radio': {
        break;
      }

      case 'select': {
        break;
      }

      case 'array': {
        const baseColumns: Record<string, AnyPgColumnBuilder> = {
          _order: integer('_order').notNull(),
          _parentID: parentIDColumnMap[parentIDColType]('_parent_id').references(() => adapter.tables[parentTableName].id).notNull(),
        };

        if (field.localized && adapter.payload.config.localization) {
          baseColumns._locale = adapter.enums._locales('_locale').notNull();
        }

        const arrayTableName = `${newTableName}_${toSnakeCase(field.name)}`;

        const { arrayBlockRelations: subArrayBlockRelations } = buildTable({
          adapter,
          baseColumns,
          fields: field.fields,
          tableName: arrayTableName,
        });

        arrayBlockRelations.set(`${fieldPrefix || ''}${field.name}`, arrayTableName);

        const arrayTableRelations = relations(adapter.tables[arrayTableName], ({ many, one }) => {
          const result: Record<string, Relation<string>> = {
            _parentID: one(adapter.tables[parentTableName], {
              fields: [adapter.tables[arrayTableName]._parentID],
              references: [adapter.tables[parentTableName].id],
            }),
          };

          if (field.localized) {
            result._locales = many(adapter.tables[`${arrayTableName}_locales`]);
          }

          subArrayBlockRelations.forEach((val, key) => {
            result[key] = many(adapter.tables[val]);
          });

          return result;
        });

        adapter.relations[arrayTableName] = arrayTableRelations;

        break;
      }

      case 'blocks': {
        field.blocks.forEach((block) => {
          const baseColumns: Record<string, AnyPgColumnBuilder> = {
            _order: integer('_order').notNull(),
            _path: text('_path').notNull(),
            _parentID: parentIDColumnMap[parentIDColType]('_parent_id').references(() => adapter.tables[parentTableName].id).notNull(),
          };

          if (field.localized && adapter.payload.config.localization) {
            baseColumns._locale = adapter.enums._locales('_locale').notNull();
          }

          const blockTableName = `${newTableName}_${toSnakeCase(block.slug)}`;

          if (!adapter.tables[blockTableName]) {
            const { arrayBlockRelations: subArrayBlockRelations } = buildTable({
              adapter,
              baseColumns,
              fields: block.fields,
              tableName: blockTableName,
            });

            const blockTableRelations = relations(adapter.tables[blockTableName], ({ many, one }) => {
              const result: Record<string, Relation<string>> = {
                _parentID: one(adapter.tables[parentTableName], {
                  fields: [adapter.tables[blockTableName]._parentID],
                  references: [adapter.tables[parentTableName].id],
                }),
              };

              if (field.localized) {
                result._locales = many(adapter.tables[`${blockTableName}_locales`]);
              }

              subArrayBlockRelations.forEach((val, key) => {
                result[key] = many(adapter.tables[val]);
              });

              return result;
            });

            adapter.relations[blockTableName] = blockTableRelations;
          }

          arrayBlockRelations.set(`_${fieldPrefix || ''}${field.name}`, blockTableName);
        });

        break;
      }

      case 'group': {
        // Todo: determine what should happen if groups are set to localized
        const {
          hasLocalizedField: groupHasLocalizedField,
          hasLocalizedRelationshipField: groupHasLocalizedRelationshipField,
        } = traverseFields({
          adapter,
          arrayBlockRelations,
          buildRelationships,
          columnPrefix: `${columnName}_`,
          columns,
          fieldPrefix: `${fieldPrefix || ''}${field.name}_`,
          fields: field.fields,
          indexes,
          localesColumns,
          localesIndexes,
          newTableName: `${parentTableName}_${toSnakeCase(field.name)}`,
          parentTableName,
          relationships,
        });

        if (groupHasLocalizedField) hasLocalizedField = true;
        if (groupHasLocalizedRelationshipField) hasLocalizedRelationshipField = true;
        break;
      }

      case 'tabs': {
        field.tabs.forEach((tab) => {
          if ('name' in tab) {
            const {
              hasLocalizedField: tabHasLocalizedField,
              hasLocalizedRelationshipField: tabHasLocalizedRelationshipField,
            } = traverseFields({
              adapter,
              arrayBlockRelations,
              buildRelationships,
              columnPrefix: `${columnName}_`,
              columns,
              fieldPrefix: `${fieldPrefix || ''}${tab.name}_`,
              fields: tab.fields,
              indexes,
              localesColumns,
              localesIndexes,
              newTableName: `${parentTableName}_${toSnakeCase(tab.name)}`,
              parentTableName,
              relationships,
            });

            if (tabHasLocalizedField) hasLocalizedField = true;
            if (tabHasLocalizedRelationshipField) hasLocalizedRelationshipField = true;
          } else {
            ({
              hasLocalizedField,
              hasLocalizedRelationshipField,
            } = traverseFields({
              adapter,
              arrayBlockRelations,
              buildRelationships,
              columns,
              fields: tab.fields,
              indexes,
              localesColumns,
              localesIndexes,
              newTableName: parentTableName,
              parentTableName,
              relationships,
            }));
          }
        });
        break;
      }

      case 'row':
      case 'collapsible': {
        ({
          hasLocalizedField,
          hasLocalizedRelationshipField,
        } = traverseFields({
          adapter,
          arrayBlockRelations,
          buildRelationships,
          columns,
          fields: field.fields,
          indexes,
          localesColumns,
          localesIndexes,
          newTableName: parentTableName,
          parentTableName,
          relationships,
        }));
        break;
      }

      case 'relationship':
      case 'upload':
        if (Array.isArray(field.relationTo)) {
          field.relationTo.forEach((relation) => relationships.add(relation));
        } else {
          relationships.add(field.relationTo);
        }

        if (field.localized) {
          hasLocalizedRelationshipField = true;
        }
        break;

      default:
        break;
    }
  });

  return { hasLocalizedField, hasLocalizedRelationshipField };
};
