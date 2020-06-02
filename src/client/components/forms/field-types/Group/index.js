import React from 'react';
import PropTypes from 'prop-types';
import RenderFields from '../../RenderFields';
import withCondition from '../../withCondition';

import './index.scss';

const Group = (props) => {
  const {
    label, fields, name, defaultValue, fieldTypes,
  } = props;

  return (
    <div className="field-type group">
      <RenderFields
        fieldTypes={fieldTypes}
        fieldSchema={fields.map((subField) => {
          return {
            ...subField,
            name: `${name}${subField.name ? `.${subField.name}` : ''}`,
            defaultValue: subField.name ? defaultValue[subField.name] : defaultValue,
          };
        })}
      />
    </div>
  );
};

Group.defaultProps = {
  label: '',
  defaultValue: {},
};

Group.propTypes = {
  defaultValue: PropTypes.shape({}),
  fields: PropTypes.arrayOf(
    PropTypes.shape({}),
  ).isRequired,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  fieldTypes: PropTypes.shape({}).isRequired,
};

export default withCondition(Group);
