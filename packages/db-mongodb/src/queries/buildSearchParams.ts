import mongoose from 'mongoose';
import objectID from 'bson-objectid';
import { getLocalizedPaths } from 'payload/dist/database/getLocalizedPaths';
import { Field, fieldAffectsData } from 'payload/dist/fields/config/types';
import { PathToQuery, validOperators } from 'payload/dist/database/queryValidation/types';
import { Payload } from 'payload';
import { operatorMap } from './operatorMap';
import { sanitizeQueryValue } from './sanitizeQueryValue';
import { MongooseAdapter } from '..';

type SearchParam = {
  path?: string,
  value: unknown,
}

const subQueryOptions = {
  limit: 50,
  lean: true,
};

/**
 * Convert the Payload key / value / operator into a MongoDB query
 */
export async function buildSearchParam({
  fields,
  incomingPath,
  val,
  operator,
  collectionSlug,
  globalSlug,
  payload,
  locale,
}: {
  fields: Field[],
  incomingPath: string,
  val: unknown,
  operator: string
  collectionSlug?: string,
  globalSlug?: string,
  payload: Payload,
  locale?: string
}): Promise<SearchParam> {
  // Replace GraphQL nested field double underscore formatting
  let sanitizedPath = incomingPath.replace(/__/gi, '.');
  if (sanitizedPath === 'id') sanitizedPath = '_id';

  let paths: PathToQuery[] = [];

  let hasCustomID = false;

  if (sanitizedPath === '_id') {
    const customIDfield = payload.collections[collectionSlug]?.config.fields.find((field) => fieldAffectsData(field) && field.name === 'id');

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
      } as Field,
      complete: true,
      collectionSlug,
    });
  } else {
    paths = await getLocalizedPaths({
      payload,
      locale,
      collectionSlug,
      globalSlug,
      fields,
      incomingPath: sanitizedPath,
    });
  }

  const [{
    path,
    field,
  }] = paths;

  if (path) {
    const formattedValue = sanitizeQueryValue({
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
      const pathsToQuery = paths.slice(1)
        .reverse();

      const initialRelationshipQuery = {
        value: {},
      } as SearchParam;

      const relationshipQuery = await pathsToQuery.reduce(async (priorQuery, {
        path: subPath,
        collectionSlug: slug,
      }, i) => {
        const priorQueryResult = await priorQuery;

        const SubModel = (payload.db as MongooseAdapter).collections[slug];

        // On the "deepest" collection,
        // Search on the value passed through the query
        if (i === 0) {
          const subQuery = await SubModel.buildQuery({
            where: {
              [subPath]: {
                [operator]: val,
              },
            },
            payload,
            locale,
          });

          const result = await SubModel.find(subQuery, subQueryOptions);

          const $in: unknown[] = [];

          result.forEach((doc) => {
            const stringID = doc._id.toString();
            $in.push(stringID);

            if (mongoose.Types.ObjectId.isValid(stringID)) {
              $in.push(doc._id);
            }
          });

          if (pathsToQuery.length === 1) {
            return {
              path,
              value: { $in },
            };
          }

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
          return {
            path,
            value: { $in },
          };
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

      if (field.type === 'relationship' || field.type === 'upload') {
        let hasNumberIDRelation;

        const result = {
          value: {
            $or: [
              { [path]: { [operatorKey]: formattedValue } },
            ],
          },
        };

        if (typeof formattedValue === 'string') {
          if (mongoose.Types.ObjectId.isValid(formattedValue)) {
            result.value.$or.push({ [path]: { [operatorKey]: objectID(formattedValue) } });
          } else {
            (Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]).forEach((relationTo) => {
              const isRelatedToCustomNumberID = payload.collections[relationTo]?.config?.fields.find((relatedField) => {
                return fieldAffectsData(relatedField) && relatedField.name === 'id' && relatedField.type === 'number';
              });

              if (isRelatedToCustomNumberID) {
                if (isRelatedToCustomNumberID.type === 'number') hasNumberIDRelation = true;
              }
            });

            if (hasNumberIDRelation) result.value.$or.push({ [path]: { [operatorKey]: parseFloat(formattedValue) } });
          }
        }

        if (result.value.$or.length > 1) {
          return result;
        }
      }

      if (operator === 'like' && typeof formattedValue === 'string') {
        const words = formattedValue.split(' ');

        const result = {
          value: {
            $and: words.map((word) => ({
              [path]: {
                $regex: word.replace(/[\\^$*+?\\.()|[\]{}]/g, '\\$&'),
                $options: 'i',
              },
            })),
          },
        };

        return result;
      }

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
