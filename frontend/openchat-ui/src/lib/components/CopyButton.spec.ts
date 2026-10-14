import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import CopyButton from './CopyButton.svelte';

describe('CopyButton', () => {
  const mounted: object[] = [];
  afterEach(() => {
    mounted.splice(0).forEach((c) => unmount(c));
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function setup(writeText: (s: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onCopy = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    mounted.push(mount(CopyButton, { target, props: { value: 'abc', onCopy } }));
    return { onCopy, button: target.querySelector<HTMLElement>('[role=button]')! };
  }

  test('shows the check and calls onCopy only after the write succeeds', async () => {
    const write = vi.fn(() => Promise.resolve());
    const { onCopy, button } = setup(write);
    button.click();
    await vi.waitFor(() => expect(onCopy).toHaveBeenCalledOnce());
    flushSync();
    expect(write).toHaveBeenCalledWith('abc');
    expect(button.classList.contains('done')).toBe(true);
  });

  test('a rejected write shows nothing', async () => {
    const { onCopy, button } = setup(() => Promise.reject(new Error('denied')));
    button.click();
    await new Promise((r) => setTimeout(r, 0));
    flushSync();
    expect(onCopy).not.toHaveBeenCalled();
    expect(button.classList.contains('done')).toBe(false);
  });
});
