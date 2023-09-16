import React, { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useRouteMatch } from 'react-router-dom'

import type { SanitizedCollectionConfig, SanitizedGlobalConfig } from '../../../../../exports/types'

import { useConfig } from '../../../utilities/Config'
import { useDocumentInfo } from '../../../utilities/DocumentInfo'
import './index.scss'

const baseClass = 'doc-tabs'

const baseTabs = [
  {
    label: 'Edit',
    path: '',
  },
  {
    label: 'Versions',
    path: 'versions',
  },
]

export const DocumentTabs: React.FC<{
  apiURL: string
  collection?: SanitizedCollectionConfig
  global?: SanitizedGlobalConfig
  id: string
  isEditing?: boolean
}> = (props) => {
  const { apiURL, collection, global, id, isEditing } = props
  const match = useRouteMatch()
  const location = useLocation()
  const { t } = useTranslation('general')

  const {
    routes: { admin },
  } = useConfig()

  const { versions } = useDocumentInfo()

  const tabs = [
    ...baseTabs,
    // TODO: extract overrides and custom views from collection config
  ]

  let docURL: string
  let versionsURL: string
  let editTabActive = false

  if (collection) {
    docURL = `${admin}/collections/${collection.slug}/${id}`
    versionsURL = `${docURL}/versions`
    editTabActive =
      location.pathname === `${admin}/collections/${collection.slug}` ||
      location.pathname === `${admin}/collections/${collection.slug}/create` ||
      location.pathname === docURL
  }

  if (global) {
    docURL = `${admin}/globals/${global.slug}`
    versionsURL = `${docURL}/versions`
    editTabActive =
      location.pathname === `${admin}/globals/${global.slug}` || location.pathname === docURL
  }

  // Don't show tabs when creating new documents
  if ((tabs && collection && isEditing) || global) {
    return (
      <ul className={baseClass}>
        <li
          className={[`${baseClass}__tab`, editTabActive && `${baseClass}__tab--active`]
            .filter(Boolean)
            .join(' ')}
        >
          <Link className={`${baseClass}__tab-link`} to={docURL}>
            <div className={`${baseClass}__tab-label`}>{t('edit')}</div>
          </Link>
        </li>
        {(collection?.versions || global?.versions) && (
          <li
            className={[
              `${baseClass}__tab`,
              location.pathname.startsWith(versionsURL) && `${baseClass}__tab--active`,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <Link className={`${baseClass}__tab-link`} to={versionsURL}>
              <div className={`${baseClass}__tab-label`}>
                {t('version:versions')}
                {typeof versions?.totalDocs === 'number' && versions?.totalDocs > 0 && (
                  <Fragment>
                    &nbsp;
                    <span className={`${baseClass}__count`}>{versions?.totalDocs}</span>
                  </Fragment>
                )}
              </div>
            </Link>
          </li>
        )}
        {(!collection?.admin?.hideAPIURL || !global?.admin?.hideAPIURL) && (
          <li
            className={[`${baseClass}__tab`, match.url === apiURL && `${baseClass}__tab--active`]
              .filter(Boolean)
              .join(' ')}
          >
            <Link
              className={`${baseClass}__tab-link`}
              rel="noopener noreferrer"
              target="_blank"
              to={apiURL}
            >
              <div className={`${baseClass}__tab-label`}>API</div>
            </Link>
          </li>
        )}
        {/* {tabs.map((tab) => {
          const tabHref = `${match.url}${tab.path ? `/${tab.path}` : ''}`
          const isActive = location.pathname === tabHref

          return (
            <li
              className={[`${baseClass}__tab`, isActive && `${baseClass}__tab--active`]
                .filter(Boolean)
                .join(' ')}
              key={tab.label}
            >
              <Link className={`${baseClass}__tab-link`} to={tabHref}>
                <span className={`${baseClass}__tab-label`}>{tab.label}</span>
              </Link>
            </li>
          )
        })} */}
      </ul>
    )
  }

  return null
}
