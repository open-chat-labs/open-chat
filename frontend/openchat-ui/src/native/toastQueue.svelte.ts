// The native toast's timing (native design notes §1 Sheets, menus, toasts): one toast at a time, a new one taking the
// old one's place; it goes after 2.6s, or after 5s when it offers Undo (a destructive action: leave, delete,
// archive, clear, block, remove). A toast that tracks an operation still on its way (`showPending`, or an Undo that
// runs one: `AsyncUndo`) shows a small loader in place of its buttons and never times out while it waits; once the
// operation is done it says how it went, with a fresh timer of its own. For a host that keeps no toast state of its
// own; Toasts shows `current`.

/** What Toasts shows. */
export type NativeToast = {
  /** New for every toast, so a replacement plays in again; the same while a toast changes in place. */
  id: number;
  /** Resource key (or literal text). */
  message: string;
  /** Offers Undo. */
  undoable: boolean;
  /** Its operation is still on its way: a loader in place of Undo and the close, and no timeout. */
  pending: boolean;
};

/**
 * An Undo that runs an operation of its own (an unblock): the toast stays, saying `pending` with the loader, until
 * `run` settles, then shows what it resolves to (the result, with a fresh timer), or goes if it resolves to nothing
 * (it failed: the host says why).
 */
export type AsyncUndo = { pending: string; run: () => Promise<string | undefined> };

/** What Undo does: something done at once, or an operation of its own. */
export type ToastUndo = (() => void) | AsyncUndo;

/** A toast shown while its operation is on its way (`ToastQueue.showPending`). */
export type PendingToast = {
  /**
   * The operation is done: the loader gives way to the close (and Undo, with `undo`), the toast says `message` if
   * given, and it goes after the usual time, counted from now. Returns what takes it down early, as `show`'s does.
   * Nothing changes if another toast has taken its place.
   */
  done(result?: { message?: string; undo?: ToastUndo }): () => void;
  /** The operation failed: the toast goes (the host says why), unless another has taken its place. */
  failed(): void;
};

export const TOAST_MS = 2600;
export const UNDO_TOAST_MS = 5000;

export class ToastQueue {
  current = $state<NativeToast | null>(null);

  #undo: ToastUndo | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #nextId = 1;

  /**
   * Shows a toast in place of the current one; with `undo`, it offers Undo, which runs it. Returns what takes this
   * toast down early (an Undo that can't work any more), and leaves a toast that has taken its place alone.
   */
  show(message: string, undo?: ToastUndo): () => void {
    const id = this.#nextId++;
    this.#settle(id, message, undo);
    return this.#dismissFor(id);
  }

  /**
   * Shows a toast in place of the current one for an operation still on its way, with a loader and no buttons, which
   * stays, whatever the time, until the operation settles (`done` or `failed`).
   */
  showPending(message: string): PendingToast {
    const id = this.#nextId++;
    this.#wait(id, message);
    return {
      done: (result = {}) => {
        if (this.current?.id !== id) return () => {};
        this.#settle(id, result.message ?? this.current.message, result.undo);
        return this.#dismissFor(id);
      },
      failed: () => {
        if (this.current?.id === id) this.dismiss();
      },
    };
  }

  // the toast `id` waiting for its operation: no buttons, no timer
  #wait(id: number, message: string): void {
    clearTimeout(this.#timer);
    this.#undo = null;
    this.current = { id, message, undoable: false, pending: true };
  }

  // the toast `id` showing a result, with a fresh timer (longer with Undo)
  #settle(id: number, message: string, undo: ToastUndo | undefined): void {
    clearTimeout(this.#timer);
    this.#undo = undo ?? null;
    this.current = { id, message, undoable: !!undo, pending: false };
    this.#timer = setTimeout(() => this.dismiss(), undo ? UNDO_TOAST_MS : TOAST_MS);
  }

  #dismissFor(id: number): () => void {
    return () => {
      if (this.current?.id === id) this.dismiss();
    };
  }

  /**
   * Undo: runs the toast's undo, once. One done at once dismisses the toast; one that runs an operation keeps it,
   * waiting, then showing the result. Nothing while the toast's own operation is on its way.
   */
  undo(): void {
    const toast = this.current;
    const undo = this.#undo;
    if (toast === null || toast.pending || undo === null) return;
    if (typeof undo === 'function') {
      this.dismiss();
      undo();
      return;
    }
    this.#wait(toast.id, undo.pending);
    void this.#undone(toast.id, undo);
  }

  async #undone(id: number, undo: AsyncUndo): Promise<void> {
    let result: string | undefined;
    try {
      result = await undo.run();
    } catch {
      result = undefined;
    }
    if (this.current?.id !== id) return;
    if (result === undefined) this.dismiss();
    else this.#settle(id, result, undefined);
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
