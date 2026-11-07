// The native toast's timing (native design notes §1 Sheets, menus, toasts): one toast at a time, a new one taking the
// old one's place; it goes after 2.6s, or after 5s when it offers Undo (a destructive action: leave, delete,
// archive, clear, block, remove). A toast for an action still on its way (`showPending`) shows at once with a small
// loader in place of its buttons, and stays until the action settles: then it offers Undo and goes as any other.
// For a host that keeps no toast state of its own; Toasts shows `current`.

/** What Toasts shows. */
export type NativeToast = {
  /** New for every toast, so a replacement plays in again. */
  id: number;
  /** Resource key (or literal text). */
  message: string;
  /** Offers Undo. */
  undoable: boolean;
  /** Its action is still on its way: a loader in place of Undo and the close. */
  pending: boolean;
};

/** A toast shown while its action is on its way (`ToastQueue.showPending`). */
export type PendingToast = {
  /**
   * The action is done: the loader gives way to Undo (with `undo`) and the close, and the toast goes after the usual
   * time. Returns what takes it down early, as `show`'s does. Nothing changes if another toast has taken its place.
   */
  done(undo?: () => void): () => void;
  /** The action failed: the toast goes (the host says why), unless another has taken its place. */
  failed(): void;
};

export const TOAST_MS = 2600;
export const UNDO_TOAST_MS = 5000;

export class ToastQueue {
  current = $state<NativeToast | null>(null);

  #undo: (() => void) | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #nextId = 1;

  /**
   * Shows a toast in place of the current one; with `undo`, it offers Undo, which runs it. Returns what takes this
   * toast down early (an Undo that can't work any more), and leaves a toast that has taken its place alone.
   */
  show(message: string, undo?: () => void): () => void {
    clearTimeout(this.#timer);
    this.#undo = undo ?? null;
    const id = this.#nextId++;
    this.current = { id, message, undoable: !!undo, pending: false };
    this.#timer = setTimeout(() => this.dismiss(), undo ? UNDO_TOAST_MS : TOAST_MS);
    return this.#dismissFor(id);
  }

  /**
   * Shows a toast in place of the current one for an action still on its way, with a loader and no buttons, which
   * stays until the action settles (`done` or `failed`).
   */
  showPending(message: string): PendingToast {
    clearTimeout(this.#timer);
    this.#undo = null;
    const id = this.#nextId++;
    this.current = { id, message, undoable: false, pending: true };
    return {
      done: (undo) => {
        if (this.current?.id !== id) return () => {};
        this.#undo = undo ?? null;
        this.current = { ...this.current, undoable: !!undo, pending: false };
        this.#timer = setTimeout(() => this.dismiss(), undo ? UNDO_TOAST_MS : TOAST_MS);
        return this.#dismissFor(id);
      },
      failed: () => {
        if (this.current?.id === id) this.dismiss();
      },
    };
  }

  #dismissFor(id: number): () => void {
    return () => {
      if (this.current?.id === id) this.dismiss();
    };
  }

  /** Undo: runs the toast's undo (once) and dismisses it. Nothing while its action is on its way. */
  undo(): void {
    if (this.current?.pending) return;
    const undo = this.#undo;
    this.dismiss();
    undo?.();
  }

  dismiss(): void {
    clearTimeout(this.#timer);
    this.#undo = null;
    this.current = null;
  }

  /** Stops the pending dismissal (the owner is going away). */
  dispose(): void {
    clearTimeout(this.#timer);
  }
}
