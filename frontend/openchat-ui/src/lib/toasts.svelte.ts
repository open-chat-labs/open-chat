// Where a component's toast shows. A toast always floats above sheets, dialogs and their veils, never inside them
// (design pass 7), so a component inside one (a dialog, a panel, a wallet flow) hands its toast to the host's toast
// layer: the host provides `setToastHost` once, near its root, and shows `ToastLayer.current` (as UndoToast) in a
// layer of its own. With no host (the docs, a component on its own) the component shows the toast itself, from a
// ToastLayer of its own.
import { getContext, setContext } from 'svelte';

export type ToastIcon = 'undo' | 'hide' | 'trash' | 'check' | 'none';

/** A toast, as UndoToast draws it. */
export type HostedToast = {
  /** Resource key (or literal text). */
  message: string;
  /** Resource key (or literal text): a secondary line under the message. */
  detail?: string;
  tone?: 'neutral' | 'success';
  size?: 'md' | 'lg';
  icon?: ToastIcon;
  /** Resource key (or literal text) for the action. */
  actionLabel?: string;
  /** Shows the action; the toast goes, then it runs. */
  onAction?: () => void;
  /** Its × was used (the toast goes either way). */
  onClose?: () => void;
  /** How long it shows, in ms; without, it stays until it's closed, replaced or taken down. */
  duration?: number;
};

/** Shows a toast in place of the one showing; returns what takes it down early (nothing if another took its place). */
export type ToastHost = (toast: HostedToast) => () => void;

/** A toast showing: new `id` for each, so a replacement plays in again. */
export type ShownToast = HostedToast & { id: number };

const KEY = Symbol('oc-toast-host');

/** The host's toast layer, for the components below (call during component init). */
export function setToastHost(host: ToastHost): ToastHost {
  return setContext(KEY, host);
}

/** The host's toast layer, if a host provides one (call during component init). */
export function getToastHost(): ToastHost | undefined {
  return getContext<ToastHost | undefined>(KEY);
}

/** One toast at a time, the new taking the old one's place, each gone after its own `duration`. */
export class ToastLayer {
  current = $state<ShownToast | null>(null);

  #timer: ReturnType<typeof setTimeout> | undefined;
  #nextId = 1;

  show: ToastHost = (toast) => {
    const id = this.#nextId++;
    clearTimeout(this.#timer);
    this.current = { ...toast, id };
    if (toast.duration !== undefined) this.#timer = setTimeout(() => this.#dismissIf(id), toast.duration);
    return () => this.#dismissIf(id);
  };

  /** The action: the toast goes, then its `onAction` runs. */
  action(): void {
    const toast = this.current;
    this.dismiss();
    toast?.onAction?.();
  }

  /** The ×: the toast goes, then its `onClose` runs. */
  close(): void {
    const toast = this.current;
    this.dismiss();
    toast?.onClose?.();
  }

  dismiss(): void {
    clearTimeout(this.#timer);
    this.current = null;
  }

  /** Stops the pending dismissal (the owner is going away). */
  dispose(): void {
    clearTimeout(this.#timer);
  }

  #dismissIf(id: number): void {
    if (this.current?.id === id) this.dismiss();
  }
}
