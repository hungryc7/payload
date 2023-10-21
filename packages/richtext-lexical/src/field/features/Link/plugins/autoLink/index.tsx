'use client'
import type { ElementNode, LexicalEditor, LexicalNode } from 'lexical'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import { $createTextNode, $isElementNode, $isLineBreakNode, $isTextNode, TextNode } from 'lexical'
import { useEffect } from 'react'

import { invariant } from '../../../../lexical/utils/invariant'
import { $createAutoLinkNode, $isAutoLinkNode, AutoLinkNode } from '../../nodes/AutoLinkNode'
import { $isLinkNode, type LinkFields } from '../../nodes/LinkNode'

type ChangeHandler = (url: null | string, prevUrl: null | string) => void

interface LinkMatcherResult {
  fields?: LinkFields
  index: number
  length: number
  text: string
  url: string
}

export type LinkMatcher = (text: string) => LinkMatcherResult | null

export function createLinkMatcherWithRegExp(
  regExp: RegExp,
  urlTransformer: (text: string) => string = (text) => text,
) {
  return (text: string) => {
    const match = regExp.exec(text)
    if (match === null) return null
    return {
      index: match.index,
      length: match[0].length,
      text: match[0],
      url: urlTransformer(text),
    }
  }
}

function findFirstMatch(text: string, matchers: LinkMatcher[]): LinkMatcherResult | null {
  for (let i = 0; i < matchers.length; i++) {
    const match = matchers[i](text)

    if (match != null) {
      return match
    }
  }

  return null
}

const PUNCTUATION_OR_SPACE = /[.,;\s]/

function isSeparator(char: string): boolean {
  return PUNCTUATION_OR_SPACE.test(char)
}

function endsWithSeparator(textContent: string): boolean {
  return isSeparator(textContent[textContent.length - 1])
}

function startsWithSeparator(textContent: string): boolean {
  return isSeparator(textContent[0])
}

function isPreviousNodeValid(node: LexicalNode): boolean {
  let previousNode = node.getPreviousSibling()
  if ($isElementNode(previousNode)) {
    previousNode = previousNode.getLastDescendant()
  }
  return (
    previousNode === null ||
    $isLineBreakNode(previousNode) ||
    ($isTextNode(previousNode) && endsWithSeparator(previousNode.getTextContent()))
  )
}

function isNextNodeValid(node: LexicalNode): boolean {
  let nextNode = node.getNextSibling()
  if ($isElementNode(nextNode)) {
    nextNode = nextNode.getFirstDescendant()
  }
  return (
    nextNode === null ||
    $isLineBreakNode(nextNode) ||
    ($isTextNode(nextNode) && startsWithSeparator(nextNode.getTextContent()))
  )
}

function isContentAroundIsValid(
  matchStart: number,
  matchEnd: number,
  text: string,
  node: TextNode,
): boolean {
  const contentBeforeIsValid =
    matchStart > 0 ? isSeparator(text[matchStart - 1]) : isPreviousNodeValid(node)
  if (!contentBeforeIsValid) {
    return false
  }

  const contentAfterIsValid =
    matchEnd < text.length ? isSeparator(text[matchEnd]) : isNextNodeValid(node)
  return contentAfterIsValid
}

function handleLinkCreation(
  node: TextNode,
  matchers: LinkMatcher[],
  onChange: ChangeHandler,
): void {
  const nodeText = node.getTextContent()
  let text = nodeText
  let invalidMatchEnd = 0
  let remainingTextNode = node
  let match

  while ((match = findFirstMatch(text, matchers)) != null && match !== null) {
    const matchStart: number = match.index
    const matchLength: number = match.length
    const matchEnd = matchStart + matchLength
    const isValid = isContentAroundIsValid(
      invalidMatchEnd + matchStart,
      invalidMatchEnd + matchEnd,
      nodeText,
      node,
    )

    if (isValid) {
      let linkTextNode
      if (invalidMatchEnd + matchStart === 0) {
        ;[linkTextNode, remainingTextNode] = remainingTextNode.splitText(
          invalidMatchEnd + matchLength,
        )
      } else {
        ;[, linkTextNode, remainingTextNode] = remainingTextNode.splitText(
          invalidMatchEnd + matchStart,
          invalidMatchEnd + matchStart + matchLength,
        )
      }
      const fields: LinkFields = {
        linkType: 'custom',
        url: match.url,
        ...match.attributes,
      }

      const linkNode = $createAutoLinkNode({ fields })
      const textNode = $createTextNode(match.text)
      textNode.setFormat(linkTextNode.getFormat())
      textNode.setDetail(linkTextNode.getDetail())
      linkNode.append(textNode)
      linkTextNode.replace(linkNode)
      onChange(match.url, null)
      invalidMatchEnd = 0
    } else {
      invalidMatchEnd += matchEnd
    }

    text = text.substring(matchEnd)
  }
}

