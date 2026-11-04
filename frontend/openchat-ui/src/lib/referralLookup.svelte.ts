// Who an invite link typed or pasted into a field names (AuthDialog's referrer):
// - a paste is looked up at once; typing once the text has settled, so a link typed out isn't looked up per keystroke;
// - only the latest text's answer counts;
// - `pending` is on from the moment the text could be a link until its answer (a form waits on it, so the referral
//   isn't left out), and a lookup that takes longer than `timeoutMs` counts as naming no one, so nothing waits for good;
// - stop() drops a lookup waiting or going (call it when the referrer is set some other way).
import { referralCode } from './referral';

export type ReferralProblem = 'no_referrer' | 'unknown';

export class ReferralLookup<P> {
  pending = $state(false);
  problem = $state<ReferralProblem | null>(null);
  #resolve: () => ((code: string) => Promise<P | undefined>) | undefined;
  #found: (person: P) => void;
  #settleMs: number;
  #timeoutMs: number;
  #run = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    resolve: () => ((code: string) => Promise<P | undefined>) | undefined,
    found: (person: P) => void,
    { settleMs = 450, timeoutMs = 10_000 }: { settleMs?: number; timeoutMs?: number } = {},
  ) {
    this.#resolve = resolve;
    this.#found = found;
    this.#settleMs = settleMs;
    this.#timeoutMs = timeoutMs;
  }

  /** The field's text changed, by a paste or by typing. */
  input(text: string, pasted: boolean): void {
    this.problem = null;
    const mine = this.#next();
    // a few characters in, it's still being typed
    if (referralCode(text) === undefined && text.trim().length <= 6) return;
    this.pending = true;
    if (pasted) void this.#lookUp(text, mine);
    else this.#timer = setTimeout(() => void this.#lookUp(text, mine), this.#settleMs);
  }

  /** Drops a lookup waiting or going: its answer is ignored and nothing waits for it. */
  stop(): void {
    this.#next();
  }

  /** stop(), and forgets what was wrong with the last link. */
  reset(): void {
    this.stop();
    this.problem = null;
  }

  #next(): number {
    clearTimeout(this.#timer);
    this.pending = false;
    return ++this.#run;
  }

  async #lookUp(text: string, mine: number): Promise<void> {
    const code = referralCode(text);
    const resolve = this.#resolve();
    let person: P | undefined;
    if (code !== undefined && resolve) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tooLong = new Promise<undefined>((done) => (timer = setTimeout(() => done(undefined), this.#timeoutMs)));
      try {
        person = await Promise.race([resolve(code), tooLong]);
      } catch {
        person = undefined;
      } finally {
        clearTimeout(timer);
      }
    }
    if (mine !== this.#run) return;
    this.pending = false;
    if (person !== undefined) this.#found(person);
    else this.problem = code === undefined ? 'no_referrer' : 'unknown';
  }
}
