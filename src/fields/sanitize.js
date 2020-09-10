const { MissingFieldType, InvalidFieldRelationship } = require('../errors');
const validations = require('./validations');

const sanitizeFields = (collections, fields) => {
  if (!fields) return [];

  const validSlugs = collections.map((c) => c.slug);

  return fields.map((unsanitizedField) => {
    const field = { ...unsanitizedField };

    if (!field.type) throw new MissingFieldType(field);

    if (field.type === 'relationship') {
      const relationships = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo];
      relationships.forEach((relationship) => {
        if (!validSlugs.includes(relationship)) {
          throw new InvalidFieldRelationship(field, relationship);
        }
      });
    }

    if (typeof field.validate === 'undefined') {
      const defaultValidate = validations[field.type];
      const noValidate = () => true;
      field.validate = defaultValidate || noValidate;
    }

    if (!field.hooks) field.hooks = {};
    if (!field.access) field.access = {};
    if (!field.admin) field.admin = {};

    if (field.fields) field.fields = sanitizeFields(field.fields);

    if (field.blocks) {
      field.blocks = field.blocks.map((block) => {
        const unsanitizedBlock = { ...block };
        unsanitizedBlock.fields = sanitizeFields(block.fields);
        return unsanitizedBlock;
      });
    }

    return field;
  });
};

module.exports = sanitizeFields;
