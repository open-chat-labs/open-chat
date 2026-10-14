// The dialog contract every feature dialog shares, in one place:
// - a host call (save, pay, create …) runs through run(): a second press while it is pending is ignored, the
//   result says whether it worked, `failed` drives the inline error;
// - dismissing (Esc, veil, ×, Cancel, Back) goes through dismiss(): ignored while a call is pending or the dialog
//   is already leaving;
// - leave() plays the exit and stays out (never comes back); `then` runs after the exit — on success the dialog
//   calls leave(onCancel) so the host unmounts it.
// Bind it as: class:closing={flow.closing}, use:modal={flow.escape(onCancel)}, and give `.closing` pointer-events: none.
export class DialogFlow {
  busy = $state(false);
  closing = $state(false);
  failed = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;
  #exitMs: number;

  constructor(opts: { exitMs?: number } = {}) {
    this.#exitMs = opts.exitMs ?? 170;
  }

  /** Busy or leaving: nothing new may start and nothing may dismiss. */
  get locked() {
    return this.busy || this.closing;
  }

  /** Runs a host call once at a time. Resolves { ok: true, value } or { ok: false } (also when it was ignored). */
  async run<T>(call: () => Promise<T> | T): Promise<{ ok: true; value: T } | { ok: false }> {
    if (this.locked) return { ok: false };
    this.busy = true;
    this.failed = false;
    try {
      const value = await call();
      return { ok: true, value };
    } catch {
      this.failed = true;
      return { ok: false };
    } finally {
      this.busy = false;
    }
  }

  /** Esc / veil / × / Cancel / Back. */
  dismiss(then?: () => void) {
    if (this.locked) return;
    this.leave(then);
  }

  /** Plays the exit and stays out; `then` runs once it has finished. */
  leave(then?: () => void) {
    if (this.closing) return;
    this.closing = true;
    this.#timer = setTimeout(() => then?.(), this.#exitMs);
  }

  /** For use:modal — off the dialog stack while leaving, otherwise Esc dismisses. */
  escape(then?: () => void): (() => void) | undefined {
    return this.closing ? undefined : () => this.dismiss(then);
  }

  /** Call from onDestroy. */
  destroy() {
    clearTimeout(this.#timer);
  }
}
