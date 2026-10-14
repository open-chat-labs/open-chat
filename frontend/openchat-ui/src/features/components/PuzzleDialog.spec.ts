import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import PuzzleDialog from './PuzzleDialog.svelte';

const deferred = <T = void>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};
const press = (el: Element | null | undefined) => (el as HTMLElement).click();
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

// two islands that need one bridge between them: solved by bridge 0-1 × 1
const puzzle = { id: 'p1', number: 7, grid: 4, islands: [[0, 0, 1] as [number, number, number], [3, 0, 1] as [number, number, number]] };

describe('PuzzleDialog hints and checks', () => {
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

  function open(opts: { onHint?: () => Promise<[number, number, number]>; onSolved?: () => Promise<void> }) {
    const onClose = vi.fn();
    const onHint = vi.fn(opts.onHint ?? (() => Promise.resolve([0, 1, 1] as [number, number, number])));
    const onSolved = vi.fn(opts.onSolved ?? (() => Promise.resolve()));
    app = mount(PuzzleDialog, { target, props: { puzzle, tutorialSeen: true, puzzleStreak: 1, balance: 100, hintCost: 10, hintsAllowed: 3, onHint, onSolved, onClose } });
    flushSync();
    const islands = () => [...target.querySelectorAll('.island')];
    const bridge = () => {
      press(islands()[0]);
      flushSync();
      press(islands()[1]);
      flushSync();
    };
    return { onClose, onHint, onSolved, bridge, hint: () => press(target.querySelector('.hint')) };
  }

  test('nothing closes while a hint is being bought', async () => {
    const d = deferred<[number, number, number]>();
    const { onClose, hint } = open({ onHint: () => d.promise });
    hint();
    await settle();
    esc();
    press(target.querySelector('.veil'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a complete board waits for a pending hint before it is checked', async () => {
    const d = deferred<[number, number, number]>();
    const { onSolved, bridge, hint } = open({ onHint: () => d.promise });
    hint();
    await settle();
    bridge(); // the board is now complete
    await vi.advanceTimersByTimeAsync(1000);
    expect(onSolved).not.toHaveBeenCalled();
    d.resolve([0, 1, 1]);
    await settle();
    await vi.advanceTimersByTimeAsync(600);
    expect(onSolved).toHaveBeenCalledOnce();
    expect(((onSolved.mock.calls[0] as unknown[])[0])).toMatchObject({ puzzleId: 'p1', bridges: { '0-1': 1 }, hints: 1 });
  });

  test('a paid hint that lands while the tutorial is open is still applied', async () => {
    const d = deferred<[number, number, number]>();
    const { onSolved, hint } = open({ onHint: () => d.promise });
    hint();
    await settle();
    press(target.querySelectorAll('.head-button')[0]); // how to play
    flushSync();
    d.resolve([0, 1, 1]);
    await settle();
    await vi.advanceTimersByTimeAsync(600);
    expect(onSolved).toHaveBeenCalledOnce();
    expect(((onSolved.mock.calls[0] as unknown[])[0])).toMatchObject({ bridges: { '0-1': 1 }, hints: 1 });
  });

  test('nothing closes while the board is being checked, and the board is locked', async () => {
    const d = deferred();
    const { onClose, onSolved, bridge } = open({ onSolved: () => d.promise });
    bridge();
    await vi.advanceTimersByTimeAsync(600);
    expect(onSolved).toHaveBeenCalledOnce();
    esc();
    press(target.querySelector('.veil'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(onClose).not.toHaveBeenCalled();
    expect((target.querySelector('.island') as HTMLButtonElement).disabled).toBe(true);
  });

  test('a failed check offers Check again, which resubmits', async () => {
    const { onSolved, bridge } = open({ onSolved: () => Promise.reject(new Error('no')) });
    bridge();
    await vi.advanceTimersByTimeAsync(600);
    flushSync();
    const retry = target.querySelector('.retry');
    expect(retry).not.toBeNull();
    press(retry);
    await settle();
    expect(onSolved).toHaveBeenCalledTimes(2);
  });

  test('a hint is not bought while the dialog is leaving', async () => {
    const { onHint, hint } = open({});
    press(target.querySelector('.veil'));
    hint();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onHint).not.toHaveBeenCalled();
  });
});
