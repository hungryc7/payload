/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { Operator, Where } from 'payload/types';
import { Field } from 'payload/dist/fields/config/types';
import { validOperators } from 'payload/dist/types/constants';
import { and, SQL } from 'drizzle-orm';
import { buildSearchParam } from './buildSearchParams';
import { buildAndOrConditions } from './buildAndOrConditions';
import { PostgresAdapter } from '../types';
import { operatorMap } from './operatorMap';
import { BuildQueryJoins } from './buildQuery';

type Args = {
  joins: BuildQueryJoins
  where: Where
  collectionSlug?: string
  globalSlug?: string
  adapter: PostgresAdapter
  locale: string
  fields: Field[]
  columnPrefix: string
}
export async function parseParams({
  joins,
  where,
  collectionSlug,
  globalSlug,
  adapter,
  locale,
  fields,
  columnPrefix,
}: Args): Promise<SQL> {
  let result: SQL;

  if (typeof where === 'object') {
    // We need to determine if the whereKey is an AND, OR, or a schema path
    for (const relationOrPath of Object.keys(where)) {
      const condition = where[relationOrPath];
      let conditionOperator: 'and' | 'or';
      if (relationOrPath.toLowerCase() === 'and') {
        conditionOperator = 'and';
      } else if (relationOrPath.toLowerCase() === 'or') {
        conditionOperator = 'or';
      }
      if (Array.isArray(condition)) {
        const builtConditions = await buildAndOrConditions({
          joins,
          collectionSlug,
          fields,
          globalSlug,
          adapter,
          locale,
          where: condition,
        });
        if (builtConditions.length > 0) result = operatorMap[conditionOperator](result, ...builtConditions);
      } else {
        // It's a path - and there can be multiple comparisons on a single path.
        // For example - title like 'test' and title not equal to 'tester'
        // So we need to loop on keys again here to handle each operator independently
        const pathOperators = where[relationOrPath];
        if (typeof pathOperators === 'object') {
          for (const operator of Object.keys(pathOperators)) {
            if (validOperators.includes(operator as Operator)) {
              result = and(await buildSearchParam({
                joins,
                collectionSlug,
                globalSlug,
                adapter,
                locale,
                fields,
                incomingPath: relationOrPath,
                val: pathOperators[operator],
                operator,
              }));
            }
          }
        }
      }
    }
  }

  return result;
}
