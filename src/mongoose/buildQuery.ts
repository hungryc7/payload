/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import deepmerge from 'deepmerge';
import mongoose, { FilterQuery } from 'mongoose';
import { combineMerge } from '../utilities/combineMerge';
import { CollectionModel } from '../collections/config/types';
import { getSchemaTypeOptions } from './getSchemaTypeOptions';
import { operatorMap } from './operatorMap';
import { sanitizeQueryValue } from './sanitizeFormattedValue';

const validOperators = ['like', 'in', 'all', 'not_in', 'greater_than_equal', 'greater_than', 'less_than_equal', 'less_than', 'not_equals', 'equals', 'exists', 'near'];

const subQueryOptions = {
  limit: 50,
  lean: true,
};

type ParseType = {
  searchParams?:
  {
    [key: string]: any;
  };
  sort?: boolean;
};

type PathToQuery = {
  complete: boolean
  path: string
  Model: CollectionModel
}

type SearchParam = {
  path?: string,
  value: unknown,
}

class ParamParser {
  locale: string;

  rawParams: any;

  model: any;

  query: {
    searchParams: {
      [key: string]: any;
    };
    sort: boolean;
  };

  constructor(model, rawParams, locale: string) {
    this.parse = this.parse.bind(this);
    this.model = model;
    this.rawParams = rawParams;
    this.locale = locale;
    this.query = {
      searchParams: {},
      sort: false,
    };
  }

  // Entry point to the ParamParser class

  async parse(): Promise<ParseType> {
    if (typeof this.rawParams === 'object') {
      for (const key of Object.keys(this.rawParams)) {
        if (key === 'where') {
          this.query.searchParams = await this.parsePathOrRelation(this.rawParams.where);
        } else if (key === 'sort') {
          this.query.sort = this.rawParams[key];
        }
      }
      return this.query;
    }
    return {};
  }

  async parsePathOrRelation(object) {
    let result = {} as FilterQuery<any>;
    // We need to determine if the whereKey is an AND, OR, or a schema path
    for (const relationOrPath of Object.keys(object)) {
      if (relationOrPath.toLowerCase() === 'and') {
        const andConditions = object[relationOrPath];
        const builtAndConditions = await this.buildAndOrConditions(andConditions);
        if (builtAndConditions.length > 0) result.$and = builtAndConditions;
      } else if (relationOrPath.toLowerCase() === 'or' && Array.isArray(object[relationOrPath])) {
        const orConditions = object[relationOrPath];
        const builtOrConditions = await this.buildAndOrConditions(orConditions);
        if (builtOrConditions.length > 0) result.$or = builtOrConditions;
      } else {
        // It's a path - and there can be multiple comparisons on a single path.
        // For example - title like 'test' and title not equal to 'tester'
        // So we need to loop on keys again here to handle each operator independently
        const pathOperators = object[relationOrPath];
        if (typeof pathOperators === 'object') {
          for (const operator of Object.keys(pathOperators)) {
            if (validOperators.includes(operator)) {
              const searchParam = await this.buildSearchParam(this.model.schema, relationOrPath, pathOperators[operator], operator);

              if ('path' in searchParam) {
                result = {
                  ...result,
                  [searchParam.path]: searchParam.value,
                };
              } else if (typeof searchParam.value === 'object') {
                result = deepmerge(result, searchParam.value, { arrayMerge: combineMerge });
              }

              return result;
            }
          }
        }
      }
    }
    return result;
  }

  async buildAndOrConditions(conditions) {
    const completedConditions = [];
    // Loop over all AND / OR operations and add them to the AND / OR query param
    // Operations should come through as an array
    for (const condition of conditions) {
      // If the operation is properly formatted as an object
      if (typeof condition === 'object') {
        const result = await this.parsePathOrRelation(condition);
        completedConditions.push(result);
      }
    }
    return completedConditions;
  }

  // Build up an array of auto-localized paths to search on
  // Multiple paths may be possible if searching on properties of relationship fields

  getLocalizedPaths(Model: CollectionModel, incomingPath: string, operator): PathToQuery[] {
    const { schema } = Model;
    const pathSegments = incomingPath.split('.');

    let paths: PathToQuery[] = [
      {
        path: '',
        complete: false,
        Model,
      },
    ];

    pathSegments.forEach((segment, i) => {
      const lastIncompletePath = paths.find(({ complete }) => !complete);
      const { path } = lastIncompletePath;

      const currentPath = path ? `${path}.${segment}` : segment;
      const currentSchemaType = schema.path(currentPath);

      if (currentSchemaType) {
        const currentSchemaTypeOptions = getSchemaTypeOptions(currentSchemaType);

        if (currentSchemaTypeOptions.localized) {
          const upcomingSegment = pathSegments[i + 1];
          const upcomingPath = `${currentPath}.${upcomingSegment}`;
          const upcomingSchemaType = schema.path(upcomingPath);

          if (upcomingSchemaType) {
            lastIncompletePath.path = currentPath;
            return;
          }

          const localePath = `${currentPath}.${this.locale}`;
          const localizedSchemaType = schema.path(localePath);

          if (localizedSchemaType || operator === 'near') {
            lastIncompletePath.path = localePath;
            return;
          }
        }

        lastIncompletePath.path = currentPath;
        return;
      }

      const priorSchemaType = schema.path(path);

      if (priorSchemaType) {
        const priorSchemaTypeOptions = getSchemaTypeOptions(priorSchemaType);
        if (typeof priorSchemaTypeOptions.ref === 'string') {
          const RefModel = mongoose.model(priorSchemaTypeOptions.ref) as any;

          lastIncompletePath.complete = true;

          const remainingPath = pathSegments.slice(i).join('.');

          paths = [
            ...paths,
            ...this.getLocalizedPaths(RefModel, remainingPath, operator),
          ];
          return;
        }
      }

      if (operator === 'near') {
        lastIncompletePath.path = currentPath;
      }
    });

    return paths;
  }

