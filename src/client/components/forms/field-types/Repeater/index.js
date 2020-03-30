import React, {
  useContext, useState, useEffect, useReducer,
} from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

import FormContext from '../../Form/Context';
import Section from '../../../layout/Section';
import DraggableSection from '../../DraggableSection'; // eslint-disable-line import/no-cycle
import collapsibleReducer from './reducer';

import './index.scss';

const baseClass = 'field-type repeater';

const Repeater = (props) => {
  const [collapsibleStates, dispatchCollapsibleStates] = useReducer(collapsibleReducer, []);
  const formContext = useContext(FormContext);
  const [rowCount, setRowCount] = useState(0);
  const [hasModifiedRows, setHasModifiedRows] = useState(false);
  const { fields: fieldState, dispatchFields } = formContext;

  const {
    label,
    name,
    fields,
    defaultValue,
    singularLabel,
  } = props;

  const addRow = (rowIndex) => {
    dispatchFields({
      type: 'ADD_ROW', rowIndex, name, fields,
    });

    dispatchCollapsibleStates({
      type: 'ADD_COLLAPSIBLE', collapsibleIndex: rowIndex,
    });

    setRowCount(rowCount + 1);
    setHasModifiedRows(true);
  };

  const removeRow = (rowIndex) => {
    dispatchFields({
      type: 'REMOVE_ROW', rowIndex, name, fields,
    });

    dispatchCollapsibleStates({
      type: 'REMOVE_COLLAPSIBLE',
      collapsibleIndex: rowIndex,
    });

    setRowCount(rowCount - 1);
    setHasModifiedRows(true);
  };

  const moveRow = (moveFromIndex, moveToIndex) => {
    dispatchFields({
      type: 'MOVE_ROW', moveFromIndex, moveToIndex, name,
    });

    dispatchCollapsibleStates({
      type: 'MOVE_COLLAPSIBLE', collapsibleIndex: moveFromIndex, moveToIndex,
    });

    setHasModifiedRows(true);
  };

  useEffect(() => {
    setRowCount(defaultValue.length);

    dispatchCollapsibleStates({
      type: 'SET_ALL_COLLAPSIBLES',
      payload: Array.from(Array(defaultValue.length).keys()).reduce(acc => ([...acc, true]), []), // sets all collapsibles to open on first load
    });
  }, [defaultValue]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    moveRow(sourceIndex, destinationIndex);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={baseClass}>
        <Section
          heading={label}
          rowCount={rowCount}
          addRow={() => addRow(0)}
          useAddRowButton
        >
          <Droppable droppableId="repeater-drop">
            {provided => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {rowCount !== 0
                  && Array.from(Array(rowCount).keys()).map((_, rowIndex) => {
                    return (
                      <DraggableSection
                        key={rowIndex}
                        parentName={name}
                        singularLabel={singularLabel}
                        addRow={() => addRow(rowIndex)}
                        removeRow={() => removeRow(rowIndex)}
                        rowIndex={rowIndex}
                        fieldState={fieldState}
                        renderFields={fields}
                        rowCount={rowCount}
                        defaultValue={hasModifiedRows ? undefined : defaultValue[rowIndex]}
                        dispatchCollapsibleStates={dispatchCollapsibleStates}
                        collapsibleStates={collapsibleStates}
                      />
                    );
                  })
                }
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </Section>

      </div>
    </DragDropContext>
  );
};

Repeater.defaultProps = {
  label: '',
  singularLabel: '',
  defaultValue: [],
};

Repeater.propTypes = {
  defaultValue: PropTypes.arrayOf(
    PropTypes.shape({}),
  ),
  fields: PropTypes.arrayOf(
    PropTypes.shape({}),
  ).isRequired,
  label: PropTypes.string,
  singularLabel: PropTypes.string,
  name: PropTypes.string.isRequired,
};

export default Repeater;
