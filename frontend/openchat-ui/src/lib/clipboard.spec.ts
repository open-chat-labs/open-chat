import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { canCopyImage, copyImage, copyText } from './clipboard';

// jsdom has no ClipboardItem, no canvas drawing and never loads images: each is stood in for here
const setDecode = (decode: () => Promise<void>) => Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: decode, configurable: true });
class FakeItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

describe('clipboard', () => {
  let write: ReturnType<typeof vi.fn>;
  let drawn: unknown[];
  beforeEach(() => {
    write = vi.fn(async (items: FakeItem[]) => {
      // the browser waits on the promised blob
      await items[0].items['image/png'];
    });
    Object.defineProperty(navigator, 'clipboard', { value: { write, writeText: vi.fn(async () => {}) }, configurable: true });
    vi.stubGlobal('ClipboardItem', FakeItem);
    drawn = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ fillRect: () => {}, drawImage: (img: unknown) => drawn.push(img), fillStyle: '' }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback, type?: string) {
      cb(new Blob(['png'], { type }));
    });
    setDecode(async () => {});
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { value: 21, configurable: true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { value: 21, configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const written = async () => {
    const item = write.mock.calls[0][0][0] as FakeItem;
    return item.items['image/png'];
  };

  test('copyText reports the outcome', async () => {
    expect(await copyText('a')).toBe(true);
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'));
    expect(await copyText('a')).toBe(false);
  });

  test('an svg is drawn as a standalone image and written as a PNG', async () => {
    document.body.innerHTML = '<div id="box"><svg viewBox="0 0 21 21" fill="currentColor"><rect width="1" height="1"/></svg></div>';
    expect(await copyImage(document.getElementById('box')!)).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect((await written()).type).toBe('image/png');
    const img = drawn[0] as HTMLImageElement;
    expect(img).toBeInstanceOf(HTMLImageElement);
    const svg = decodeURIComponent(img.src.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/width="21"/);
  });

  test('a canvas is drawn as it is', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    document.body.append(canvas);
    expect(await copyImage(canvas)).toBe(true);
    expect(drawn[0]).toBe(canvas);
  });

  test('the write starts before the image is ready (inside the gesture), with the blob still to come', async () => {
    let finish!: () => void;
    const ready = new Promise<void>((r) => (finish = r));
    setDecode(() => ready);
    document.body.innerHTML = '<svg viewBox="0 0 21 21"></svg>';
    const done = copyImage(document.querySelector('svg')!);
    expect(write).toHaveBeenCalledOnce();
    finish();
    expect(await done).toBe(true);
  });

  test('false when the write is refused, drawing fails, or there is nothing to copy', async () => {
    document.body.innerHTML = '<div id="box"><svg viewBox="0 0 21 21"></svg></div><div id="empty"></div>';
    write.mockRejectedValueOnce(new Error('denied'));
    expect(await copyImage(document.getElementById('box')!)).toBe(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => cb(null));
    expect(await copyImage(document.getElementById('box')!)).toBe(false);
    expect(await copyImage(document.getElementById('empty')!)).toBe(false);
  });

  test('unsupported without ClipboardItem or clipboard.write', async () => {
    expect(canCopyImage()).toBe(true);
    vi.stubGlobal('ClipboardItem', undefined);
    expect(canCopyImage()).toBe(false);
    document.body.innerHTML = '<svg viewBox="0 0 21 21"></svg>';
    expect(await copyImage(document.querySelector('svg')!)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
});