  // Convert the Payload key / value / operator into a MongoDB query
  async buildSearchParam(schema, incomingPath, val, operator): Promise<SearchParam> {
    // Replace GraphQL nested field double underscore formatting
    let sanitizedPath = incomingPath.replace(/__/gi, '.');
    if (sanitizedPath === 'id') sanitizedPath = '_id';

    const collectionPaths = this.getLocalizedPaths(this.model, sanitizedPath, operator);
    const [{ path }] = collectionPaths;

    if (path) {
      const schemaType = schema.path(path);
      const schemaOptions = getSchemaTypeOptions(schemaType);
      const formattedValue = sanitizeQueryValue(schemaType, path, operator, val);

      // If there are multiple collections to search through,
      // Recursively build up a list of query constraints
      if (collectionPaths.length > 1) {
        // Remove top collection and reverse array
        // to work backwards from top
        const collectionPathsToSearch = collectionPaths.slice(1).reverse();

        const initialRelationshipQuery = {
          value: {},
        } as SearchParam;

        const relationshipQuery = await collectionPathsToSearch.reduce(async (priorQuery, { Model: SubModel, path: subPath }, i) => {
          const priorQueryResult = await priorQuery;

          // On the "deepest" collection,
          // Search on the value passed through the query
          if (i === 0) {
            const subQuery = await SubModel.buildQuery({
              where: {
                [subPath]: {
                  [operator]: val,
                },
              },
            }, this.locale);

            const result = await SubModel.find(subQuery, subQueryOptions);

            const $in = result.map((doc) => doc._id.toString());

            if (collectionPathsToSearch.length === 1) return { path, value: { $in } };

            return {
              value: { _id: { $in } },
            };
          }

          const subQuery = priorQueryResult.value;
          const result = await SubModel.find(subQuery, subQueryOptions);

          const $in = result.map((doc) => doc._id.toString());

          // If it is the last recursion
          // then pass through the search param
          if (i + 1 === collectionPathsToSearch.length) {
            return { path, value: { $in } };
          }

          return {
            value: {
              _id: { $in },
            },
          };
        }, Promise.resolve(initialRelationshipQuery));

        return relationshipQuery;
      }

      if (operator && validOperators.includes(operator)) {
        const operatorKey = operatorMap[operator];

        let overrideQuery = false;
        let query;


        // If there is a ref, this is a relationship or upload field
        // IDs can be either string, number, or ObjectID
        // So we need to build an `or` query for all these types
        if (schemaOptions && (schemaOptions.ref || schemaOptions.refPath)) {
          overrideQuery = true;

          query = {
            $or: [
              {
                [path]: {
                  [operatorKey]: formattedValue,
                },
              },
            ],
          };

          if (typeof formattedValue.toString === 'function') {
            query.$or.push({
              [path]: {
                [operatorKey]: formattedValue.toString(),
              },
            });
          }

          if (typeof formattedValue === 'string') {
            query.$or.push({
              [path]: {
                [operatorKey]: formattedValue,
              },
            });

            const parsedNumber = parseFloat(formattedValue);

            if (!Number.isNaN(parsedNumber)) {
              query.$or.push({
                [path]: {
                  [operatorKey]: parsedNumber,
                },
              });
            }
          }
        }

        // If forced query
        if (overrideQuery) {
          return {
            value: query,
          };
        }

        // Some operators like 'near' need to define a full query
        // so if there is no operator key, just return the value
        if (!operatorKey) {
          return {
            value: formattedValue,
          };
        }

        return {
          path,
          value: { [operatorKey]: formattedValue },
        };
      }
    }
    return undefined;
  }
}
// This plugin asynchronously builds a list of Mongoose query constraints
// which can then be used in subsequent Mongoose queries.
function buildQueryPlugin(schema) {
  const modifiedSchema = schema;
  async function buildQuery(rawParams, locale) {
    const paramParser = new ParamParser(this, rawParams, locale);
    const params = await paramParser.parse();
    return params.searchParams;
  }
  modifiedSchema.statics.buildQuery = buildQuery;
}
export default buildQueryPlugin;
