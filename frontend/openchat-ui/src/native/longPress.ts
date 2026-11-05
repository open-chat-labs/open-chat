// Long-press on rows (native design notes §1 Structure 5: chats, channels, communities, messages): held 450ms without
// moving more than 10px, or a context menu (a right click; Android's own long-press), opens the row's menu with a
// light haptic, and the click that ends that press doesn't also open the row. LongPressGesture is the decision,
// timers only; `use:longPress` wires it to a row.
import type { ActionReturn } from 'svelte/action';
import { haptic } from './haptics';

/** How long a press is held before it opens the menu. */
export const LONG_PRESS_MS = 450;
/** How far (|dx| + |dy|, px) a press may move before it's a scroll or a swipe instead. */
export const MOVE_TOLERANCE = 10;

export class LongPressGesture {
  #fire: () => void;
  #delay: number;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #x = 0;
  #y = 0;
  /** This press opened the menu. */
  #fired = false;
  /** The next click is this press's own: swallow it. */
  #swallow = false;

  constructor(fire: () => void, delay: number = LONG_PRESS_MS) {
    this.#fire = fire;
    this.#delay = delay;
  }

  /** A press starts (a primary pointer goes down). */
  down(x: number, y: number): void {
    clearTimeout(this.#timer);
    this.#fired = false;
    this.#swallow = false;
    this.#x = x;
    this.#y = y;
    this.#timer = setTimeout(() => this.#trigger(), this.#delay);
  }

  /** The pointer moves: past the tolerance it's a scroll or a swipe, not a long-press. */
  move(x: number, y: number): void {
    if (Math.abs(x - this.#x) + Math.abs(y - this.#y) > MOVE_TOLERANCE) clearTimeout(this.#timer);
  }

  /** The press ends (up or cancelled) before the delay: nothing opens. */
  up(): void {
    clearTimeout(this.#timer);
  }

  /** A context menu: opens the menu now, unless this press already did (Android fires one after its own delay). */
  contextMenu(): void {
    clearTimeout(this.#timer);
    if (!this.#fired) this.#trigger();
  }

  /** Whether a click should be swallowed: the one that ends a press that opened the menu. Answers true once. */
  takeClick(): boolean {
    const swallow = this.#swallow;
    this.#swallow = false;
    return swallow;
  }

  /** Stops a pending long-press (the row is going away). */
  dispose(): void {
    clearTimeout(this.#timer);
  }

  #trigger(): void {
    this.#fired = true;
    this.#swallow = true;
    this.#fire();
  }
}

/** `use:longPress={(row) => …}`: a long-press or a context menu on the element calls back with it, after a light
 *  haptic. The element gets no text selection or iOS callout, which a long-press would otherwise start. */
export function longPress(node: HTMLElement, onLongPress: (node: HTMLElement) => void): ActionReturn<(node: HTMLElement) => void> {
  let handler = onLongPress;
  const gesture = new LongPressGesture(() => {
    haptic('light');
    handler(node);
  });
  node.style.setProperty('-webkit-touch-callout', 'none');
  node.style.setProperty('user-select', 'none');
  node.style.setProperty('-webkit-user-select', 'none');

  const down = (e: PointerEvent) => {
    if (e.button === 0) gesture.down(e.clientX, e.clientY);
  };
  const move = (e: PointerEvent) => gesture.move(e.clientX, e.clientY);
  const up = () => gesture.up();
  const menu = (e: MouseEvent) => {
    e.preventDefault();
    gesture.contextMenu();
  };
  const click = (e: MouseEvent) => {
    if (!gesture.takeClick()) return;
    e.preventDefault();
    e.stopPropagation();
  };

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('contextmenu', menu);
  node.addEventListener('click', click, true);
  return {
    update(next) {
      handler = next;
    },
    destroy() {
      gesture.dispose();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      node.removeEventListener('contextmenu', menu);
      node.removeEventListener('click', click, true);
    },
  };
}
