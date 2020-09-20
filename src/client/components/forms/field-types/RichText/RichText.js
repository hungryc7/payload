import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { Editable, withReact, Slate } from 'slate-react';
import { createEditor } from 'slate';
import { withHistory } from 'slate-history';
import { richText } from '../../../../../fields/validations';
import useFieldType from '../../useFieldType';
import withCondition from '../../withCondition';
import Label from '../../Label';
import Error from '../../Error';
import leafTypes from './leafTypes';
import elementTypes from './elementTypes';
import toggleLeaf from './toggleLeaf';
import hotkeys from './hotkeys';

import mergeCustomFunctions from './mergeCustomFunctions';

import './index.scss';

const baseClass = 'rich-text';

const RichText = (props) => {
  const {
    path: pathFromProps,
    name,
    required,
    validate,
    label,
    placeholder,
    admin: {
      readOnly,
      style,
      width,
      elements = [],
      leaves = [],
    } = {},
    customComponentPath,
  } = props;

  const path = pathFromProps || name;

  const [preloaded, setPreloaded] = useState(false);
  const [enabledElements, setEnabledElements] = useState({});
  const [enabledLeaves, setEnabledLeaves] = useState({});

  const renderElement = useCallback(({ attributes, children, element }) => {
    const matchedElement = enabledElements[element?.type];
    const Element = matchedElement?.element;

    if (Element) {
      return (
        <Element attributes={attributes}>{children}</Element>
      );
    }

    return <p {...attributes}>{children}</p>;
  }, [enabledElements]);

  const renderLeaf = useCallback(({ attributes, children, leaf }) => {
    const matchedLeafName = Object.keys(enabledLeaves).find((leafName) => leaf[leafName]);

    if (enabledLeaves[matchedLeafName]?.leaf) {
      const Leaf = enabledLeaves[matchedLeafName]?.leaf;

      return <Leaf attributes={attributes}>{children}</Leaf>;
    }

    return (
      <span {...attributes}>{children}</span>
    );
  }, [enabledLeaves]);

  const memoizedValidate = useCallback((value) => {
    const validationResult = validate(value, { required });
    return validationResult;
  }, [validate, required]);

  const fieldType = useFieldType({
    path,
    required,
    validate: memoizedValidate,
  });

  const {
    value,
    showError,
    setValue,
    errorMessage,
  } = fieldType;

  const classes = [
    baseClass,
    'field-type',
    showError && 'error',
    readOnly && 'read-only',
  ].filter(Boolean).join(' ');

  const editor = useMemo(() => withHistory(withReact(createEditor())), []);

  useEffect(() => {
    if (!preloaded) {
      const preload = async () => {
        const mergedElements = await mergeCustomFunctions(`${customComponentPath}.elements`, elements, elementTypes);
        const mergedLeaves = await mergeCustomFunctions(`${customComponentPath}.leaves`, leaves, leafTypes);

        setEnabledElements(mergedElements);
        setEnabledLeaves(mergedLeaves);

        setPreloaded(true);
      };

      preload();
    }
  }, [preloaded, customComponentPath, elements, leaves]);

  if (!preloaded) {
    return null;
  }

  return (
    <div
      className={classes}
      style={{
        ...style,
        width,
      }}
    >
      <Error
        showError={showError}
        message={errorMessage}
      />
      <Label
        htmlFor={path}
        label={label}
        required={required}
      />
      <Slate
        editor={editor}
        value={value || [{
          children: [{ text: '' }],
        }]}
        onChange={setValue}
      >
        <div className={`${baseClass}__toolbar`}>
          {elements.map((element, i) => {
            const elementName = element?.name || element;

            const elementType = enabledElements[elementName];
            const Button = elementType?.button;

            if (Button) {
              return <Button key={i} />;
            }

            return null;
          })}
          {leaves.map((leaf, i) => {
            const leafName = leaf?.name || leaf;
            const leafType = enabledLeaves[leafName];
            const Button = leafType?.button;

            if (Button) {
              return <Button key={i} />;
            }

            return null;
          })}
        </div>
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          spellCheck
          autoFocus
          onKeyDown={(event) => {
            Object.keys(hotkeys).forEach((hotkey) => {
              if (isHotkey(hotkey, event)) {
                event.preventDefault();
                const mark = hotkeys[hotkey];
                toggleLeaf(editor, mark);
              }
            });
          }}
        />
      </Slate>
    </div>
  );
};

RichText.defaultProps = {
  label: null,
  required: false,
  admin: {},
  validate: richText,
  path: '',
  placeholder: undefined,
};

RichText.propTypes = {
  name: PropTypes.string.isRequired,
  path: PropTypes.string,
  required: PropTypes.bool,
  validate: PropTypes.func,
  admin: PropTypes.shape({
    readOnly: PropTypes.bool,
    style: PropTypes.shape({}),
    width: PropTypes.string,
    elements: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
          name: PropTypes.string,
        }),
      ]),
    ),
    leaves: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
          name: PropTypes.string,
        }),
      ]),
    ),
  }),
  label: PropTypes.string,
  placeholder: PropTypes.string,
  customComponentPath: PropTypes.string.isRequired,
};

export default withCondition(RichText);