function handleLinkEdit(
  linkNode: AutoLinkNode,
  matchers: LinkMatcher[],
  onChange: ChangeHandler,
): void {
  // Check children are simple text
  const children = linkNode.getChildren()
  const childrenLength = children.length
  for (let i = 0; i < childrenLength; i++) {
    const child = children[i]
    if (!$isTextNode(child) || !child.isSimpleText()) {
      replaceWithChildren(linkNode)
      onChange(null, linkNode.getFields()?.url ?? null)
      return
    }
  }

  // Check text content fully matches
  const text = linkNode.getTextContent()
  const match = findFirstMatch(text, matchers)
  if (match === null || match.text !== text) {
    replaceWithChildren(linkNode)
    onChange(null, linkNode.getFields()?.url ?? null)
    return
  }

  // Check neighbors
  if (!isPreviousNodeValid(linkNode) || !isNextNodeValid(linkNode)) {
    replaceWithChildren(linkNode)
    onChange(null, linkNode.getFields()?.url ?? null)
    return
  }

  const url = linkNode.getFields()?.url
  if (url !== match?.url) {
    const flds = linkNode.getFields()
    flds.url = match?.url
    linkNode.setFields(flds)
    onChange(match.url, url ?? null)
  }
}

// Bad neighbours are edits in neighbor nodes that make AutoLinks incompatible.
// Given the creation preconditions, these can only be simple text nodes.
function handleBadNeighbors(
  textNode: TextNode,
  matchers: LinkMatcher[],
  onChange: ChangeHandler,
): void {
  const previousSibling = textNode.getPreviousSibling()
  const nextSibling = textNode.getNextSibling()
  const text = textNode.getTextContent()

  if ($isAutoLinkNode(previousSibling) && !startsWithSeparator(text)) {
    previousSibling.append(textNode)
    handleLinkEdit(previousSibling, matchers, onChange)
    onChange(null, previousSibling.getFields()?.url ?? null)
  }

  if ($isAutoLinkNode(nextSibling) && !endsWithSeparator(text)) {
    replaceWithChildren(nextSibling)
    handleLinkEdit(nextSibling, matchers, onChange)
    onChange(null, nextSibling.getFields()?.url ?? null)
  }
}

function replaceWithChildren(node: ElementNode): LexicalNode[] {
  const children = node.getChildren()
  const childrenLength = children.length

  for (let j = childrenLength - 1; j >= 0; j--) {
    node.insertAfter(children[j])
  }

  node.remove()
  return children.map((child) => child.getLatest())
}

function useAutoLink(
  editor: LexicalEditor,
  matchers: LinkMatcher[],
  onChange?: ChangeHandler,
): void {
  useEffect(() => {
    if (!editor.hasNodes([AutoLinkNode])) {
      invariant(false, 'LexicalAutoLinkPlugin: AutoLinkNode not registered on editor')
    }

    const onChangeWrapped = (url: null | string, prevUrl: null | string): void => {
      if (onChange != null) {
        onChange(url, prevUrl)
      }
    }

    return mergeRegister(
      editor.registerNodeTransform(TextNode, (textNode: TextNode) => {
        const parent = textNode.getParentOrThrow()
        const previous = textNode.getPreviousSibling()
        if ($isAutoLinkNode(parent)) {
          handleLinkEdit(parent, matchers, onChangeWrapped)
        } else if (!$isLinkNode(parent)) {
          if (
            textNode.isSimpleText() &&
            (startsWithSeparator(textNode.getTextContent()) || !$isAutoLinkNode(previous))
          ) {
            handleLinkCreation(textNode, matchers, onChangeWrapped)
          }

          handleBadNeighbors(textNode, matchers, onChangeWrapped)
        }
      }),
    )
  }, [editor, matchers, onChange])
}

const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-\w@:%.+~#=]{1,256}\.[a-zA-Z\d()]{1,6}\b([-\w()@:%+.~#?&/=]*)/

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\])|(([a-zA-Z\-\d]+\.)+[a-zA-Z]{2,}))/

const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => {
    return text.startsWith('http') ? text : `https://${text}`
  }),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => {
    return `mailto:${text}`
  }),
]

export function AutoLinkPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext()

  useAutoLink(editor, MATCHERS)

  return null
}
