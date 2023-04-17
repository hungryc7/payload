/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import deepmerge from 'deepmerge';
import { FilterQuery } from 'mongoose';
import { combineMerge } from '../utilities/combineMerge';
import { operatorMap } from './operatorMap';
import { sanitizeQueryValue } from './sanitizeQueryValue';
import { PayloadRequest, Where } from '../types';
import { Field, FieldAffectingData, TabAsField, UIField, fieldAffectsData } from '../fields/config/types';
import { CollectionPermission, FieldPermissions, GlobalPermission } from '../auth';
import flattenFields from '../utilities/flattenTopLevelFields';
import { getEntityPolicies } from '../utilities/getEntityPolicies';
import { SanitizedConfig } from '../config/types';
import QueryError from '../errors/QueryError';

const validOperators = ['like', 'contains', 'in', 'all', 'not_in', 'greater_than_equal', 'greater_than', 'less_than_equal', 'less_than', 'not_equals', 'equals', 'exists', 'near'];

const subQueryOptions = {
  limit: 50,
  lean: true,
};

type PathToQuery = {
  complete: boolean
  collectionSlug?: string
  path: string
  field: Field | TabAsField
  fields?: (FieldAffectingData | UIField | TabAsField)[]
  fieldPolicies?: {
    [field: string]: FieldPermissions
  }
}

type SearchParam = {
  path?: string,
  value: unknown,
}

type ParamParserArgs = {
  req: PayloadRequest
  collectionSlug?: string
  globalSlug?: string
  versionsFields?: Field[]
  model: any
  where: Where
  overrideAccess?: boolean
}

export class ParamParser {
  collectionSlug?: string

  globalSlug?: string

  overrideAccess: boolean

  req: PayloadRequest

  where: Where;

  model: any;

  fields: Field[]

  localizationConfig: SanitizedConfig['localization']

  policies: {
    collections?: {
      [collectionSlug: string]: CollectionPermission;
    };
    globals?: {
      [globalSlug: string]: GlobalPermission;
    };
  }

  errors: { path: string }[]

  constructor({
    req,
    collectionSlug,
    globalSlug,
    versionsFields,
    model,
    where,
    overrideAccess,
  }: ParamParserArgs) {
    this.req = req;
    this.collectionSlug = collectionSlug;
    this.globalSlug = globalSlug;
    this.parse = this.parse.bind(this);
    this.model = model;
    this.where = where;
    this.overrideAccess = overrideAccess;
    this.localizationConfig = req.payload.config.localization;
    this.policies = {
      collections: {},
      globals: {},
    };
    this.errors = [];

    // Get entity fields
    if (globalSlug) {
      const globalConfig = req.payload.globals.config.find(({ slug }) => slug === globalSlug);
      this.fields = versionsFields || globalConfig.fields;
    }

    if (collectionSlug) {
      const collectionConfig = req.payload.collections[collectionSlug].config;
      this.fields = versionsFields || collectionConfig.fields;
    }
  }

  // Entry point to the ParamParser class

  async parse(): Promise<Record<string, unknown>> {
    if (typeof this.where === 'object') {
      const query = await this.parsePathOrRelation(this.where);
      return query;
    }

    return {};
  }

