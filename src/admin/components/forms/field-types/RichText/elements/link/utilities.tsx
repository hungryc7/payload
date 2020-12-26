import { Editor, Transforms, Range } from 'slate';

export const isLinkActive = (editor: Editor): boolean => {
  const [link] = Editor.nodes(editor, { match: (n) => n.type === 'link' });
  return !!link;
};

export const unwrapLink = (editor: Editor): void => {
  Transforms.unwrapNodes(editor, { match: (n) => n.type === 'link' });
};

export const wrapLink = (editor: Editor, url?: string, newTab?: boolean): void => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link = {
    type: 'link',
    url,
    newTab,
    children: isCollapsed ? [{ text: url }] : [],
  };

  if (isCollapsed) {
    Transforms.insertNodes(editor, link);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: 'end' });
  }
};

export const withLinks = (incomingEditor: Editor): Editor => {
  const editor = incomingEditor;
  const { isInline } = editor;

  editor.isInline = (element) => {
    if (element.type === 'link') {
      return true;
    }

    return isInline(element);
  };

  return editor;
};
