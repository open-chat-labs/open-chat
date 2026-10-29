import type { AccountTransaction, AccountTransactionResult } from "@client";
import { describe, expect, test, vi } from "vitest";
import { WalletHistories } from "./walletHistories.svelte";

describe("the wallet's histories", () => {
    test("each token's first page loads once, however often it's asked for", async () => {
        const getAccountTransactions = vi.fn(
            async (): Promise<AccountTransactionResult> => ({
                kind: "success",
                transactions: [],
                oldestTransactionId: undefined,
            }),
        );
        const histories = new WalletHistories({ getAccountTransactions });
        const icp = histories.load("icp", "icp-index");
        expect(histories.load("icp", "icp-index")).toBe(icp);
        histories.load("chat", "chat-index");
        await Promise.resolve();
        expect(getAccountTransactions).toHaveBeenCalledTimes(2);
        expect(histories.all.map(([ledger]) => ledger)).toEqual(["icp", "chat"]);
        expect(histories.get("chat")).toBeDefined();
        expect(histories.get("ckbtc")).toBeUndefined();
    });

    test("asked for again with the same balance it costs nothing; with another, its first page is fetched again, keeping what's shown", async () => {
        const tx = (id: bigint): AccountTransaction => ({
            kind: "transfer",
            id,
            amount: 1n,
            timestamp: new Date(0),
            from: "a",
            to: "b",
        });
        let pages: AccountTransaction[][] = [[tx(1n)], [tx(2n), tx(1n)]];
        const getAccountTransactions = vi.fn(async (): Promise<AccountTransactionResult> => {
            const [page, ...rest] = pages;
            pages = rest;
            return { kind: "success", transactions: page, oldestTransactionId: 1n };
        });
        const histories = new WalletHistories({ getAccountTransactions });
        const icp = histories.load("icp", "icp-index", 100n);
        await vi.waitFor(() => expect(icp.state.kind).toBe("loaded"));
        histories.load("icp", "icp-index", 100n);
        expect(getAccountTransactions).toHaveBeenCalledTimes(1);

        histories.load("icp", "icp-index", 90n);
        // the first page is still shown while the new one comes
        expect(icp.state.kind).toBe("loaded");
        await vi.waitFor(() => expect(getAccountTransactions).toHaveBeenCalledTimes(2));
        await vi.waitFor(() =>
            expect(icp.state.kind === "loaded" && icp.state.history.transactions.length).toBe(2),
        );
    });
});

describe("refreshing a history", () => {
    const tx = (id: bigint): AccountTransaction => ({
        kind: "transfer",
        id,
        amount: 1n,
        timestamp: new Date(0),
        from: "a",
        to: "b",
    });
    const page = (...ids: bigint[]): AccountTransactionResult => ({
        kind: "success",
        transactions: ids.map(tx),
        oldestTransactionId: 1n,
    });
    // each call answers when its turn's `answer` is called
    function controlled() {
        const answers: ((r: AccountTransactionResult | Error) => void)[] = [];
        const getAccountTransactions = vi.fn(
            () =>
                new Promise<AccountTransactionResult>((resolve, reject) =>
                    answers.push((r) => (r instanceof Error ? reject(r) : resolve(r))),
                ),
        );
        return { getAccountTransactions, answers };
    }
    const ids = (h: { state: { kind: string } } & object) =>
        "history" in h.state
            ? (
                  h.state as { history: { transactions: AccountTransaction[] } }
              ).history.transactions.map((t) => t.id)
            : h.state.kind;

    test("the newest request wins: an older one answering later is dropped", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const c = controlled();
        const histories = new WalletHistories(c);
        const icp = histories.load("icp", "icp-index", 100n);
        c.answers[0](page(1n));
        await vi.waitFor(() => expect(icp.state.kind).toBe("loaded"));

        histories.load("icp", "icp-index", 90n); // refresh A
        histories.load("icp", "icp-index", 80n); // refresh B, newer
        c.answers[2](page(3n, 2n, 1n));
        await vi.waitFor(() => expect(ids(icp)).toEqual([3n, 2n, 1n]));
        c.answers[1](page(2n, 1n));
        await Promise.resolve();
        await Promise.resolve();
        expect(ids(icp)).toEqual([3n, 2n, 1n]);
    });

    test("a first load overtaken by a refresh doesn't show failed when it fails later", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const c = controlled();
        const histories = new WalletHistories(c);
        const icp = histories.load("icp", "icp-index", 0n);
        histories.load("icp", "icp-index", 0n);
        // the balance arrives while the first page is still coming: a refresh with it
        histories.load("icp", "icp-index", 100n);
        c.answers[1](page(1n));
        await vi.waitFor(() => expect(ids(icp)).toEqual([1n]));
        c.answers[0](new Error("timed out"));
        await Promise.resolve();
        await Promise.resolve();
        expect(icp.state.kind).toBe("loaded");
    });

    test("a refresh that failed is tried again the next time, the balance not taken as fetched", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const c = controlled();
        const histories = new WalletHistories(c);
        const icp = histories.load("icp", "icp-index", 100n);
        c.answers[0](page(1n));
        await vi.waitFor(() => expect(icp.state.kind).toBe("loaded"));
        histories.load("icp", "icp-index", 90n);
        c.answers[1](new Error("down"));
        // the failed refresh settles
        await new Promise((resolve) => setTimeout(resolve, 0));
        // still the old page, and the same balance asks again
        expect(ids(icp)).toEqual([1n]);
        histories.load("icp", "icp-index", 90n);
        expect(c.getAccountTransactions).toHaveBeenCalledTimes(3);
    });

    test("a balance that changes while the first page is coming starts a refresh, and is the one kept", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const c = controlled();
        const histories = new WalletHistories(c);
        const icp = histories.load("icp", "icp-index", 5n);
        // a receive lands before the first page answers
        histories.load("icp", "icp-index", 6n);
        expect(c.getAccountTransactions).toHaveBeenCalledTimes(2);
        c.answers[1](page(2n, 1n));
        await vi.waitFor(() => expect(ids(icp)).toEqual([2n, 1n]));
        c.answers[0](page(1n));
        await Promise.resolve();
        await Promise.resolve();
        // 6 is what's fetched: asking with it again costs nothing
        histories.load("icp", "icp-index", 6n);
        expect(c.getAccountTransactions).toHaveBeenCalledTimes(2);
    });

    test("Load older doesn't cancel a refresh on its way, and is dropped only once the refresh replaces the history", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const c = controlled();
        const histories = new WalletHistories(c);
        const icp = histories.load("icp", "icp-index", 100n);
        c.answers[0]({ kind: "success", transactions: [tx(5n)], oldestTransactionId: 1n });
        await vi.waitFor(() => expect(icp.state.kind).toBe("loaded"));
        histories.load("icp", "icp-index", 90n); // refresh
        const older = icp.loadMore();
        c.answers[1](page(6n, 5n)); // the refresh answers first
        await vi.waitFor(() => expect(ids(icp)).toEqual([6n, 5n]));
        c.answers[2](page(4n));
        expect(await older).toBe("none");
        expect(ids(icp)).toEqual([6n, 5n]);
        // and 90 counts as fetched
        histories.load("icp", "icp-index", 90n);
        expect(c.getAccountTransactions).toHaveBeenCalledTimes(3);
    });
});
