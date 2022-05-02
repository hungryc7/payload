import { formatLabels, toWords } from '../../utilities/formatLabels';
import { MissingFieldType, InvalidFieldRelationship } from '../../errors';
import { baseBlockFields } from '../baseFields/baseBlockFields';
import validations from '../validations';
import { baseIDField } from '../baseFields/baseIDField';
import { Field, fieldAffectsData } from './types';

const sanitizeFields = (fields: Field[], validRelationships: string[]): Field[] => {
  if (!fields) return [];

  return fields.map((unsanitizedField) => {
    const field: Field = { ...unsanitizedField };

    if (!field.type) throw new MissingFieldType(field);

    // Auto-label
    if ('name' in field && field.name && typeof field.label !== 'string' && field.label !== false) {
      field.label = toWords(field.name);
    }

    if (field.type === 'checkbox' && typeof field.defaultValue === 'undefined' && field.required === true) {
      field.defaultValue = false;
    }

    if (field.type === 'relationship' || field.type === 'upload') {
      const relationships = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo];
      relationships.forEach((relationship: string) => {
        if (!validRelationships.includes(relationship)) {
          throw new InvalidFieldRelationship(field, relationship);
        }
      });
    }

    if (field.type === 'blocks') {
      field.blocks = field.blocks.map((block) => ({ ...block, fields: block.fields.concat(baseBlockFields) }));
    }

    if (field.type === 'array') {
      field.fields.push(baseIDField);
    }

    if ((field.type === 'blocks' || field.type === 'array') && field.label !== false) {
      field.labels = field.labels || formatLabels(field.name);
    }

    if (fieldAffectsData(field)) {
      if (typeof field.validate === 'undefined') {
        const defaultValidate = validations[field.type];
        if (defaultValidate) {
          field.validate = (val, options) => defaultValidate(val, { ...field, ...options });
        } else {
          field.validate = () => true;
        }
      }

      if (!field.hooks) field.hooks = {};
      if (!field.access) field.access = {};
    }

    if (!field.admin) field.admin = {};

    if ('fields' in field && field.fields) field.fields = sanitizeFields(field.fields, validRelationships);

    if ('blocks' in field && field.blocks) {
      field.blocks = field.blocks.map((block) => {
        const unsanitizedBlock = { ...block };
        unsanitizedBlock.labels = !unsanitizedBlock.labels ? formatLabels(unsanitizedBlock.slug) : unsanitizedBlock.labels;
        unsanitizedBlock.fields = sanitizeFields(block.fields, validRelationships);
        return unsanitizedBlock;
      });
    }

    return field;
  });
};

export default sanitizeFields;
