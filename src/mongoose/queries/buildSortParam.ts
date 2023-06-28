import { Config } from '../../config/types';
import { getLocalizedSortProperty } from './getLocalizedSortProperty';
import { Field } from '../../fields/config/types';
import type { SortArgs, SortDirection } from '../../database/types';

type Args = {
  sort: string
  config: Config
  fields: Field[]
  timestamps: boolean
  locale: string
}

export const buildSortParam = ({ sort, config, fields, timestamps, locale }: Args): SortArgs => {
  let sortProperty: string;
  let sortDirection: SortDirection = 'desc';

  if (!sort) {
    if (timestamps) {
      sortProperty = 'createdAt';
    } else {
      sortProperty = '_id';
    }
  } else if (sort.indexOf('-') === 0) {
    sortProperty = sort.substring(1);
  } else {
    sortProperty = sort;
    sortDirection = 'asc';
  }

  if (sortProperty === 'id') {
    sortProperty = '_id';
  } else {
    sortProperty = getLocalizedSortProperty({
      segments: sortProperty.split('.'),
      config,
      fields,
      locale,
    });
  }

  return [{ property: sortProperty, direction: sortDirection }];
};
