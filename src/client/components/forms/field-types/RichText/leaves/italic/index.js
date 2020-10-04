import React from 'react';
import PropTypes from 'prop-types';
import LeafButton from '../Button';
import ItalicIcon from '../../../../../icons/Italic';

const Italic = ({ attributes, children }) => (
  <em {...attributes}>{children}</em>
);

Italic.defaultProps = {
  attributes: {},
  children: null,
};

Italic.propTypes = {
  attributes: PropTypes.shape({}),
  children: PropTypes.node,
};

const italic = {
  Button: () => (
    <LeafButton format="italic">
      <ItalicIcon />
    </LeafButton>
  ),
  Leaf: Italic,
};

export default italic;
