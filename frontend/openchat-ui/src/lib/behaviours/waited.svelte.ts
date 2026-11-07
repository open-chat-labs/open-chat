// One host-owned value changed by a call the UI waits for (a Follow toggle), where Optimistic would show the new
// value at once:
// - set() calls the host and keeps showing the value from before while it's in flight (`pending`: a spinner, no
//   second change meanwhile; a set() then is ignored and resolves false);
// - when the call resolves, the new value shows; when it rejects, the value from before stays and `failed` is set;
// - otherwise the host's own value shows, and sync() (call it when the host's value changes) drops a settled value
//   once nothing is in flight, so the host is followed again. A host that updates its own value as the call starts
//   (an optimistic store) doesn't show through until the call settles.
export class Waited<T> {
  failed = $state(false);
  #pending = $state<{ shown: T } | null>(null);
  #settled = $state<{ value: T } | null>(null);
  #source: () => T;

  constructor(source: () => T) {
    this.#source = source;
  }

  get current(): T {
    if (this.#pending) return this.#pending.shown;
    return this.#settled ? this.#settled.value : this.#source();
  }

  get pending(): boolean {
    return this.#pending !== null;
  }

  /** Resolves true when the call succeeded; false when it failed, or was ignored as one is in flight. */
  async set(value: T, call: (value: T) => Promise<unknown> | unknown): Promise<boolean> {
    if (this.#pending) return false;
    this.#pending = { shown: this.current };
    this.failed = false;
    try {
      await call(value);
      this.#settled = { value };
      return true;
    } catch {
      this.failed = true;
      return false;
    } finally {
      this.#pending = null;
    }
  }

  /** The host's value changed: follow it again, unless a call is in flight (its result shows when it settles). */
  sync() {
    if (this.#pending) return;
    this.#settled = null;
  }
}
