import type { CkbtcMinterWithdrawalInfo } from "@client";
import { Debouncer } from "./debouncer";

/**
 * Fetches the ckBTC minter's withdrawal info (minimum amount and fee estimate) for a BTC send
 * form: once immediately on open, then debounced as the user types. Only the most recently
 * started request may deliver its info. The minter can answer an earlier amount after a later
 * one (a rejected amount falls back only after the agent's retries), and that answer must not
 * replace the estimate for the amount now in the form (#9634). `onFailed` hears when the latest
 * request fails, so the form can try again once it has; `cancel` drops whatever is still on its
 * way.
 */
export class CkbtcWithdrawalInfoRequests {
    #latest = 0;
    #debouncer: Debouncer<bigint>;

    constructor(
        private fetch: (amount: bigint) => Promise<CkbtcMinterWithdrawalInfo>,
        private onInfo: (info: CkbtcMinterWithdrawalInfo) => void,
        delayMs = 500,
        private onFailed?: () => void,
    ) {
        this.#debouncer = new Debouncer((amount) => this.now(amount), delayMs);
    }

    public now(amount: bigint): void {
        const id = ++this.#latest;
        this.fetch(amount)
            .then((info) => {
                if (id === this.#latest) {
                    this.onInfo(info);
                }
            })
            // the estimate stays as it was; the next request tries again
            .catch((err) => {
                console.warn("Couldn't get the ckBTC minter's withdrawal info", err);
                if (id === this.#latest) this.onFailed?.();
            });
    }

    public debounced(amount: bigint): void {
        this.#debouncer.execute(amount);
    }

    public cancel(): void {
        this.#debouncer.cancel();
        // an answer (or failure) still on its way no longer counts
        this.#latest++;
    }
}
