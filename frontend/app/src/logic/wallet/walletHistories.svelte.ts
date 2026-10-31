// The wallet's histories, one per token: a token's page shows its own, and All activity merges the
// first page of every token held. Each loads the first time it's asked for and is kept; asked for
// again with another balance (a transaction since), its first page is fetched again in the
// background, so an unchanged wallet costs no calls.
import type { OpenChat } from "@client";
import { SvelteMap } from "svelte/reactivity";
import { TransactionHistoryState } from "./transactionHistoryState.svelte";

// `balance`: the balance its shown page was fetched for; `pending`: the one a fetch on its way was
// made for; `fetch`: that fetch's number (0 when none is on its way)
type Entry = {
    history: TransactionHistoryState;
    balance: bigint | undefined;
    pending: bigint | undefined;
    fetch: number;
};

export class WalletHistories {
    #client: Pick<OpenChat, "getAccountTransactions">;
    #byLedger = new SvelteMap<string, Entry>();
    #fetches = 0;

    constructor(client: Pick<OpenChat, "getAccountTransactions">) {
        this.#client = client;
    }

    /**
     * The token's history: loaded the first time it's asked for, and refreshed when `balance`
     * differs from the one its page was fetched for (or the one a fetch on its way is for), or
     * after a failure. A balance counts as fetched only once a fetch made for it has succeeded, so
     * a failed refresh is tried again next time. Without a balance (not known yet), a known
     * history is kept as it is; the first balance known is the one its page is for.
     */
    load(ledger: string, index: string | undefined, balance?: bigint): TransactionHistoryState {
        const known = this.#byLedger.get(ledger);
        if (known === undefined) {
            const history = new TransactionHistoryState(this.#client, index);
            const entry: Entry = { history, balance: undefined, pending: undefined, fetch: 0 };
            this.#byLedger.set(ledger, entry);
            this.#fetch(entry, () => history.load(), balance);
            return history;
        }
        if (known.history.state.kind === "failed") {
            this.#fetch(known, () => known.history.refresh(), balance ?? known.pending);
        } else if (balance === undefined) {
            // nothing to compare
        } else if (known.fetch !== 0) {
            // a fetch is on its way: it stands for this balance if it was made before any was known
            if (known.pending === undefined) known.pending = balance;
            else if (balance !== known.pending) {
                this.#fetch(known, () => known.history.refresh(), balance);
            }
        } else if (known.balance === undefined) {
            known.balance = balance;
        } else if (balance !== known.balance) {
            this.#fetch(known, () => known.history.refresh(), balance);
        }
        return known.history;
    }

    async #fetch(entry: Entry, start: () => Promise<boolean>, balance: bigint | undefined) {
        const fetch = ++this.#fetches;
        entry.fetch = fetch;
        entry.pending = balance;
        const shown = await start();
        // a newer fetch has taken over
        if (entry.fetch !== fetch) return;
        entry.fetch = 0;
        if (shown && entry.pending !== undefined) entry.balance = entry.pending;
        entry.pending = undefined;
    }

    get(ledger: string): TransactionHistoryState | undefined {
        return this.#byLedger.get(ledger)?.history;
    }

    /** The histories asked for so far, by ledger. */
    get all(): [string, TransactionHistoryState][] {
        return [...this.#byLedger.entries()].map(([ledger, e]) => [ledger, e.history]);
    }
}
