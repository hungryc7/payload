import React from 'react';
import PropTypes from 'prop-types';
import ReactSelect from '../../../modules/ReactSelect';
import useFieldType from '../../useFieldType';
import Label from '../../Label';
import Error from '../../Error';

import './index.scss';

const defaultError = 'Please make a selection.';
const defaultValidate = value => value.length > 0;

const findValueToRender = (options, value, hasMany) => {
  if (hasMany && Array.isArray(value)) {
    return value.map(subValue => options.find(option => option.value === subValue));
  }

  return options.find(option => option.value === value);
};

const Select = (props) => {
  const {
    name,
    required,
    defaultValue,
    validate,
    style,
    width,
    errorMessage,
    label,
    options,
    hasMany,
  } = props;

  const {
    value,
    showError,
    formProcessing,
    onFieldChange,
  } = useFieldType({
    name,
    required,
    defaultValue,
    validate,
  });

  const classes = [
    'field-type',
    'select',
    showError && 'error',
  ].filter(Boolean).join(' ');

  const fieldWidth = width ? `${width}%` : undefined;

  const valueToRender = findValueToRender(options, value, hasMany);

  return (
    <div
      className={classes}
      style={{
        ...style,
        width: fieldWidth,
      }}
    >
      <Error
        showError={showError}
        message={errorMessage}
      />
      <Label
        htmlFor={name}
        label={label}
        required={required}
      />
      <ReactSelect
        onChange={onFieldChange}
        value={valueToRender}
        showError={showError}
        disabled={formProcessing}
        options={options}
        isMulti={hasMany}
      />
    </div>
  );
};

Select.defaultProps = {
  style: {},
  required: false,
  errorMessage: defaultError,
  validate: defaultValidate,
  defaultValue: null,
  hasMany: false,
  width: 100,
};

Select.propTypes = {
  required: PropTypes.bool,
  style: PropTypes.shape({}),
  errorMessage: PropTypes.string,
  label: PropTypes.string.isRequired,
  defaultValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.array,
  ]),
  validate: PropTypes.func,
  name: PropTypes.string.isRequired,
  width: PropTypes.number,
  options: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.string,
    ),
    PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.string,
        label: PropTypes.string,
      }),
    ),
  ]).isRequired,
  hasMany: PropTypes.bool,
};

export default Select;
