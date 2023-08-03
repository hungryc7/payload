import { CollectionConfig } from '../../src/collections/config/types';
import { buildConfigWithDefaults } from '../buildConfigWithDefaults';
import { devUser } from '../credentials';

export const Posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
    },
    {
      name: 'number',
      type: 'number',
      localized: true,
    },
    {
      name: 'myArray',
      type: 'array',
      fields: [
        {
          name: 'subField',
          type: 'text',
          localized: true,
        },
        {
          name: 'mySubArray',
          type: 'array',
          fields: [
            {
              name: 'subSubField',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'myBlocks',
      type: 'blocks',
      blocks: [
        {
          slug: 'block1',
          fields: [
            {
              name: 'nonLocalizedText',
              type: 'text',
            },
            {
              name: 'localizedText',
              type: 'text',
              localized: true,
            },
          ],
        },
        {
          slug: 'block2',
          fields: [
            {
              name: 'number',
              type: 'number',
            },
          ],
        },
      ],
    },
    // Has One
    {
      name: 'relationHasOne',
      type: 'relationship',
      relationTo: 'pages',
    },
    // Has Many
    {
      name: 'relationHasMany',
      type: 'relationship',
      hasMany: true,
      relationTo: 'pages',
    },
    // Has One - Polymorphic
    {
      name: 'relationHasOnePoly',
      type: 'relationship',
      relationTo: ['people', 'pages'],
    },
    // Has Many - Polymorphic
    {
      name: 'relationHasManyPoly',
      type: 'relationship',
      hasMany: true,
      relationTo: ['people', 'pages'],
    },
    {
      name: 'selfReferencingRelationship',
      type: 'relationship',
      relationTo: 'posts',
    },
    {
      name: 'myGroup',
      type: 'group',
      fields: [
        {
          name: 'subField',
          type: 'text',
        },
        {
          name: 'subFieldLocalized',
          type: 'text',
          localized: true,
        },
        {
          name: 'subGroup',
          type: 'group',
          fields: [
            {
              name: 'subSubField',
              type: 'text',
            },
            {
              name: 'subSubFieldLocalized',
              type: 'text',
              localized: true,
            },
          ],
        },
        {
          name: 'groupArray',
          type: 'array',
          fields: [
            {
              name: 'groupArrayText',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
};

const config = buildConfigWithDefaults({
  collections: [
    Posts,
    {
      slug: 'pages',
      fields: [
        {
          name: 'slug',
          type: 'text',
        },
      ],
    },
    {
      slug: 'people',
      fields: [
        {
          name: 'fullName',
          type: 'text',
        },
      ],
    },
  ],
  localization: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
  onInit: async (payload) => {
    // await payload.create({
    //   collection: 'users',
    //   data: {
    //     email: devUser.email,
    //     password: devUser.password,
    //   },
    // });

    const page1 = await payload.create({
      collection: 'pages',
      data: {
        slug: 'first',
      },
    });

    const page2 = await payload.create({
      collection: 'pages',
      data: {
        slug: 'second',
      },
    });

    const person1 = await payload.create({
      collection: 'people',
      data: {
        fullName: 'Dan Ribbens',
      },
    });

    await payload.create({
      collection: 'posts',
      data: {
        title: 'hello',
        number: 1337,
        myGroup: {
          subField: 'hello',
          subFieldLocalized: 'hello in english',
          subGroup: {
            subSubField: 'sub hello',
            subSubFieldLocalized: 'sub hello in english',
          },
          groupArray: [
            {
              groupArrayText: 'hello 1',
            },
            {
              groupArrayText: 'hello 2',
            },
          ],
        },
        relationHasOne: page1.id,
        relationHasOnePoly: {
          relationTo: 'people',
          value: person1.id,
        },
        relationHasMany: [page1.id, page2.id],
        relationHasManyPoly: [
          {
            relationTo: 'people',
            value: person1.id,
          },
          {
            relationTo: 'pages',
            value: page2.id,
          },
        ],
        myArray: [
          {
            subField: 'hello 1',
            mySubArray: [
              {
                subSubField: 'row 1 subrow 1',
              },
              {
                subSubField: 'row 1 subrow 2',
              },
            ],
          },
          {
            subField: 'hello 2',
            mySubArray: [
              {
                subSubField: 'row 2 subrow 1',
              },
              {
                subSubField: 'row 2 subrow 2',
              },
            ],
          },
        ],
        myBlocks: [
          {
            blockType: 'block1',
            nonLocalizedText: 'hello',
            localizedText: 'hello in english',
          },
          {
            blockType: 'block2',
            number: 123,
          },
        ],
      },
    });
  },
});

export default config;
