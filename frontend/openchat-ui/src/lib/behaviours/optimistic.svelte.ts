// One host-owned value changed optimistically (mute, favourite, a toggle, a role …):
// - set() shows the new value at once and calls the host;
// - only the latest call decides: an older rejection after a newer request is ignored;
// - when the latest call rejects, the value falls back to the one the host last accepted (or the host's own value
//   if it accepted none in this session) — never to an earlier optimistic guess — and `failed` is set;
// - an older call that succeeds after every newer one failed still lands;
// - sync() (call it when the host's value changes) drops local state once nothing is in flight, so the host is
//   followed again.
export class Optimistic<T> {
  failed = $state(false);
  #override = $state<{ value: T } | null>(null);
  #inflight = $state(0);
  #source: () => T;
  #seq = 0;
  #settled = 0;
  #lost = 0;
  #accepted: { value: T } | null = null;

  constructor(source: () => T) {
    this.#source = source;
  }

  get current(): T {
    return this.#override ? this.#override.value : this.#source();
  }

  get pending() {
    return this.#inflight > 0;
  }

  /** Resolves true when this call succeeded. */
  async set(value: T, call: (value: T) => Promise<unknown> | unknown): Promise<boolean> {
    const seq = ++this.#seq;
    this.#inflight++;
    this.#override = { value };
    this.failed = false;
    try {
      await call(value);
      if (seq > this.#settled) {
        this.#settled = seq;
        this.#accepted = { value };
        // every newer request already failed: this one is now the truth
        if (this.#lost === this.#seq) this.#override = { value };
      }
      return true;
    } catch {
      if (seq === this.#seq) {
        this.#lost = seq;
        this.#override = this.#accepted ? { value: this.#accepted.value } : null;
        this.failed = true;
      }
      return false;
    } finally {
      this.#inflight--;
    }
  }

  /** The host's value changed: follow it again unless a call is still in flight. */
  sync() {
    if (this.#inflight > 0) return;
    this.#override = null;
    this.#accepted = null;
  }
}
