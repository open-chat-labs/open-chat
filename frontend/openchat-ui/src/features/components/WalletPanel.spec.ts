import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletPanel from './WalletPanel.svelte';
import { reactiveProps } from '../../lib/testing/reactiveProps.svelte';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const tokens: WalletToken[] = [
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4 },
  { symbol: 'CHAT', name: 'OpenChat', mark: 'C', grad: 'teal', held: 100, price: 0.05, dp: 4 },
];
const symbols = (root: HTMLElement) => [...root.querySelectorAll('.token .symbol')].map((el) => el.textContent);

describe('WalletPanel hide / undo', () => {
  let target: HTMLElement;
  let app: object | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    target.remove();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function hide(symbol: string) {
    const row = [...target.querySelectorAll<HTMLElement>('.token')].find((r) => r.querySelector('.symbol')!.textContent === symbol)!;
    row.querySelector<HTMLElement>('.kebab')!.click();
    flushSync();
    const item = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((el) => el.textContent!.includes('Hide from list'))!;
    item.click();
    flushSync();
  }
  const undo = () => {
    document.querySelector<HTMLElement>('[role=status] .action')!.click();
    flushSync();
  };

  test('when the host owns `hidden`, Undo restores it through onHiddenChange', () => {
    const props = reactiveProps<Record<string, unknown>>({ tokens, settings: { autoConfig: false, tokens: ['ICP', 'CHAT'] }, hidden: [] as string[] });
    const onHiddenChange = vi.fn((next: string[]) => (props.hidden = next));
    props.onHiddenChange = onHiddenChange;
    app = mount(WalletPanel, { target, props: props as never });
    flushSync();
    hide('CHAT');
    expect(onHiddenChange).toHaveBeenLastCalledWith(['CHAT']);
    expect(symbols(target)).toEqual(['ICP']);
    undo();
    expect(onHiddenChange).toHaveBeenLastCalledWith([]);
    expect(symbols(target)).toContain('CHAT');
  });

  test('without a host, Undo restores the local list', () => {
    app = mount(WalletPanel, { target, props: { tokens, settings: { autoConfig: false, tokens: ['ICP', 'CHAT'] } } });
    flushSync();
    hide('CHAT');
    expect(symbols(target)).toEqual(['ICP']);
    undo();
    expect(symbols(target)).toContain('CHAT');
  });
});
