import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import PropTypes from 'prop-types';
import useFieldType from '../../useFieldType';
import Button from '../../../elements/Button';
import FileDetails from '../../../elements/FileDetails';
import Error from '../../Error';

import './index.scss';

const baseClass = 'file-field';

const handleDrag = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

const validate = (value) => {
  if (!value && value !== undefined) {
    return 'A file is required.';
  }

  return true;
};

const File = (props) => {
  const inputRef = useRef();
  const dropRef = useRef();
  const [fileList, setFileList] = useState(undefined);
  const [selectingFile, setSelectingFile] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const {
    initialData = {}, adminThumbnail, staticURL,
  } = props;

  const { filename } = initialData;

  const {
    value,
    setValue,
    showError,
    errorMessage,
  } = useFieldType({
    path: 'file',
    validate,
  });

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(dragCounter + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragging(true);
    }
  }, [dragCounter]);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(dragCounter - 1);
    if (dragCounter > 1) return;
    setDragging(false);
  }, [dragCounter]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFileList(e.dataTransfer.files);
      setDragging(false);

      e.dataTransfer.clearData();
      setDragCounter(0);
    } else {
      setDragging(false);
    }
  }, []);

  const handleInputChange = useCallback(() => {
    setSelectingFile(false);
    setFileList(inputRef?.current?.files || null);
    setValue(inputRef?.current?.files?.[0] || null);
  }, [inputRef, setValue]);

  useEffect(() => {
    if (selectingFile) {
      inputRef.current.click();
      setSelectingFile(false);
    }
  }, [selectingFile, inputRef, setSelectingFile]);

  useEffect(() => {
    const div = dropRef.current;
    if (div) {
      div.addEventListener('dragenter', handleDragIn);
      div.addEventListener('dragleave', handleDragOut);
      div.addEventListener('dragover', handleDrag);
      div.addEventListener('drop', handleDrop);

      return () => {
        div.removeEventListener('dragenter', handleDragIn);
        div.removeEventListener('dragleave', handleDragOut);
        div.removeEventListener('dragover', handleDrag);
        div.removeEventListener('drop', handleDrop);
      };
    }

    return null;
  }, [handleDragIn, handleDragOut, handleDrop, dropRef]);

  useEffect(() => {
    if (inputRef.current && fileList !== undefined) {
      inputRef.current.files = fileList;
    }
  }, [fileList]);

  const classes = [
    baseClass,
    dragging && `${baseClass}--dragging`,
    'field-type',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Error
        showError={showError}
        message={errorMessage}
      />
      {filename && (
        <FileDetails
          {...initialData}
          staticURL={staticURL}
          adminThumbnail={adminThumbnail}
          handleRemove={() => true}
        />
      )}
      {!filename && (
        <div className={`${baseClass}__upload`}>
          {value && (
            <div className={`${baseClass}__file-selected`}>
              <span
                className={`${baseClass}__filename`}
              >
                {value.name}
              </span>
              <Button
                icon="x"
                round
                buttonStyle="icon-label"
                iconStyle="with-border"
                onClick={() => setFileList(null)}
              />
            </div>
          )}
          {!value && (
            <>
              <div
                className={`${baseClass}__drop-zone`}
                ref={dropRef}
              >
                <Button
                  size="small"
                  buttonStyle="secondary"
                  onClick={() => setSelectingFile(true)}
                >
                  Select a file
                </Button>
                <span className={`${baseClass}__drag-label`}>or drag and drop a file here</span>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            onChange={handleInputChange}
          />
        </div>
      )}
    </div>
  );
};

File.defaultProps = {
  initialData: undefined,
  adminThumbnail: undefined,
};

File.propTypes = {
  fieldTypes: PropTypes.shape({}).isRequired,
  initialData: PropTypes.shape({
    filename: PropTypes.string,
    mimeType: PropTypes.string,
    filesize: PropTypes.number,
  }),
  staticURL: PropTypes.string.isRequired,
  adminThumbnail: PropTypes.string,
};

export default File;
