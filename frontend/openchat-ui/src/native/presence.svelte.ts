// An overlay that stays mounted while it plays its way out: `set(true)` mounts it, `set(false)` marks it leaving and
// unmounts it `leaveMs` later; opening again while it leaves takes it back. BottomSheet and LongPressMenu use it.

export class Presence {
  /** Whether the overlay is in the DOM: open, or still leaving. */
  mounted = $state(false);
  /** Closing: playing its way out, no longer taking input. */
  leaving = $state(false);

  #leaveMs: number;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(leaveMs: number) {
    this.#leaveMs = leaveMs;
  }

  set(open: boolean): void {
    if (open) {
      clearTimeout(this.#timer);
      this.leaving = false;
      this.mounted = true;
    } else if (this.mounted && !this.leaving) {
      this.leaving = true;
      this.#timer = setTimeout(() => {
        this.mounted = false;
        this.leaving = false;
      }, this.#leaveMs);
    }
  }

  /** Stops a pending unmount (the owner is going away). */
  dispose(): void {
    clearTimeout(this.#timer);
  }
}
