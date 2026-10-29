// The wallet's histories, one per token: a token's page shows its own, and All activity merges the
// first page of every token held. Each loads the first time it's asked for and is kept; asked for
// again with another balance (a transaction since), its first page is fetched again in the
// background, so an unchanged wallet costs no calls.
import type { OpenChat } from "@client";
import { SvelteMap } from "svelte/reactivity";
import { TransactionHistoryState } from "./transactionHistoryState.svelte";

type Entry = { history: TransactionHistoryState; balance: bigint | undefined };

export class WalletHistories {
    #client: Pick<OpenChat, "getAccountTransactions">;
    #byLedger = new SvelteMap<string, Entry>();

    constructor(client: Pick<OpenChat, "getAccountTransactions">) {
        this.#client = client;
    }

    /**
     * The token's history: loaded the first time it's asked for, and refreshed when `balance` has
     * changed since the balance its page was fetched with (or after a failure). A balance is kept
     * only once a fetch made for it has succeeded, so a failed refresh is tried again next time.
     * Without a balance (not known yet), a known history is kept as it is.
     */
    load(ledger: string, index: string | undefined, balance?: bigint): TransactionHistoryState {
        const known = this.#byLedger.get(ledger);
        if (known === undefined) {
            const history = new TransactionHistoryState(this.#client, index);
            const entry: Entry = { history, balance: undefined };
            this.#byLedger.set(ledger, entry);
            this.#fetched(entry, history.load(), balance);
            return history;
        }
        if (known.history.state.kind === "failed") {
            this.#fetched(known, known.history.refresh(), balance);
        } else if (balance !== undefined && known.balance === undefined) {
            // first known now: the page loading or loaded is for it
            known.balance = balance;
        } else if (balance !== undefined && balance !== known.balance) {
            this.#fetched(known, known.history.refresh(), balance);
        }
        return known.history;
    }

    async #fetched(entry: Entry, fetch: Promise<boolean>, balance: bigint | undefined) {
        if ((await fetch) && balance !== undefined) entry.balance = balance;
    }

    get(ledger: string): TransactionHistoryState | undefined {
        return this.#byLedger.get(ledger)?.history;
    }

    /** The histories asked for so far, by ledger. */
    get all(): [string, TransactionHistoryState][] {
        return [...this.#byLedger.entries()].map(([ledger, e]) => [ledger, e.history]);
    }
}
