import { $isRangeSelection, FORMAT_TEXT_COMMAND } from 'lexical'

import type { FeatureProvider } from '../../types'

import { CodeIcon } from '../../../lexical/ui/icons/Code'
import { SectionWithEntries } from '../common/floatingSelectToolbarSection'
import { INLINE_CODE } from './markdownTransformers'

export const InlineCodeTextFeature = (): FeatureProvider => {
  return {
    feature: ({ featureProviderMap }) => {
      return {
        floatingSelectToolbar: {
          sections: [
            SectionWithEntries([
              {
                ChildComponent: CodeIcon,
                isActive: ({ editor, selection }) => {
                  if ($isRangeSelection(selection)) {
                    return selection.hasFormat('code')
                  }
                  return false
                },
                key: 'code',
                onClick: ({ editor }) => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
                },
                order: 7,
              },
            ]),
          ],
        },
        markdownTransformers: [INLINE_CODE],
        props: null,
      }
    },
    key: 'inlineCode',
  }
}
