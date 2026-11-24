import { describe, expect, test, vi } from "vitest";
import { BalanceRefresh } from "./balanceRefresh.svelte";

describe("the wallet's balances as it opens", () => {
    test("each ledger asked for once, a recent balance accepted; loading until they're all in", async () => {
        const waiting: (() => void)[] = [];
        const refreshAccountBalance = vi.fn(
            (_ledger: string, _allowCached?: boolean) =>
                new Promise<bigint>((resolve) => waiting.push(() => resolve(1n))),
        );
        const balances = new BalanceRefresh({ refreshAccountBalance });
        balances.refresh(["icp", "chat"]);
        balances.refresh(["icp", "chat", "ckbtc"]);
        expect(refreshAccountBalance.mock.calls).toEqual([
            ["icp", true],
            ["chat", true],
            ["ckbtc", true],
        ]);
        expect(balances.loading).toBe(true);
        waiting.forEach((done) => done());
        await new Promise((r) => setTimeout(r));
        expect(balances.loading).toBe(false);
    });
});
