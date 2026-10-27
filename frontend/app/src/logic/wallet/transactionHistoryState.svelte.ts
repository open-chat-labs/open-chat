import type { AccountTransactions, OpenChat } from "@client";
import {
    addTransactionsPage,
    nextPageStart,
    type TransactionHistory,
} from "@src/utils/transactionHistory";

/**
 * A token's history as loaded so far: the first page loading, failed to load (an error to show,
 * not an empty history), or loaded, perhaps with the next page loading.
 */
export type HistoryState =
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "loaded"; history: TransactionHistory; loadingMore: boolean };

/** What asking for more did: nothing to do (no more, or already loading), loaded, or failed. */
export type LoadMoreOutcome = "none" | "loaded" | "failed";

/**
 * One token's transaction history, a page at a time, for every tree's history list. Pages follow
 * `nextPageStart` (invariant 5): from the oldest transaction fetched, approvals included, and none
 * once it's undefined. A token without an index canister has no history to load (`failed`).
 */
export class TransactionHistoryState {
    #state = $state<HistoryState>({ kind: "loading" });

    constructor(
        private client: Pick<OpenChat, "getAccountTransactions">,
        private ledgerIndex: string | undefined,
    ) {}

    get state(): HistoryState {
        return this.#state;
    }

    /** Whether there are older transactions to load. */
    get moreAvailable(): boolean {
        return this.#state.kind === "loaded" && nextPageStart(this.#state.history) !== undefined;
    }

    /** Loads the first page (again, after a failure). */
    async load(): Promise<void> {
        this.#state = { kind: "loading" };
        const page = await this.#page(undefined);
        this.#state =
            page === undefined
                ? { kind: "failed" }
                : {
                      kind: "loaded",
                      history: addTransactionsPage(undefined, page),
                      loadingMore: false,
                  };
    }

    /** Loads the next page. A failure keeps what's loaded, for the view to say it failed. */
    async loadMore(): Promise<LoadMoreOutcome> {
        const current = this.#state;
        if (current.kind !== "loaded" || current.loadingMore) return "none";
        const start = nextPageStart(current.history);
        if (start === undefined) return "none";
        this.#state = { ...current, loadingMore: true };
        const page = await this.#page(start);
        this.#state = {
            kind: "loaded",
            history:
                page === undefined ? current.history : addTransactionsPage(current.history, page),
            loadingMore: false,
        };
        return page === undefined ? "failed" : "loaded";
    }

    async #page(start: bigint | undefined): Promise<AccountTransactions | undefined> {
        if (this.ledgerIndex === undefined) {
            console.warn("No index canister to load transactions from");
            return undefined;
        }
        try {
            const result = await this.client.getAccountTransactions(this.ledgerIndex, start);
            if (result.kind === "failure") {
                console.warn("Error loading transactions: ", result);
                return undefined;
            }
            return result;
        } catch (err) {
            console.warn("Error loading transactions: ", err);
            return undefined;
        }
    }
}
