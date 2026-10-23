import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { reactiveProps } from '../testing/reactiveProps.svelte';
import type { ComposerContext } from '../types';
import MessageComposer from './MessageComposer.svelte';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};
const edit = (key: string, text: string): ComposerContext => ({ key, mode: 'edit', quote: text, text });
const reply = (key: string): ComposerContext => ({ key, mode: 'reply', name: 'Bob', quote: 'hi' });

describe('MessageComposer reply / edit context', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
    vi.useRealTimers();
  });

  function open() {
    const onSubmitEdit = vi.fn();
    const onSend = vi.fn();
    const props = reactiveProps({ context: null as ComposerContext | null, onSubmitEdit, onSend });
    app = mount(MessageComposer, { target, props });
    flushSync();
    return { props, onSubmitEdit, onSend };
  }
  const box = () => target.querySelector<HTMLTextAreaElement>('textarea')!;
  function type(text: string) {
    box().value = text;
    box().dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  }
  const enter = () => box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

  test('edit pre-fills the original text; leaving it for a reply restores the unsent draft, not the edited text', async () => {
    const { props } = open();
    type('my draft');
    props.context = edit('a', 'message A');
    await settle();
    expect(box().value).toBe('message A');
    type('message A, changed');
    props.context = reply('b');
    await settle();
    expect(box().value).toBe('my draft');
  });

  test('edit A → edit B → cancel restores the draft from before the first edit', async () => {
    const { props } = open();
    type('my draft');
    props.context = edit('a', 'message A');
    await settle();
    props.context = edit('b', 'message B');
    await settle();
    expect(box().value).toBe('message B');
    props.context = null;
    await settle();
    expect(box().value).toBe('my draft');
  });

  test('an emptied edit is not submitted; a changed one is, trimmed', async () => {
    const { props, onSubmitEdit, onSend } = open();
    props.context = edit('a', 'message A');
    await settle();
    type('   ');
    enter();
    await settle();
    expect(onSubmitEdit).not.toHaveBeenCalled();
    type(' fixed ');
    enter();
    await settle();
    expect(onSubmitEdit).toHaveBeenCalledExactlyOnceWith('fixed');
    expect(onSend).not.toHaveBeenCalled();
  });

  test('a reply keeps what was being typed', async () => {
    const { props } = open();
    type('my draft');
    props.context = reply('b');
    await settle();
    expect(box().value).toBe('my draft');
  });
});

describe('MessageComposer autofocus', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(autofocus?: boolean) {
    app = mount(MessageComposer, { target, props: autofocus === undefined ? {} : { autofocus } });
    flushSync();
    return target.querySelector<HTMLTextAreaElement>('textarea')!;
  }

  test('focuses the text box as it mounts', () => {
    const box = open(true);
    expect(document.activeElement).toBe(box);
  });

  test('leaves focus alone by default', () => {
    const box = open();
    expect(document.activeElement).not.toBe(box);
  });

  test('leaves focus in a dialog that is already open', () => {
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('aria-modal', 'true');
    const button = dialog.appendChild(document.createElement('button'));
    button.focus();
    try {
      open(true);
      expect(document.activeElement).toBe(button);
    } finally {
      dialog.remove();
    }
  });
});
