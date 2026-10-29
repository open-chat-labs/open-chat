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
