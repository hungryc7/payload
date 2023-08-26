import { and, eq, inArray } from 'drizzle-orm';
import { PostgresAdapter } from '../types';

type Args = {
  adapter: PostgresAdapter
  locale?: string
  localeColumnName?: string
  parentColumnName?: string
  parentID: unknown
  pathColumnName?: string
  newRows: Record<string, unknown>[]
  tableName: string
}

export const deleteExistingRowsByPath = async ({
  adapter,
  locale,
  localeColumnName = '_locale',
  parentColumnName = '_parentID',
  parentID,
  pathColumnName = '_path',
  newRows,
  tableName,
}: Args): Promise<void> => {
  const localizedPathsToDelete = new Set<string>();
  const pathsToDelete = new Set<string>();
  const table = adapter.tables[tableName];

  newRows.forEach((row) => {
    const path = row[pathColumnName];
    const localeData = row[localeColumnName];
    if (typeof path === 'string') {
      if (typeof localeData === 'string') {
        localizedPathsToDelete.add(path);
      } else {
        pathsToDelete.add(path);
      }
    }
  });

  if (localizedPathsToDelete.size > 0 && locale) {
    const whereConstraints = [
      eq(table[parentColumnName], parentID),
      eq(table[localeColumnName], locale),
    ];

    if (pathColumnName) whereConstraints.push(inArray(table[pathColumnName], Array.from(localizedPathsToDelete)));

    await adapter.db.delete(table)
      .where(
        and(...whereConstraints),
      );
  }

  if (pathsToDelete.size > 0) {
    const whereConstraints = [
      eq(table[parentColumnName], parentID),
    ];

    if (pathColumnName) whereConstraints.push(inArray(table[pathColumnName], Array.from(pathsToDelete)));

    await adapter.db.delete(table)
      .where(
        and(...whereConstraints),
      ).returning();
  }
};
