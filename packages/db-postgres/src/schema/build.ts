/* eslint-disable no-param-reassign */
import {
  AnyPgColumnBuilder,
  integer,
  pgTable,
  serial,
  varchar,
  index,
  numeric,
  timestamp,
  IndexBuilder,
  unique,
  UniqueConstraintBuilder,
} from 'drizzle-orm/pg-core';
import { Field } from 'payload/types';
import toSnakeCase from 'to-snake-case';
import { Relation, relations } from 'drizzle-orm';
import { fieldAffectsData } from 'payload/dist/fields/config/types';
import { GenericColumns, GenericTable, PostgresAdapter } from '../types';
import { traverseFields } from './traverseFields';
import { parentIDColumnMap } from './parentIDColumnMap';

type Args = {
  adapter: PostgresAdapter
  baseColumns?: Record<string, AnyPgColumnBuilder>,
  baseExtraConfig?: Record<string, (cols: GenericColumns) => IndexBuilder | UniqueConstraintBuilder>
  buildRelationships?: boolean
  fields: Field[]
  tableName: string
  timestamps?: boolean
}

type Result = {
  arrayBlockRelations: Map<string, string>
}

export const buildTable = ({
  adapter,
  baseColumns = {},
  baseExtraConfig = {},
  buildRelationships,
  fields,
  tableName,
  timestamps,
}: Args): Result => {
  const formattedTableName = toSnakeCase(tableName);
  const columns: Record<string, AnyPgColumnBuilder> = baseColumns;
  const indexes: Record<string, (cols: GenericColumns) => IndexBuilder> = {};

  let hasLocalizedField = false;
  let hasLocalizedRelationshipField = false;
  const localesColumns: Record<string, AnyPgColumnBuilder> = {};
  const localesIndexes: Record<string, (cols: GenericColumns) => IndexBuilder> = {};
  let localesTable: GenericTable;

  const relationships: Set<string> = new Set();
  let relationshipsTable: GenericTable;

  const arrayBlockRelations: Map<string, string> = new Map();

  const idField = fields.find((field) => fieldAffectsData(field) && field.name === 'id');
  let idColType = 'integer';

  if (idField) {
    if (idField.type === 'number') {
      idColType = 'numeric';
      columns.id = numeric('id').primaryKey();
    }

    if (idField.type === 'text') {
      idColType = 'varchar';
      columns.id = varchar('id').primaryKey();
    }
  } else {
    columns.id = serial('id').primaryKey();
  }

  ({ hasLocalizedField, hasLocalizedRelationshipField } = traverseFields({
    adapter,
    arrayBlockRelations,
    buildRelationships,
    columns,
    fields,
    indexes,
    localesColumns,
    localesIndexes,
    newTableName: formattedTableName,
    parentTableName: formattedTableName,
    relationships,
  }));

  if (timestamps) {
    columns.createdAt = timestamp('created_at').defaultNow().notNull();
    columns.updatedAt = timestamp('updated_at').defaultNow().notNull();
  }

  const table = pgTable(formattedTableName, columns, (cols) => {
    const extraConfig = Object.entries(baseExtraConfig).reduce((config, [key, func]) => {
      config[key] = func(cols);
      return config;
    }, {});

    return Object.entries(indexes).reduce((acc, [colName, func]) => {
      acc[colName] = func(cols);
      return acc;
    }, extraConfig);
  });

  adapter.tables[formattedTableName] = table;

  if (hasLocalizedField) {
    const localeTableName = `${formattedTableName}_locales`;
    localesColumns.id = serial('id').primaryKey();
    localesColumns._locale = adapter.enums._locales('_locale').notNull();
    localesColumns._parentID = parentIDColumnMap[idColType]('_parent_id').references(() => table.id, { onDelete: 'cascade' }).notNull();

    localesTable = pgTable(localeTableName, localesColumns, (cols) => {
      return Object.entries(localesIndexes).reduce((acc, [colName, func]) => {
        acc[colName] = func(cols);
        return acc;
      }, {
        _localeParent: unique().on(cols._locale, cols._parentID),
      });
    });

    adapter.tables[localeTableName] = localesTable;

    const localesTableRelations = relations(localesTable, ({ one }) => ({
      _parentID: one(table, {
        fields: [localesTable._parentID],
        references: [table.id],
      }),
    }));

    adapter.relations[`relations_${localeTableName}`] = localesTableRelations;
  }

  if (buildRelationships) {
    if (relationships.size) {
      const relationshipColumns: Record<string, AnyPgColumnBuilder> = {
        id: serial('id').primaryKey(),
        parent: parentIDColumnMap[idColType]('parent_id').references(() => table.id, { onDelete: 'cascade' }).notNull(),
        path: varchar('path').notNull(),
        order: integer('order'),
      };

      if (hasLocalizedRelationshipField) {
        relationshipColumns.locale = adapter.enums._locale('locale');
      }

      relationships.forEach((relationTo) => {
        const formattedRelationTo = toSnakeCase(relationTo);
        let colType = 'integer';
        const relatedCollectionCustomID = adapter.payload.collections[relationTo].config.fields.find((field) => fieldAffectsData(field) && field.name === 'id');
        if (relatedCollectionCustomID?.type === 'number') colType = 'numeric';
        if (relatedCollectionCustomID?.type === 'text') colType = 'varchar';

        relationshipColumns[`${relationTo}ID`] = parentIDColumnMap[colType](`${formattedRelationTo}_id`).references(() => adapter.tables[formattedRelationTo].id);
      });

      const relationshipsTableName = `${formattedTableName}_relationships`;

      relationshipsTable = pgTable(relationshipsTableName, relationshipColumns, (cols) => {
        const result: Record<string, unknown> = {};

        if (hasLocalizedRelationshipField) {
          result.localeIdx = index('locale_idx').on(cols.locale);
          result.parentPathOrderLocale = unique().on(cols.parent, cols.path, cols.order, cols.locale);
        } else {
          result.parentPathOrder = unique().on(cols.parent, cols.path, cols.order);
        }

        return result;
      });

      adapter.tables[relationshipsTableName] = relationshipsTable;

      const relationshipsTableRelations = relations(relationshipsTable, ({ one }) => {
        const result: Record<string, Relation<string>> = {
          parent: one(table, {
            relationName: '_relationships',
            fields: [relationshipsTable.parent],
            references: [table.id],
          }),
        };

        relationships.forEach((relationTo) => {
          const relatedTableName = toSnakeCase(relationTo);
          const idColumnName = `${relationTo}ID`;
          result[idColumnName] = one(adapter.tables[relatedTableName], {
            fields: [relationshipsTable[idColumnName]],
            references: [adapter.tables[relatedTableName].id],
          });
        });

        return result;
      });

      adapter.relations[`relations_${relationshipsTableName}`] = relationshipsTableRelations;
    }
  }

  const tableRelations = relations(table, ({ many }) => {
    const result: Record<string, Relation<string>> = {};

    arrayBlockRelations.forEach((val, key) => {
      result[key] = many(adapter.tables[val]);
    });

    if (hasLocalizedField) {
      result._locales = many(localesTable);
    }

    if (relationships.size && relationshipsTable) {
      result._relationships = many(relationshipsTable, {
        relationName: '_relationships',
      });
    }

    return result;
  });

  adapter.relations[`relations_${formattedTableName}`] = tableRelations;

  return { arrayBlockRelations };
};
