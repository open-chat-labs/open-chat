import type { OpenChat } from "@client";
import { SvelteSet } from "svelte/reactivity";

/**
 * The wallet's balances as its list first shows them: each token's asked for once (a recent one
 * accepted), and which are still on their way, for the total's small spinner. The web panel's and
 * the native Wallet tab's.
 */
export class BalanceRefresh {
    #asked = new Set<string>();
    #loading = new SvelteSet<string>();

    constructor(private client: Pick<OpenChat, "refreshAccountBalance">) {}

    /** Asks for the balances of the ledgers not asked for yet. */
    refresh(ledgers: string[]): void {
        for (const ledger of ledgers) {
            if (this.#asked.has(ledger)) continue;
            this.#asked.add(ledger);
            this.#loading.add(ledger);
            this.client
                .refreshAccountBalance(ledger, true)
                .finally(() => this.#loading.delete(ledger));
        }
    }

    /** Some of the balances asked for are still on their way. */
    get loading(): boolean {
        return this.#loading.size > 0;
    }
}