  async parsePathOrRelation(object: Where): Promise<Record<string, unknown>> {
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
              const searchParam = await this.buildSearchParam({
                fields: this.fields,
                incomingPath: relationOrPath,
                val: pathOperators[operator],
                operator,
              });

              if (searchParam?.value && searchParam?.path) {
                result = {
                  ...result,
                  [searchParam.path]: searchParam.value,
                };
              } else if (typeof searchParam?.value === 'object') {
                result = deepmerge(result, searchParam.value, { arrayMerge: combineMerge });
              }
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
        if (Object.keys(result).length > 0) {
          completedConditions.push(result);
        }
      }
    }
    return completedConditions;
  }

  // Convert the Payload key / value / operator into a MongoDB query
  async buildSearchParam({
    fields,
    incomingPath,
    val,
    operator,
  }: {
    fields: Field[],
    incomingPath: string,
    val: unknown,
    operator: string
  }): Promise<SearchParam> {
    // Replace GraphQL nested field double underscore formatting
    let sanitizedPath = incomingPath.replace(/__/gi, '.');
    if (sanitizedPath === 'id') sanitizedPath = '_id';

    let paths: PathToQuery[] = [];

    let hasCustomID = false;

    if (sanitizedPath === '_id') {
      const customIDfield = this.req.payload.collections[this.collectionSlug]?.config.fields.find((field) => fieldAffectsData(field) && field.name === 'id');

      let idFieldType: 'text' | 'number' = 'text';

      if (customIDfield) {
        if (customIDfield?.type === 'text' || customIDfield?.type === 'number') {
          idFieldType = customIDfield.type;
        }

        hasCustomID = true;
      }

      paths.push({
        path: '_id',
        field: {
          name: 'id',
          type: idFieldType,
        },
        complete: true,
        collectionSlug: this.collectionSlug,
      });
    } else {
      paths = await this.getLocalizedPaths({
        collectionSlug: this.collectionSlug,
        globalSlug: this.globalSlug,
        fields,
        incomingPath: sanitizedPath,
      });
    }

    const [{ path, field }] = paths;

    if (path) {
      const formattedValue = sanitizeQueryValue({
        ctx: this,
        field,
        path,
        operator,
        val,
        hasCustomID,
      });

      // If there are multiple collections to search through,
      // Recursively build up a list of query constraints
      if (paths.length > 1) {
        // Remove top collection and reverse array
        // to work backwards from top
        const pathsToQuery = paths.slice(1).reverse();

        const initialRelationshipQuery = {
          value: {},
        } as SearchParam;

        const relationshipQuery = await pathsToQuery.reduce(async (priorQuery, { path: subPath, collectionSlug }, i) => {
          const priorQueryResult = await priorQuery;

          const SubModel = this.req.payload.collections[collectionSlug].Model;

          // On the "deepest" collection,
          // Search on the value passed through the query
          if (i === 0) {
            const subQuery = await SubModel.buildQuery({
              where: {
                [subPath]: {
                  [operator]: val,
                },
              },
              req: this.req,
              overrideAccess: this.overrideAccess,
            });

            const result = await SubModel.find(subQuery, subQueryOptions);

            const $in = result.map((doc) => doc._id.toString());

            if (pathsToQuery.length === 1) return { path, value: { $in } };

            const nextSubPath = pathsToQuery[i + 1].path;

            return {
              value: { [nextSubPath]: { $in } },
            };
          }

          const subQuery = priorQueryResult.value;
          const result = await SubModel.find(subQuery, subQueryOptions);

          const $in = result.map((doc) => doc._id.toString());

          // If it is the last recursion
          // then pass through the search param
          if (i + 1 === pathsToQuery.length) {
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

        // Some operators like 'near' need to define a full query
        // so if there is no operator key, just return the value
        if (!operatorKey) {
          return {
            path,
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

  // Build up an array of auto-localized paths to search on
  // Multiple paths may be possible if searching on properties of relationship fields

  async getLocalizedPaths({
    collectionSlug,
    globalSlug,
    fields,
    incomingPath,
  }: {
    collectionSlug?: string
    globalSlug?: string
    fields: Field[]
    incomingPath: string
  }): Promise<PathToQuery[]> {
    const pathSegments = incomingPath.split('.');

    let paths: PathToQuery[] = [
      {
        path: '',
        complete: false,
        field: undefined,
        fields: flattenFields(fields, false),
        fieldPolicies: undefined,
        collectionSlug,
      },
    ];

    if (!this.overrideAccess) {
      if (collectionSlug) {
        const collection = { ...this.req.payload.collections[collectionSlug].config };
        collection.fields = fields;

        if (!this.policies.collections[collectionSlug]) {
          const [policy, promises] = getEntityPolicies({
            req: this.req,
            entity: collection,
            operations: ['read'],
            type: 'collection',
          });

          await Promise.all(promises);
          this.policies.collections[collectionSlug] = policy;
        }

        paths[0].fieldPolicies = this.policies.collections[collectionSlug].fields;

        if (['salt', 'hash'].includes(incomingPath) && collection.auth && !collection.auth?.disableLocalStrategy) {
          this.errors.push({ path: incomingPath });
          return [];
        }
      }

      if (globalSlug) {
        if (!this.policies.globals[globalSlug]) {
          const global = { ...this.req.payload.globals.config.find(({ slug }) => slug === globalSlug) };
          global.fields = fields;

          const [policy, promises] = getEntityPolicies({
            req: this.req,
            entity: global,
            operations: ['read'],
            type: 'global',
          });

          await Promise.all(promises);
          this.policies.globals[globalSlug] = policy;
        }

        paths[0].fieldPolicies = this.policies.globals[globalSlug].fields;
      }
    }

    // Use a 'some' so that we can bail out
    // if a relationship query is found
    // or if Rich Text / JSON

    let done = false;

    for (let i = 0; i < pathSegments.length; i += 1) {
      if (done) continue;

      const segment = pathSegments[i];

      const lastIncompletePath = paths.find(({ complete }) => !complete);

      if (lastIncompletePath) {
        const { path } = lastIncompletePath;
        let currentPath = path ? `${path}.${segment}` : segment;

        const matchedField = lastIncompletePath.fields.find((field) => fieldAffectsData(field) && field.name === segment);
        lastIncompletePath.field = matchedField;

        if (currentPath === 'globalType' && this.globalSlug) {
          lastIncompletePath.path = currentPath;
          lastIncompletePath.complete = true;
          lastIncompletePath.field = {
            name: 'globalType',
            type: 'text',
          };

          done = true;
          continue;
        }

        if (matchedField) {
          if (!this.overrideAccess) {
            const fieldAccess = lastIncompletePath.fieldPolicies[matchedField.name].read.permission;

            if (!fieldAccess || ('hidden' in matchedField && matchedField.hidden)) {
              this.errors.push({ path: currentPath });
              done = true;
              continue;
            }
          }

          const nextSegment = pathSegments[i + 1];
          const nextSegmentIsLocale = this.localizationConfig && this.localizationConfig.locales.includes(nextSegment);

          if (nextSegmentIsLocale) {
            // Skip the next iteration, because it's a locale
            i += 1;
            currentPath = `${currentPath}.${nextSegment}`;
          } else if ('localized' in matchedField && matchedField.localized) {
            currentPath = `${currentPath}.${this.req.locale}`;
          }

          switch (matchedField.type) {
            case 'blocks':
            case 'richText':
            case 'json': {
              const upcomingSegments = pathSegments.slice(i + 1).join('.');
              lastIncompletePath.complete = true;
              lastIncompletePath.path = upcomingSegments ? `${currentPath}.${upcomingSegments}` : currentPath;
              done = true;
              continue;
            }

            case 'relationship':
            case 'upload': {
              // If this is a polymorphic relation,
              // We only support querying directly (no nested querying)
              if (typeof matchedField.relationTo !== 'string') {
                const lastSegmentIsValid = ['value', 'relationTo'].includes(pathSegments[pathSegments.length - 1]);

                if (lastSegmentIsValid) {
                  lastIncompletePath.complete = true;
                  lastIncompletePath.path = pathSegments.join('.');
                } else {
                  this.errors.push({ path: currentPath });
                  done = true;
                  continue;
                }
              } else {
                lastIncompletePath.complete = true;
                lastIncompletePath.collectionSlug = matchedField.relationTo;
                lastIncompletePath.path = currentPath;

                const nestedPathToQuery = pathSegments.slice(nextSegmentIsLocale ? i + 2 : i + 1).join('.');

                if (nestedPathToQuery) {
                  const relatedCollection = this.req.payload.collections[matchedField.relationTo as string].config;

                  const remainingPaths = await this.getLocalizedPaths({
                    collectionSlug: relatedCollection.slug,
                    fields: relatedCollection.fields,
                    incomingPath: nestedPathToQuery,
                  });

                  paths = [
                    ...paths,
                    ...remainingPaths,
                  ];
                }

                done = true;
                continue;
              }

              break;
            }

            default: {
              if ('fields' in lastIncompletePath.field) {
                lastIncompletePath.fields = flattenFields(lastIncompletePath.field.fields, false);
              }

              if (!this.overrideAccess && 'fields' in lastIncompletePath.fieldPolicies[lastIncompletePath.field.name]) {
                lastIncompletePath.fieldPolicies = lastIncompletePath.fieldPolicies[lastIncompletePath.field.name].fields;
              }

              if (i + 1 === pathSegments.length) lastIncompletePath.complete = true;
              lastIncompletePath.path = currentPath;
              continue;
            }
          }
        } else {
          this.errors.push({ path: currentPath });
          done = true;
          continue;
        }
      }
    }

    return paths;
  }
}

type GetBuildQueryPluginArgs = {
  collectionSlug?: string
  versionsFields?: Field[]
}

export type BuildQueryArgs = {
  req: PayloadRequest
  where: Where
  overrideAccess: boolean
  globalSlug?: string
}

// This plugin asynchronously builds a list of Mongoose query constraints
// which can then be used in subsequent Mongoose queries.
const getBuildQueryPlugin = ({
  collectionSlug,
  versionsFields,
}: GetBuildQueryPluginArgs = {}) => {
  return function buildQueryPlugin(schema) {
    const modifiedSchema = schema;
    async function buildQuery({ req, where, overrideAccess = false, globalSlug }: BuildQueryArgs): Promise<Record<string, unknown>> {
      const paramParser = new ParamParser({
        req,
        collectionSlug,
        globalSlug,
        versionsFields,
        model: this,
        where,
        overrideAccess,
      });
      const result = await paramParser.parse();

      if (this.errors.length > 0) {
        throw new QueryError(this.errors);
      }

      return result;
    }
    modifiedSchema.statics.buildQuery = buildQuery;
  };
};

export default getBuildQueryPlugin;
