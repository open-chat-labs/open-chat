import type { AccountTransaction, AccountTransactionResult } from "@client";
import { describe, expect, test, vi } from "vitest";
import { TransactionHistoryState } from "./transactionHistoryState.svelte";

function transfer(id: bigint): AccountTransaction {
    return { kind: "transfer", id, amount: 1n, timestamp: new Date(0), from: "a", to: "b" };
}
function approve(id: bigint): AccountTransaction {
    return { kind: "approve", id, amount: 1n, timestamp: new Date(0), from: "a" };
}
const page = (
    transactions: AccountTransaction[],
    oldestTransactionId: bigint,
): AccountTransactionResult => ({ kind: "success", transactions, oldestTransactionId });

function client(...pages: AccountTransactionResult[]) {
    const getAccountTransactions = vi.fn(async (_index: string, _start?: bigint) => {
        const next = pages.shift();
        if (next === undefined) throw new Error("no more pages");
        return next;
    });
    return { getAccountTransactions };
}

describe("a token's transaction history", () => {
    test("invariant 5: the next page starts below the oldest transaction fetched, approvals included, and stops when there are no older", async () => {
        const c = client(
            page([transfer(10n), approve(9n)], 5n),
            page([transfer(6n), transfer(5n)], 5n),
        );
        const history = new TransactionHistoryState(c, "index");
        await history.load();
        expect(history.moreAvailable).toBe(true);
        expect(await history.loadMore()).toBe("loaded");
        expect(c.getAccountTransactions).toHaveBeenLastCalledWith("index", 8n);
        const state = history.state;
        expect(state.kind === "loaded" && state.history.transactions.map((t) => t.id)).toEqual([
            10n,
            6n,
            5n,
        ]);
        // nothing older: no more pages asked for
        expect(history.moreAvailable).toBe(false);
        expect(await history.loadMore()).toBe("none");
        expect(c.getAccountTransactions).toHaveBeenCalledTimes(2);
    });

    test("a first page that fails is a failure to show, not an empty history", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const history = new TransactionHistoryState(client({ kind: "failure" }), "index");
        await history.load();
        expect(history.state).toEqual({ kind: "failed" });
    });

    test("a token without an index canister has no history to load", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const c = client();
        const history = new TransactionHistoryState(c, undefined);
        await history.load();
        expect(history.state).toEqual({ kind: "failed" });
        expect(c.getAccountTransactions).not.toHaveBeenCalled();
    });

    test("a next page that fails keeps what's loaded, and one already loading isn't asked for twice", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        let finish!: (r: AccountTransactionResult) => void;
        const c = client(page([transfer(10n)], 1n));
        const history = new TransactionHistoryState(c, "index");
        await history.load();
        c.getAccountTransactions.mockImplementationOnce(
            () => new Promise((resolve) => (finish = resolve)),
        );
        const first = history.loadMore();
        expect(await history.loadMore()).toBe("none");
        finish({ kind: "failure" });
        expect(await first).toBe("failed");
        const state = history.state;
        expect(state.kind === "loaded" && state.history.transactions.map((t) => t.id)).toEqual([
            10n,
        ]);
        expect(state.kind === "loaded" && state.loadingMore).toBe(false);
    });
});
