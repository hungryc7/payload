import type { PaginateOptions } from 'mongoose';
import type { MongooseAdapter } from '.';
import type { Find } from '../database/types';
import sanitizeInternalFields from '../utilities/sanitizeInternalFields';
import flattenWhereToOperators from '../database/flattenWhereToOperators';


export const find: Find = async function find(this: MongooseAdapter,
  { collection, where, page, limit, sort, locale, pagination }) {
  const Model = this.collections[collection];

  let useEstimatedCount = false;

  if (where) {
    const constraints = flattenWhereToOperators(where);
    useEstimatedCount = constraints.some((prop) => Object.keys(prop).some((key) => key === 'near'));
  }

  const query = await Model.buildQuery({
    payload: this.payload,
    locale,
    where,
  });

  const paginationOptions: PaginateOptions = {
    page,
    sort: sort ? sort.reduce((acc, cur) => {
      acc[cur.property] = cur.direction;
      return acc;
    }, {}) : undefined,
    limit,
    lean: true,
    leanWithId: true,
    useEstimatedCount,
    pagination,
    options: {
      // limit must also be set here, it's ignored when pagination is false
      limit,
    },
  };

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
