import React from 'react';
import PropTypes from 'prop-types';
import { useRouteMatch, useHistory } from 'react-router-dom';
import config from '../../../../securedConfig';
import DefaultTemplate from '../../../layout/DefaultTemplate';
import usePayloadAPI from '../../../../hooks/usePayloadAPI';
import Form from '../../../forms/Form';
import StickyHeader from '../../../modules/StickyHeader';
<<<<<<< HEAD
import APIURL from '../../../modules/APIURL';
import PreviewButton from '../../../controls/PreviewButton';
=======
import APIUrl from '../../../modules/APIUrl';
import Button from '../../../controls/Button';
>>>>>>> Fix APIUrl casing
import FormSubmit from '../../../forms/Submit';
import RenderFields from '../../../forms/RenderFields';
import * as fieldTypes from '../../../forms/field-types';
import customComponents from '../../../customComponents';

import './index.scss';

const { serverURL, routes: { admin, api } } = config;

const baseClass = 'collection-edit';

const EditView = (props) => {
  const { collection, isEditing } = props;
  const {
    slug,
    preview,
    fields,
    labels: {
      singular: singularLabel,
      plural: pluralLabel,
    },
    useAsTitle,
  } = collection;

  const { params: { id } = {} } = useRouteMatch();
  const history = useHistory();

  const handleAjaxResponse = !isEditing ? (res) => {
    res.json().then((json) => {
      history.push(`${admin}/collections/${collection.slug}/${json.doc.id}`, {
        status: {
          message: json.message,
          type: 'success',
        },
      });
    });
  } : null;

  const [{ data }] = usePayloadAPI(
    (isEditing ? `${serverURL}${api}/${slug}/${id}` : null),
    { initialParams: { 'fallback-locale': 'null' } },
  );

  const nav = [{
    url: `${admin}/collections/${slug}`,
    label: pluralLabel,
  }];

  if (isEditing) {
    nav.push({
      label: data ? data[useAsTitle] : '',
    });
  } else {
    nav.push({
      label: 'Create New',
    });
  }

  return (
    <DefaultTemplate
      className={baseClass}
      stepNav={nav}
    >
      <header className={`${baseClass}__header`}>
        {isEditing && (
          <h1>
            Edit
            {' '}
            {Object.keys(data).length > 0
              && (data[useAsTitle] ? data[useAsTitle] : '[Untitled]')
            }
          </h1>
        )}
        {!isEditing
          && (
            <h1>
              Create New
              {' '}
              {singularLabel}
            </h1>
          )
        }
      </header>
      <Form
        className={`${baseClass}__form`}
        method={id ? 'put' : 'post'}
        action={`${serverURL}${api}/${slug}${id ? `/${id}` : ''}`}
        handleAjaxResponse={handleAjaxResponse}
      >
        <StickyHeader
          showStatus
          content={
<<<<<<< HEAD
            <APIURL url={isEditing && `${serverURL}${api}/${slug}/${data.id}`} />
=======
            <APIUrl url={isEditing && `${serverURL}${api}/${collection.slug}/${data.id}`} />
>>>>>>> Fix APIUrl casing
          }
          action={(
            <>
              <PreviewButton generatePreviewURL={preview} />
              <FormSubmit>Save</FormSubmit>
            </>
          )}
        />
        <RenderFields
          fieldTypes={fieldTypes}
          customComponents={customComponents?.[slug]?.fields}
          fieldSchema={fields}
          initialData={data}
        />
      </Form>
    </DefaultTemplate>
  );
};

EditView.defaultProps = {
  isEditing: false,
};

EditView.propTypes = {
  collection: PropTypes.shape({
    labels: PropTypes.shape({
      plural: PropTypes.string,
      singular: PropTypes.string,
    }),
    slug: PropTypes.string,
    useAsTitle: PropTypes.string,
    fields: PropTypes.arrayOf(PropTypes.shape({})),
    preview: PropTypes.func,
  }).isRequired,
  isEditing: PropTypes.bool,
};

export default EditView;
