import { PaginateOptions } from 'mongoose';
import type { MongooseAdapter } from '.';
import type { FindGlobalVersions } from '../database/types';
import sanitizeInternalFields from '../utilities/sanitizeInternalFields';
import flattenWhereToOperators from '../database/flattenWhereToOperators';
import { buildSortParam } from './queries/buildSortParam';
import { buildVersionGlobalFields } from '../versions/buildGlobalFields';

export const findGlobalVersions: FindGlobalVersions = async function findGlobalVersions(this: MongooseAdapter,
  { global, where, page, limit, sort: sortArg, locale, pagination, skip }) {
  const Model = this.versions[global];
  const versionFields = buildVersionGlobalFields(this.payload.globals.config.find(({ slug }) => slug === global));

  let hasNearConstraint = false;

  if (where) {
    const constraints = flattenWhereToOperators(where);
    hasNearConstraint = constraints.some((prop) => Object.keys(prop).some((key) => key === 'near'));
  }

  let sort;
  if (!hasNearConstraint) {
    sort = buildSortParam({
      sort: sortArg || '-updatedAt',
      fields: versionFields,
      timestamps: true,
      config: this.payload.config,
      locale,
    });
  }

  const query = await Model.buildQuery({
    payload: this.payload,
    locale,
    where,
    globalSlug: global,
  });

  const paginationOptions: PaginateOptions = {
    page,
    sort,
    lean: true,
    leanWithId: true,
    pagination,
    offset: skip,
    useEstimatedCount: hasNearConstraint,
    forceCountFn: hasNearConstraint,
    options: {
      skip,
    },
  };
  if (limit > 0) {
    paginationOptions.limit = limit;
    // limit must also be set here, it's ignored when pagination is false
    paginationOptions.options.limit = limit;
  }

  const result = await Model.paginate(query, paginationOptions);
  const docs = JSON.parse(JSON.stringify(result.docs));

  return {
    ...result,
    docs: docs.map((doc) => {
      // eslint-disable-next-line no-param-reassign
      doc.id = doc._id;
      return sanitizeInternalFields(doc);
    }),
  };
};
