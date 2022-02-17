import { Block, Field } from 'payload/types';
import { FieldConfig, TextField } from '../../types';
import { DynamicFieldSelector } from './DynamicFieldSelector';
import { DynamicPriceSelector } from './DynamicPriceSelector';

const name: Field = {
  name: 'name',
  label: 'Name (lowercase, no special characters)',
  type: 'text',
  required: true,
};

const label: Field = {
  name: 'label',
  label: 'Label',
  type: 'text',
  required: true,
};

const required: Field = {
  name: 'required',
  label: 'Required',
  type: 'checkbox',
};

const width: Field = {
  name: 'width',
  label: 'Field Width (percentage)',
  type: 'number',
};

const Select: Block = {
  slug: 'select',
  labels: {
    singular: 'Select',
    plural: 'Select Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          ...width,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'defaultValue',
          label: 'Default Value',
          type: 'text',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'options',
      label: 'Select Attribute Options',
      type: 'array',
      labels: {
        singular: 'Option',
        plural: 'Options',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              label: 'Label',
              type: 'text',
              required: true,
              admin: {
                width: '50%',
              },
            },
            {
              name: 'value',
              label: 'Value',
              type: 'text',
              required: true,
              admin: {
                width: '50%',
              },
            },
          ],
        },
      ],
    },
    required,
  ],
};

const Text: Block = {
  slug: 'text',
  labels: {
    singular: 'Text',
    plural: 'Text Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          ...width,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'defaultValue',
          label: 'Default Value',
          type: 'text',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    required,
  ],
};

const Number: Block = {
  slug: 'number',
  labels: {
    singular: 'Number',
    plural: 'Number Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          ...width,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'defaultValue',
          label: 'Default Value',
          type: 'number',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    required,
  ],
};

const Email: Block = {
  slug: 'email',
  labels: {
    singular: 'Email',
    plural: 'Email Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    width,
    required,
  ],
};

const State: Block = {
  slug: 'state',
  labels: {
    singular: 'State',
    plural: 'State Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    width,
    required,
  ],
};

const Country: Block = {
  slug: 'country',
  labels: {
    singular: 'Country',
    plural: 'Country Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    width,
    required,
  ],
};

const Checkbox: Block = {
  slug: 'checkbox',
  labels: {
    singular: 'Checkbox',
    plural: 'Checkbox Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...name,
          admin: {
            width: '50%',
          },
        },
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          ...width,
          admin: {
            width: '50%',
          },
        },
        {
          ...required,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'defaultValue',
      label: 'Default Value',
      type: 'checkbox',
    },
  ],
};

const Payment = (fieldConfig: FieldConfig): Block => ({
  slug: 'payment',
  labels: {
    singular: 'Payment',
    plural: 'Payment Fields',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          ...label,
          admin: {
            width: '50%',
          },
        },
        {
          ...width,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'paymentProcessor',
          type: 'select',
          options: [],
          admin: {
            width: '100%',
          },
          ...fieldConfig?.paymentProcessor || {}
        },
        {
          name: 'priceType',
          label: 'Price Type',
          type: 'radio',
          admin: {
            width: '100%',
          },
          defaultValue: 'static',
          options: [
            {
              label: 'Static Price',
              value: 'static'
            },
            {
              label: 'Dynamic Price',
              value: 'dynamic'
            }
          ]
        },
        {
          name: 'staticPrice',
          type: 'number',
          label: 'Price',
          admin: {
            condition: (_, { priceType }) => priceType === 'static'
          },
        },
        {
          name: 'dynamicPrice',
          labels: {
            singular: 'Condition',
            plural: 'Conditions',
          },
          type: 'array',
          label: 'Price',
          admin: {
            condition: (_, { priceType }) => priceType === 'dynamic'
          },
          fields: [
            {
              name: 'fieldToUse',
              type: 'text',
              admin: {
                components: {
                  Field: DynamicFieldSelector,
                },
              },
            },
            {
              name: 'condition',
              label: 'Condition',
              type: 'select',
              defaultValue: 'hasValue',
              options: [
                {
                  value: 'hasValue',
                  label: 'Has Any Value'
                },
                {
                  value: 'equals',
                  label: 'Equals'
                },
                {
                  value: 'notEquals',
                  label: 'Does Not Equal'
                }
              ]
            },
            {
              name: 'valueForCondition',
              label: 'Value',
              type: 'text',
              admin: {
                condition: (_, { condition }) => condition === 'equals' || condition === 'notEquals'
              }
            },
            {
              name: 'operator',
              type: 'select',
              defaultValue: 'add',
              options: [
                {
                  value: 'add',
                  label: 'Add'
                },
                {
                  value: 'subtract',
                  label: 'Subtract'
                },
                {
                  value: 'multiply',
                  label: 'Multiply'
                },
                {
                  value: 'divide',
                  label: 'Divide'
                }
              ]
            },
            {
              name: 'valueType',
              label: 'Value Type',
              type: 'radio',
              admin: {
                width: '100%',
              },
              defaultValue: 'static',
              options: [
                {
                  label: 'Static Value',
                  value: 'static'
                },
                {
                  label: 'Dynamic Value',
                  value: 'dynamic'
                }
              ]
            },
            {
              name: 'valueForOperator',
              label: 'Value',
              type: 'text',
              admin: {
                components: {
                  Field: DynamicPriceSelector,
                },
              },
            },
          ]
        },
      ],
    },
    required,
  ],
});

const Message: Block = {
  slug: 'message',
  labels: {
    singular: 'Message',
    plural: 'Message Blocks',
  },
  fields: [
    {
      name: 'message',
      type: 'richText',
    },
  ],
};

export default {
  select: Select,
  checkbox: Checkbox,
  text: Text,
  email: Email,
  message: Message,
  number: Number,
  country: Country,
  state: State,
  payment: Payment
};
