import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletReceive from './WalletReceive.svelte';

// jsdom has no ResizeObserver (bind:clientWidth); the wide layout is used
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};
const icp: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 1, price: 5, dp: 4, nets: ['icp'] };
const ADDRESS = '5sj6i-pqaaa-aaaaf-a3cmq-cai';
const qr = createRawSnippet(() => ({ render: () => '<svg viewBox="0 0 21 21"><rect width="1" height="1"/></svg>' }));
class FakeItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

describe('WalletReceive', () => {
  let target: HTMLElement;
  let app: object | undefined;
  let write: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
    write = vi.fn(async (items: FakeItem[]) => {
      await items[0].items['image/png'];
    });
    writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { write, writeText }, configurable: true });
    vi.stubGlobal('ClipboardItem', FakeItem);
    // drawing stand-ins: jsdom can't rasterise
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ fillRect: () => {}, drawImage: () => {} }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback, type?: string) => cb(new Blob(['png'], { type })));
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: async () => {}, configurable: true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { value: 21, configurable: true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { value: 21, configurable: true });
  });
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    target.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function open(props: Record<string, unknown> = {}) {
    app = mount(WalletReceive, { target, props: { tokens: [icp], token: 'ICP', addresses: { icp: ADDRESS }, qr, ...props } });
    flushSync();
  }
  const text = () => target.textContent ?? '';
  const qrCopy = () => target.querySelector<HTMLElement>('.qr-copy');

  test('the address card holds the QR the host draws, the address, and Copy', () => {
    open();
    const card = target.querySelector('.address-card')!;
    expect(card.querySelector('.qr svg')).not.toBeNull();
    expect(card.textContent).toContain(ADDRESS);
    expect(card.querySelector('.actions .copy')).not.toBeNull();
  });

  test('Copy QR image writes a PNG and confirms with a toast', async () => {
    open();
    qrCopy()!.click();
    await settle();
    expect(write).toHaveBeenCalledOnce();
    expect(await (write.mock.calls[0][0][0] as FakeItem).items['image/png']).toBeInstanceOf(Blob);
    expect(text()).toContain('QR copied as image');
  });

  test('a refused write says the copy failed, not that it worked', async () => {
    write.mockRejectedValueOnce(new Error('denied'));
    open();
    qrCopy()!.click();
    await settle();
    expect(text()).toContain("Couldn't copy the QR image");
    expect(text()).not.toContain('QR copied as image');
  });

  test('right-clicking the QR copies it instead of the browser menu', async () => {
    open();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    target.querySelector('.qr-box')!.dispatchEvent(menu);
    await settle();
    expect(menu.defaultPrevented).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  });

  test('where images cannot be copied: no Copy QR button, and right-click keeps the browser menu', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    open();
    expect(qrCopy()).toBeNull();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    target.querySelector('.qr-box')!.dispatchEvent(menu);
    await settle();
    expect(menu.defaultPrevented).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  test('Copy reads "Copied" only once the clipboard took the address', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    open();
    const copy = () => target.querySelector<HTMLElement>('.actions .copy')!;
    copy().click();
    await settle();
    expect(copy().textContent).toBe('Copy');
    copy().click();
    await settle();
    expect(writeText).toHaveBeenLastCalledWith(ADDRESS);
    expect(copy().textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(1600);
    flushSync();
    expect(copy().textContent).toBe('Copy');
  });

  test('without a qr renderer the card has no QR; without an address, no QR or actions', () => {
    open({ qr: undefined });
    expect(target.querySelector('.qr-box')).toBeNull();
    expect(target.querySelector('.actions .copy')).not.toBeNull();
    unmount(app!);
    open({ addresses: {} });
    expect(target.querySelector('.qr-box')).toBeNull();
    expect(target.querySelector('.actions .copy')).toBeNull();
    expect(text()).toContain('No address for this network yet.');
  });

  test('sharing keeps the picker until the host has posted, then confirms', async () => {
    let finish!: () => void;
    const onShare = vi.fn(() => new Promise<void>((r) => (finish = r)));
    open({ chats: [{ id: 'c1', name: 'Lucy' }], onShare });
    target.querySelector<HTMLElement>('.share-address')!.click();
    flushSync();
    document.querySelector<HTMLElement>('.chat')!.click();
    flushSync();
    [...document.querySelectorAll<HTMLElement>('.actions [role=button], .actions button')].find((b) => b.textContent?.trim() === 'Send')!.click();
    await settle();
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'c1', symbol: 'ICP', network: 'icp', address: ADDRESS }));
    expect(document.querySelector('.confirm')).not.toBeNull();
    finish();
    await settle();
    expect(document.querySelector('.confirm')).toBeNull();
    expect(text()).toContain('Address shared to Lucy');
  });
});
