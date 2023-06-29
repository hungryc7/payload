import type { MongooseAdapter } from '.';
import type { QueryDrafts } from '../database/types';
import flattenWhereToOperators from '../database/flattenWhereToOperators';
import sanitizeInternalFields from '../utilities/sanitizeInternalFields';
import { buildSortParam } from './queries/buildSortParam';

type AggregateVersion<T> = {
  _id: string
  version: T
  updatedAt: string
  createdAt: string
}

export const queryDrafts: QueryDrafts = async function queryDrafts<T>(this: MongooseAdapter,
  { collection, where, page, limit, sort: sortArg, locale, pagination }) {
  const VersionModel = this.versions[collection];
  const collectionConfig = this.payload.collections[collection].config;

  const versionQuery = await VersionModel.buildQuery({
    where,
    locale,
    payload: this.payload,
  });

  let hasNearConstraint = false;

  if (where) {
    const constraints = flattenWhereToOperators(where);
    hasNearConstraint = constraints.some((prop) => Object.keys(prop).some((key) => key === 'near'));
  }

  let sort;
  if (!hasNearConstraint) {
    sort = buildSortParam({
      sort: sortArg || collectionConfig.defaultSort,
      fields: collectionConfig.fields,
      timestamps: true,
      config: this.payload.config,
      locale,
    });
  }

  const aggregate = VersionModel.aggregate<AggregateVersion<T>>([
    // Sort so that newest are first
    { $sort: { updatedAt: -1 } },
    // Group by parent ID, and take the first of each
    {
      $group: {
        _id: '$parent',
        version: { $first: '$version' },
        updatedAt: { $first: '$updatedAt' },
        createdAt: { $first: '$createdAt' },
      },
    },
    // Filter based on incoming query
    { $match: versionQuery },
  ], {
    allowDiskUse: true,
  });

  let result;

  if (pagination) {
    let useEstimatedCount;

    if (where) {
      const constraints = flattenWhereToOperators(where);
      useEstimatedCount = constraints.some((prop) => Object.keys(prop).some((key) => key === 'near'));
    }


    const aggregatePaginateOptions = {
      page,
      limit,
      lean: true,
      leanWithId: true,
      useEstimatedCount,
      pagination,
      useCustomCountFn: pagination ? undefined : () => Promise.resolve(1),
      useFacet: this.connectOptions.useFacet,
      options: {
        limit,
      },
      sort,
    };

    result = await VersionModel.aggregatePaginate(aggregate, aggregatePaginateOptions);
  } else {
    result = aggregate.exec();
  }

  const docs = JSON.parse(JSON.stringify(result.docs));

  return {
    ...result,
    docs: docs.map((doc) => {
      // eslint-disable-next-line no-param-reassign
      doc = {
        _id: doc._id,
        id: doc._id,
        ...doc.version,
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt,
      };

      return sanitizeInternalFields(doc);
    }),
  };
};
