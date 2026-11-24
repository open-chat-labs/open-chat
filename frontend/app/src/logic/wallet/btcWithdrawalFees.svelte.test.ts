import type { CkbtcMinterWithdrawalInfo } from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BtcWithdrawalFees } from "./btcWithdrawalFees.svelte";

const info = (fee: bigint, minimum: bigint): CkbtcMinterWithdrawalInfo =>
    ({ feeEstimate: fee, minWithdrawalAmount: minimum }) as CkbtcMinterWithdrawalInfo;

afterEach(() => vi.useRealTimers());

describe("the ckBTC minter's fee while Send is open", () => {
    test("asked as it starts, forgotten as it stops", async () => {
        const fetch = vi.fn(async () => info(1_000n, 50_000n));
        const fees = new BtcWithdrawalFees(fetch);
        fees.start();
        await vi.waitFor(() => expect(fees.current).toEqual({ fee: 1_000n, minimum: 50_000n }));
        fees.stop();
        expect(fees.current).toBeUndefined();
    });

    test("a failure is asked again later, but not once it's stopped", async () => {
        vi.useFakeTimers();
        const fetch = vi
            .fn()
            .mockRejectedValueOnce(new Error("down"))
            .mockResolvedValue(info(5n, 6n));
        const fees = new BtcWithdrawalFees(fetch, 1_000);
        vi.spyOn(console, "warn").mockImplementation(() => {});
        fees.start();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fees.current).toEqual({ fee: 5n, minimum: 6n });

        fetch.mockRejectedValueOnce(new Error("down"));
        fees.start();
        await vi.advanceTimersByTimeAsync(0);
        fees.stop();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    test("an answer to an earlier start doesn't count once stopped", async () => {
        let answer: (i: CkbtcMinterWithdrawalInfo) => void = () => {};
        const fees = new BtcWithdrawalFees(() => new Promise((r) => (answer = r)));
        fees.start();
        fees.stop();
        answer(info(1n, 2n));
        await Promise.resolve();
        expect(fees.current).toBeUndefined();
    });
});
