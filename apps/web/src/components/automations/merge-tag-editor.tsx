'use client';

import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

// The stored value is a plain string with {{tag}} tokens (what the backend
// renders). This editor only changes how tokens are drawn: each one shows as
// a non-editable chip with a readable label, and the DOM is serialized back
// to the token string on every edit.
const TOKEN_RE = /\{\{([^{}]+)\}\}/g;
const ZWSP = '​';

const CHIP_CLASS =
  'mx-0.5 inline-block select-none rounded-md bg-tag px-1.5 py-px align-baseline text-[0.8125rem] font-medium text-tag-foreground';

export type TagLabel = (tag: string) => string;

function makeChip(tag: string, labelFor: TagLabel): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.tag = tag;
  chip.className = CHIP_CLASS;
  chip.textContent = labelFor(tag);
  return chip;
}

function renderValue(root: HTMLElement, value: string, labelFor: TagLabel) {
  root.textContent = '';
  let last = 0;
  for (const match of value.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) root.append(document.createTextNode(value.slice(last, index)));
    root.append(makeChip(match[1], labelFor));
    last = index + match[0].length;
  }
  if (last < value.length) root.append(document.createTextNode(value.slice(last)));
}

function serialize(root: HTMLElement): string {
  let out = '';
  root.childNodes.forEach((node) => {
    if (node instanceof HTMLElement && node.dataset.tag) out += `{{${node.dataset.tag}}}`;
    else if (node.nodeName === 'BR') out += '\n';
    else out += (node.textContent ?? '').replaceAll(ZWSP, '');
  });
  return out;
}

function insertAtCaret(root: HTMLElement, nodes: Node[]) {
  const sel = window.getSelection();
  let range: Range;
  if (sel && sel.rangeCount > 0 && root.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0);
  } else {
    range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.deleteContents();
  for (const node of [...nodes].reverse()) range.insertNode(node);
  const lastNode = nodes[nodes.length - 1];
  if (lastNode.nodeType === Node.TEXT_NODE) range.setStart(lastNode, (lastNode.textContent ?? '').length);
  else range.setStartAfter(lastNode);
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Inserts a merge-tag chip at the caret of the editor with the given DOM id. */
export function insertTagIntoEditor(editorId: string, tag: string, labelFor: TagLabel): void {
  const el = document.getElementById(editorId);
  if (!el) return;
  el.focus();
  // The trailing zero-width text node gives the caret somewhere to sit after a chip.
  insertAtCaret(el, [makeChip(tag, labelFor), document.createTextNode(ZWSP)]);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

interface MergeTagEditorProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  labelFor: TagLabel;
  placeholder?: string;
  className?: string;
}

export function MergeTagEditor({ id, value, onChange, labelFor, placeholder, className }: MergeTagEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Re-render the DOM only when the value changed from outside (template
  // applied, step switched); edits made here already match, so the caret is left alone.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && serialize(el) !== value) renderValue(el, value, labelFor);
  }, [value, labelFor]);

  return (
    <div
      ref={ref}
      id={id}
      role="textbox"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck
      onInput={(e) => {
        const el = e.currentTarget;
        const next = serialize(el);
        if (next === '') el.textContent = '';
        onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          insertAtCaret(e.currentTarget, [document.createTextNode('\n'), document.createTextNode(ZWSP)]);
          e.currentTarget.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        insertAtCaret(e.currentTarget, [document.createTextNode(text)]);
        e.currentTarget.dispatchEvent(new Event('input', { bubbles: true }));
      }}
      className={cn(
        'w-full whitespace-pre-wrap break-words rounded-[var(--radius-control)] border border-border px-4 py-3 text-[0.9375rem] leading-relaxed text-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        'after:content-["\\200B"] empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
        className,
      )}
    />
  );
}
