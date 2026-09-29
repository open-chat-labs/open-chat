import { AnonymousIdentity, HttpAgent } from "@icp-sdk/core/agent";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CkbtcMinterClient } from "./ckbtcMinter.client";

const MIN_WITHDRAWAL = 50_000n;

type EstimateArgs = { amount: [] | [bigint] };

function trap(text: string): Promise<never> {
    return Promise.reject(new Error(`Call was rejected: Reject code: 5 Reject text: ${text}`));
}

function minterWith(estimate: (args: EstimateArgs) => Promise<unknown>) {
    const client = new CkbtcMinterClient(
        new AnonymousIdentity(),
        HttpAgent.createSync({ host: "http://localhost" }),
        false,
    );
    const amounts: EstimateArgs["amount"][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).service = {
        get_minter_info: () =>
            Promise.resolve({ min_confirmations: 4, retrieve_btc_min_amount: MIN_WITHDRAWAL }),
        estimate_withdrawal_fee: (args: EstimateArgs) => {
            amounts.push(args.amount);
            return estimate(args);
        },
    };
    return { client, amounts };
}

// The minter's amount-independent estimate succeeds; any specific amount traps as "too large"
const onlyAmountIndependent = (args: EstimateArgs) =>
    args.amount.length === 0
        ? Promise.resolve({ minter_fee: 1n, bitcoin_fee: 2n })
        : trap("ERROR: withdrawal amount is too large for the minter");

// Invariant: the send forms' routine fee-estimate requests (0 on open, small or too-large typed
// amounts) never fail because the ckBTC minter traps on the amount (Rollbar #31652, #31789).
describe("CkbtcMinterClient.getWithdrawalInfo", () => {
    beforeEach(() => {
        // executeQuery retries a rejected query with backoff before giving up
        vi.useFakeTimers();
        vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("an amount under the minimum only asks for the amount-independent estimate", async () => {
        const { client, amounts } = minterWith(onlyAmountIndependent);

        const info = await client.getWithdrawalInfo(0n);

        expect(info).toEqual({ minWithdrawalAmount: MIN_WITHDRAWAL, feeEstimate: 3n });
        expect(amounts).toEqual([[]]);
    });

    test("an amount beyond the minter's UTXOs falls back to the amount-independent estimate", async () => {
        const { client } = minterWith(onlyAmountIndependent);

        const info = client.getWithdrawalInfo(MIN_WITHDRAWAL * 10n);
        await vi.runAllTimersAsync();

        expect((await info).feeEstimate).toBe(3n);
    });

    test("any other minter failure still rejects", async () => {
        const { client } = minterWith(() =>
            trap("ERROR: the minter cannot currently process such a large withdrawal amount"),
        );

        const info = client.getWithdrawalInfo(MIN_WITHDRAWAL * 10n);
        const rejected = expect(info).rejects.toThrow("cannot currently process");
        await vi.runAllTimersAsync();
        await rejected;
    });
});
