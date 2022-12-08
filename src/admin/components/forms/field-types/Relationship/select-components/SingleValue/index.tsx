import React, { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { components as SelectComponents, SingleValueProps } from 'react-select';
import { useDocumentDrawer } from '../../../../../elements/DocumentDrawer';
import Tooltip from '../../../../../elements/Tooltip';
import Edit from '../../../../../icons/Edit';
import { useAuth } from '../../../../../utilities/Auth';
import { Option } from '../../types';
import './index.scss';

const baseClass = 'single-value';

export const SingleValue: React.FC<SingleValueProps<Option>> = (props) => {
  const {
    data: {
      value,
      relationTo,
      label,
    },
    children,
    selectProps: {
      selectProps: {
        setDrawerIsOpen,
      },
    },
  } = props;

  const [showTooltip, setShowTooltip] = useState(false);
  const { t } = useTranslation('general');
  const { permissions } = useAuth();
  const hasReadPermission = Boolean(permissions?.collections?.[relationTo]?.read?.permission);

  const [DocumentDrawer, DocumentDrawerToggler, { isDrawerOpen }] = useDocumentDrawer({
    id: value.toString(),
    collectionSlug: relationTo,
  });

  useEffect(() => {
    if (typeof setDrawerIsOpen === 'function') setDrawerIsOpen(isDrawerOpen);
  }, [isDrawerOpen, setDrawerIsOpen]);

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__label`}>
        <SelectComponents.SingleValue {...props}>
          {children}
          {relationTo && hasReadPermission && (
            <Fragment>
              <DocumentDrawerToggler
                className={`${baseClass}__drawer-toggler`}
                aria-label={`Edit ${label}`}
                onMouseDown={(e) => e.stopPropagation()} // prevents react-select dropdown from opening
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(false)}
              >
                <Tooltip
                  className={`${baseClass}__tooltip`}
                  show={showTooltip}
                  delay={350}
                >
                  {t('editLabel', { label: '' })}
                </Tooltip>
                <Edit />
              </DocumentDrawerToggler>
            </Fragment>
          )}
        </SelectComponents.SingleValue>
      </div>
      {relationTo && hasReadPermission && (
        <DocumentDrawer />
      )}
    </div>
  );
};
