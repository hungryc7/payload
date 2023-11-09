import type { CollectionConfig } from '../../../../packages/payload/src/collections/config/types'

import { arrayFieldsSlug } from '../../slugs'
import { ArrayRowLabel } from './LabelComponent'

export const arrayDefaultValue = [{ text: 'row one' }, { text: 'row two' }]

const ArrayFields: CollectionConfig = {
  slug: arrayFieldsSlug,
  admin: {
    enableRichTextLink: false,
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      defaultValue: arrayDefaultValue,
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'collapsedArray',
      type: 'array',
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
      ],
      admin: {
        initCollapsed: true,
      },
    },
    {
      name: 'localized',
      type: 'array',
      required: true,
      localized: true,
      defaultValue: arrayDefaultValue,
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      type: 'array',
      name: 'readOnly',
      admin: {
        readOnly: true,
      },
      defaultValue: [
        {
          text: 'defaultValue',
        },
        {
          text: 'defaultValue2',
        },
      ],
      fields: [
        {
          type: 'text',
          name: 'text',
        },
      ],
    },
    {
      type: 'array',
      name: 'potentiallyEmptyArray',
      fields: [
        {
          type: 'text',
          name: 'text',
        },
        {
          type: 'group',
          name: 'groupInRow',
          fields: [
            {
              type: 'text',
              name: 'textInGroupInRow',
            },
          ],
        },
      ],
    },
    {
      type: 'array',
      name: 'rowLabelAsFunction',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
      ],
      admin: {
        description: 'Row labels rendered from a function.',
        components: {
          RowLabel: ({ data }) => data.title,
        },
      },
    },
    {
      type: 'array',
      name: 'rowLabelAsComponent',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
      ],
      admin: {
        description: 'Row labels rendered as react components.',
        components: {
          RowLabel: ArrayRowLabel,
        },
      },
    },
  ],
}

export default ArrayFields
