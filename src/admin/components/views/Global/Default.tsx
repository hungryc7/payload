import React from 'react';
import format from 'date-fns/format';
import { useConfig } from '@payloadcms/config-provider';
import Eyebrow from '../../elements/Eyebrow';
import Form from '../../forms/Form';
import PreviewButton from '../../elements/PreviewButton';
import FormSubmit from '../../forms/Submit';
import RenderFields from '../../forms/RenderFields';
import CopyToClipboard from '../../elements/CopyToClipboard';
import Meta from '../../utilities/Meta';
import fieldTypes from '../../forms/field-types';
import LeaveWithoutSaving from '../../modals/LeaveWithoutSaving';
import VersionsCount from '../../elements/VersionsCount';
import { Props } from './types';

import ViewDescription from '../../elements/ViewDescription';
import Loading from '../../elements/Loading';

import './index.scss';

const baseClass = 'global-edit';

const DefaultGlobalView: React.FC<Props> = (props) => {
  const { admin: { dateFormat } } = useConfig();
  const {
    global, data, onSave, permissions, action, apiURL, initialState, isLoading,
  } = props;

  const {
    fields,
    preview,
    versions,
    label,
    admin: {
      description,
      hideAPIURL,
    } = {},
  } = global;

  const hasSavePermission = permissions?.update?.permission;

  return (
    <div className={baseClass}>
      {isLoading && (
        <Loading />
      )}
      {!isLoading && (
        <Form
          className={`${baseClass}__form`}
          method="post"
          action={action}
          onSuccess={onSave}
          disabled={!hasSavePermission}
          initialState={initialState}
        >
          <div className={`${baseClass}__main`}>
            <Meta
              title={label}
              description={label}
              keywords={`${label}, Payload, CMS`}
            />
            <Eyebrow />
            {!(global.versions?.drafts && global.versions?.drafts?.autosave) && (
              <LeaveWithoutSaving />
            )}
            <div className={`${baseClass}__edit`}>
              <header className={`${baseClass}__header`}>
                <h1>
                  Edit
                  {' '}
                  {label}
                </h1>
                {description && (
                <div className={`${baseClass}__sub-header`}>
                  <ViewDescription description={description} />
                </div>
                )}
              </header>
              <RenderFields
                operation="update"
                readOnly={!hasSavePermission}
                permissions={permissions.fields}
                filter={(field) => (!field.admin.position || (field.admin.position && field.admin.position !== 'sidebar'))}
                fieldTypes={fieldTypes}
                fieldSchema={fields}
              />
            </div>
          </div>
          <div className={`${baseClass}__sidebar-wrap`}>
            <div className={`${baseClass}__sidebar`}>
              <div className={`${baseClass}__sidebar-sticky-wrap`}>
                <div className={`${baseClass}__document-actions${preview ? ` ${baseClass}__document-actions--with-preview` : ''}`}>
                  <PreviewButton
                    generatePreviewURL={preview}
                    data={data}
                  />
                  {hasSavePermission && (
                    <FormSubmit>Save</FormSubmit>
                  )}
                </div>
                <div className={`${baseClass}__sidebar-fields`}>
                  <RenderFields
                    operation="update"
                    readOnly={!hasSavePermission}
                    permissions={permissions.fields}
                    filter={(field) => field.admin.position === 'sidebar'}
                    fieldTypes={fieldTypes}
                    fieldSchema={fields}
                  />
                </div>
                <ul className={`${baseClass}__meta`}>
                  {versions && (
                    <li>
                      <div className={`${baseClass}__label`}>Versions</div>
                      <VersionsCount global={global} />
                    </li>
                  )}
                  {(data && !hideAPIURL) && (
                    <li className={`${baseClass}__api-url`}>
                      <span className={`${baseClass}__label`}>
                        API URL
                        {' '}
                        <CopyToClipboard value={apiURL} />
                      </span>
                      <a
                        href={apiURL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {apiURL}
                      </a>
                    </li>
                  )}
                  {data.updatedAt && (
                    <li>
                      <div className={`${baseClass}__label`}>Last Modified</div>
                      <div>{format(new Date(data.updatedAt as string), dateFormat)}</div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </Form>
      )}
    </div>
  );
};

export default DefaultGlobalView;
