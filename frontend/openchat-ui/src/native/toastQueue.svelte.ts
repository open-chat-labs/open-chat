// The native toast's timing (native design notes §1 Sheets, menus, toasts): one toast at a time, a new one taking the
// old one's place; it goes after 2.6s, or after 5s when it offers Undo (a destructive action: leave, delete,
// archive, clear, block, remove). For a host that keeps no toast state of its own; Toasts shows `current`.

/** What Toasts shows. */
export type NativeToast = {
  /** New for every toast, so a replacement plays in again. */
  id: number;
  /** Resource key (or literal text). */
  message: string;
  /** Offers Undo. */
  undoable: boolean;
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
    this.current = { id, message, undoable: !!undo };
    this.#timer = setTimeout(() => this.dismiss(), undo ? UNDO_TOAST_MS : TOAST_MS);
    return () => {
      if (this.current?.id === id) this.dismiss();
    };
  }

  /** Undo: runs the toast's undo (once) and dismisses it. */
  undo(): void {
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
