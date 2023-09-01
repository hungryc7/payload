import type { HTMLAttributes } from 'react'

import { useModal } from '@faceless-ui/modal'
import React, { useCallback, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Editor, Node, Transforms } from 'slate'
import { ReactEditor, useSlate } from 'slate-react'

import type { Fields } from '../../../../../Form/types'
import type { Props as RichTextFieldProps } from '../../../types'

import deepCopyObject from '../../../../../../../../utilities/deepCopyObject'
import { getTranslation } from '../../../../../../../../utilities/getTranslation'
import Button from '../../../../../../elements/Button'
import { useDrawerSlug } from '../../../../../../elements/Drawer/useDrawerSlug'
import Popup from '../../../../../../elements/Popup'
import { useAuth } from '../../../../../../utilities/Auth'
import { useConfig } from '../../../../../../utilities/Config'
import { useDocumentInfo } from '../../../../../../utilities/DocumentInfo'
import { useLocale } from '../../../../../../utilities/Locale'
import buildStateFromSchema from '../../../../../Form/buildStateFromSchema'
import reduceFieldsToValues from '../../../../../Form/reduceFieldsToValues'
import { LinkDrawer } from '../LinkDrawer'
import { transformExtraFields, unwrapLink } from '../utilities'
import './index.scss'

const baseClass = 'rich-text-link'

/**
 * This function is called when an existing link is edited.
 * When a link is first created, another function is called: {@link ../Button/index.tsx#insertLink}
 */
const insertChange = (editor, fields, customFieldSchema) => {
  const data = reduceFieldsToValues(fields, true)

  const [, parentPath] = Editor.above(editor)

  const newNode: Record<string, unknown> = {
    doc: data.doc,
    linkType: data.linkType,
    newTab: data.newTab,
    url: data.url,
  }

  if (customFieldSchema) {
    newNode.fields = data.fields
  }

  Transforms.setNodes(editor, newNode, { at: parentPath })

  Transforms.delete(editor, { at: editor.selection.focus.path, unit: 'block' })
  Transforms.move(editor, { distance: 1, unit: 'offset' })
  Transforms.insertText(editor, String(data.text), { at: editor.selection.focus.path })

  ReactEditor.focus(editor)
}

export const LinkElement: React.FC<{
  attributes: HTMLAttributes<HTMLDivElement>
  children: React.ReactNode
  editorRef: React.RefObject<HTMLDivElement>
  element: any
  fieldProps: RichTextFieldProps
}> = (props) => {
  const { attributes, children, editorRef, element, fieldProps } = props

  const customFieldSchema = fieldProps?.admin?.link?.fields

  const editor = useSlate()
  const config = useConfig()
  const { user } = useAuth()
  const { code: locale } = useLocale()
  const { i18n, t } = useTranslation('fields')
  const { closeModal, openModal, toggleModal } = useModal()
  const [renderModal, setRenderModal] = useState(false)
  const [renderPopup, setRenderPopup] = useState(false)
  const [initialState, setInitialState] = useState<Fields>({})
  const { getDocPreferences } = useDocumentInfo()
  const [fieldSchema] = useState(() => {
    const fields = transformExtraFields(customFieldSchema, config, i18n)

    return fields
  })

  const drawerSlug = useDrawerSlug('rich-text-link')

  const handleTogglePopup = useCallback((render) => {
    if (!render) {
      setRenderPopup(render)
    }
  }, [])

  useEffect(() => {
    const awaitInitialState = async () => {
      const data = {
        doc: element.doc,
        fields: deepCopyObject(element.fields),
        linkType: element.linkType,
        newTab: element.newTab,
        text: Node.string(element),
        url: element.url,
      }

      const preferences = await getDocPreferences()
      const state = await buildStateFromSchema({
        data,
        fieldSchema,
        locale,
        operation: 'update',
        preferences,
        t,
        user,
      })
      setInitialState(state)
    }

    awaitInitialState()
  }, [renderModal, element, fieldSchema, user, locale, t, getDocPreferences])

  return (
    <span className={baseClass} {...attributes}>
      <span contentEditable={false} style={{ userSelect: 'none' }}>
        {renderModal && (
          <LinkDrawer
            handleClose={() => {
              toggleModal(drawerSlug)
              setRenderModal(false)
            }}
            handleModalSubmit={(fields) => {
              insertChange(editor, fields, customFieldSchema)
              closeModal(drawerSlug)
            }}
            drawerSlug={drawerSlug}
            fieldSchema={fieldSchema}
            initialState={initialState}
          />
        )}
        <Popup
          render={() => (
            <div className={`${baseClass}__popup`}>
              {element.linkType === 'internal' && element.doc?.relationTo && element.doc?.value && (
                <Trans
                  values={{
                    label: getTranslation(
                      config.collections.find(({ slug }) => slug === element.doc.relationTo)?.labels
                        ?.singular,
                      i18n,
                    ),
                  }}
                  i18nKey="fields:linkedTo"
                >
                  <a
                    className={`${baseClass}__link-label`}
                    href={`${config.routes.admin}/collections/${element.doc.relationTo}/${element.doc.value}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    label
                  </a>
                </Trans>
              )}
              {(element.linkType === 'custom' || !element.linkType) && (
                <a
                  className={`${baseClass}__link-label`}
                  href={element.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {element.url}
                </a>
              )}
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  setRenderPopup(false)
                  openModal(drawerSlug)
                  setRenderModal(true)
                }}
                buttonStyle="icon-label"
                className={`${baseClass}__link-edit`}
                icon="edit"
                round
                tooltip={t('general:edit')}
              />
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  unwrapLink(editor)
                }}
                buttonStyle="icon-label"
                className={`${baseClass}__link-close`}
                icon="x"
                round
                tooltip={t('general:remove')}
              />
            </div>
          )}
          boundingRef={editorRef}
          buttonType="none"
          forceOpen={renderPopup}
          horizontalAlign="left"
          onToggleOpen={handleTogglePopup}
          size="small"
          verticalAlign="bottom"
        />
      </span>
      <span
        onKeyDown={(e) => {
          if (e.key === 'Enter') setRenderPopup(true)
        }}
        className={[`${baseClass}__popup-toggler`].filter(Boolean).join(' ')}
        onClick={() => setRenderPopup(true)}
        role="button"
        tabIndex={0}
      >
        {children}
      </span>
    </span>
  )
}
