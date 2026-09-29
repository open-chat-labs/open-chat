import type { CkbtcMinterWithdrawalInfo } from "@client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CkbtcWithdrawalInfoRequests } from "./ckbtcWithdrawalInfo";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

const info = (feeEstimate: bigint): CkbtcMinterWithdrawalInfo => ({
    minWithdrawalAmount: 1n,
    feeEstimate,
});

// Invariant 1 of #9634: a BTC send form never replaces the estimate for the latest requested
// amount with one requested for an earlier amount. Both send forms get their estimates only
// through CkbtcWithdrawalInfoRequests.
describe("CkbtcWithdrawalInfoRequests", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("drops the answer for the amount on open when it arrives after the typed amount's", async () => {
        const pending = new Map<bigint, ReturnType<typeof deferred<CkbtcMinterWithdrawalInfo>>>();
        const shown: bigint[] = [];
        const requests = new CkbtcWithdrawalInfoRequests(
            (amount) => {
                const d = deferred<CkbtcMinterWithdrawalInfo>();
                pending.set(amount, d);
                return d.promise;
            },
            (i) => shown.push(i.feeEstimate),
        );

        requests.now(0n);
        requests.debounced(5000n);
        vi.advanceTimersByTime(500);
        pending.get(5000n)!.resolve(info(222n));
        pending.get(0n)!.resolve(info(111n));
        await vi.runAllTimersAsync();

        expect(shown).toEqual([222n]);
    });

    it("only requests the last amount typed within the debounce window", async () => {
        const fetch = vi.fn((amount: bigint) => Promise.resolve(info(amount)));
        const shown: bigint[] = [];
        const requests = new CkbtcWithdrawalInfoRequests(fetch, (i) => shown.push(i.feeEstimate));

        requests.debounced(1n);
        requests.debounced(12n);
        requests.debounced(123n);
        await vi.advanceTimersByTimeAsync(500);

        expect(fetch.mock.calls).toEqual([[123n]]);
        expect(shown).toEqual([123n]);
    });

    it("shows each answer when requests don't overlap", async () => {
        const shown: bigint[] = [];
        const requests = new CkbtcWithdrawalInfoRequests(
            (amount) => Promise.resolve(info(amount)),
            (i) => shown.push(i.feeEstimate),
        );

        requests.now(1n);
        await vi.advanceTimersByTimeAsync(0);
        requests.now(2n);
        await vi.advanceTimersByTimeAsync(0);

        expect(shown).toEqual([1n, 2n]);
    });
});
