import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { reactiveProps } from '../testing/reactiveProps.svelte';
import ContextMenu from './ContextMenu.svelte';
import DialogShell from './DialogShell.svelte';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const esc = (on: EventTarget = document.body) => on.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('ContextMenu over a DialogShell', () => {
  let target: HTMLElement;
  let apps: object[];
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
    apps = [];
  });
  afterEach(() => {
    apps.forEach((a) => unmount(a));
    target.remove();
    vi.useRealTimers();
  });

  /** A dialog with an opener button, and a context menu open over it (opened from that button). */
  async function open() {
    const onDialogClose = vi.fn();
    apps.push(mount(DialogShell, { target, props: { title: 'Dialog', onClose: onDialogClose } }));
    // the dialog has taken focus on open before the menu is opened
    await vi.advanceTimersByTimeAsync(100);
    const opener = target.appendChild(document.createElement('button'));
    opener.focus();
    const props = reactiveProps({
      open: true,
      items: [{ label: 'Copy' }, { label: 'Delete' }],
      point: { x: 10, y: 10 },
      onClose: vi.fn(() => (props.open = false)),
    });
    apps.push(mount(ContextMenu, { target, props }));
    flushSync();
    await vi.advanceTimersByTimeAsync(100);
    flushSync();
    return { onDialogClose, opener, props };
  }

  test('Esc closes the menu only, not the dialog around it; focus goes back to the opener', async () => {
    const { onDialogClose, opener, props } = await open();
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    esc(document.activeElement!);
    flushSync();
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(onDialogClose).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(document.activeElement).toBe(opener);
    // with the menu gone, the next Esc closes the dialog
    esc();
    expect(onDialogClose).toHaveBeenCalledOnce();
  });

  test('pressing elsewhere closes the menu without pulling focus back to the opener', async () => {
    const { opener, props } = await open();
    const elsewhere = target.appendChild(document.createElement('input'));
    // jsdom has no PointerEvent
    elsewhere.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    elsewhere.focus();
    flushSync();
    expect(props.onClose).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(50);
    expect(document.activeElement).toBe(elsewhere);
    expect(document.activeElement).not.toBe(opener);
  });

  test('DialogShell ignores an Esc an inner control already handled', async () => {
    const onClose = vi.fn();
    apps.push(mount(DialogShell, { target, props: { title: 'Dialog', onClose } }));
    flushSync();
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);
    expect(onClose).not.toHaveBeenCalled();
    esc(window);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
