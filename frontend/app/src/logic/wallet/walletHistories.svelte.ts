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
     * changed since (or after a failure). Without a balance, a known history is kept as it is.
     */
    load(ledger: string, index: string | undefined, balance?: bigint): TransactionHistoryState {
        const known = this.#byLedger.get(ledger);
        if (known !== undefined) {
            // a balance first known now isn't a change
            const changed =
                balance !== undefined && known.balance !== undefined && balance !== known.balance;
            if (balance !== undefined) known.balance = balance;
            if (changed || known.history.state.kind === "failed") known.history.refresh();
            return known.history;
        }
        const history = new TransactionHistoryState(this.#client, index);
        this.#byLedger.set(ledger, { history, balance });
        history.load();
        return history;
    }

    get(ledger: string): TransactionHistoryState | undefined {
        return this.#byLedger.get(ledger)?.history;
    }

    /** The histories asked for so far, by ledger. */
    get all(): [string, TransactionHistoryState][] {
        return [...this.#byLedger.entries()].map(([ledger, e]) => [ledger, e.history]);
    }
}
