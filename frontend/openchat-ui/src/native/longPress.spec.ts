import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest';
import { LongPressGesture } from './longPress';

let fire: Mock<() => void>;
let gesture: LongPressGesture;

beforeEach(() => {
  vi.useFakeTimers();
  fire = vi.fn<() => void>();
  gesture = new LongPressGesture(fire);
});
afterEach(() => vi.useRealTimers());

describe('LongPressGesture', () => {
  test('a press held 450ms opens the menu, once', () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(449);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test('letting go first is a tap: nothing opens, and its click goes through', () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(300);
    gesture.up();
    vi.advanceTimersByTime(500);
    expect(fire).not.toHaveBeenCalled();
    expect(gesture.takeClick()).toBe(false);
  });

  test('moving more than 10px (|dx| + |dy|) is a scroll or a swipe, not a long-press', () => {
    gesture.down(100, 100);
    gesture.move(106, 104);
    vi.advanceTimersByTime(450);
    expect(fire).toHaveBeenCalledTimes(1);

    gesture.down(100, 100);
    gesture.move(106, 105);
    vi.advanceTimersByTime(450);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test('the click that ends a long-press is swallowed, only that one', () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(450);
    gesture.up();
    expect(gesture.takeClick()).toBe(true);
    expect(gesture.takeClick()).toBe(false);
  });

  test("a press that opened the menu and ended without a click doesn't swallow the next tap", () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(450);
    gesture.up();
    gesture.down(100, 100);
    gesture.up();
    expect(gesture.takeClick()).toBe(false);
  });

  test('a context menu (a right click) opens it at once', () => {
    gesture.contextMenu();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test("a keyboard context menu (the Menu key, Shift+F10) or a right click swallows no click: the next Enter opens the row", () => {
    gesture.contextMenu();
    expect(gesture.takeClick()).toBe(false);
  });

  test('each context menu outside a press opens it: a second right click, or the Menu key again', () => {
    gesture.contextMenu();
    gesture.contextMenu();
    expect(fire).toHaveBeenCalledTimes(2);
    gesture.down(100, 100);
    vi.advanceTimersByTime(450);
    gesture.up();
    gesture.contextMenu();
    expect(fire).toHaveBeenCalledTimes(4);
  });

  test("Android's long-press still swallows the click that ends it", () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(450);
    gesture.contextMenu();
    gesture.up();
    expect(gesture.takeClick()).toBe(true);
  });

  test("Android's context menu after its own long-press doesn't open it twice", () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(450);
    gesture.contextMenu();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test('a context menu before the delay opens it once, and the timer then never does', () => {
    gesture.down(100, 100);
    vi.advanceTimersByTime(200);
    gesture.contextMenu();
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test('dispose stops a pending long-press', () => {
    gesture.down(100, 100);
    gesture.dispose();
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });
});
