import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import {
    APPROVAL_VALIDITY_MS,
    buildApproveArgs,
    missingScopes,
    type ApproveSpendingArgs,
} from "./signer";

const walletOwner = Principal.selfAuthenticating(new Uint8Array(32).fill(7));
const spenderOwner = Principal.fromText("dfdal-2uaaa-aaaaa-qaama-cai");
const subaccount = new Uint8Array(32);
subaccount[31] = 5;

function args(overrides: Partial<ApproveSpendingArgs> = {}): ApproveSpendingArgs {
    return {
        account: { owner: walletOwner, address: walletOwner.toText() },
        ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
        amount: 100_000_000n,
        spender: { owner: spenderOwner },
        ...overrides,
    };
}

describe("buildApproveArgs", () => {
    test("omits optional fields which are not set", () => {
        const approveArgs = buildApproveArgs(args(), 1_000);

        expect(approveArgs).toEqual({
            from_subaccount: [],
            spender: { owner: spenderOwner, subaccount: [] },
            amount: 100_000_000n,
            expected_allowance: [],
            expires_at: [BigInt(1_000 + APPROVAL_VALIDITY_MS) * 1_000_000n],
            fee: [],
            memo: [],
            created_at_time: [],
        });
    });

    test("expires the approval by default, rather than leaving it standing", () => {
        const [expiresAt] = buildApproveArgs(args(), 1_000).expires_at;

        expect(expiresAt).toEqual(BigInt(1_000 + APPROVAL_VALIDITY_MS) * 1_000_000n);
        expect(APPROVAL_VALIDITY_MS).toEqual(10 * 60 * 1000);
    });

    test("includes subaccounts and expiry when set", () => {
        const approveArgs = buildApproveArgs(
            args({
                account: { owner: walletOwner, subaccount, address: "" },
                spender: { owner: spenderOwner, subaccount },
                expiresAt: 1_000_000n,
            }),
        );

        expect(approveArgs.from_subaccount).toEqual([subaccount]);
        expect(approveArgs.spender.subaccount).toEqual([subaccount]);
        expect(approveArgs.expires_at).toEqual([1_000_000n]);
    });
});

describe("missingScopes", () => {
    const required = [{ method: "icrc27_accounts" }, { method: "icrc49_call_canister" }];

    test("nothing is missing when both are granted", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc27_accounts" }, state: "granted" },
                { scope: { method: "icrc49_call_canister" }, state: "granted" },
            ]),
        ).toEqual([]);
    });

    test("ask_on_use counts as granted", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc27_accounts" }, state: "ask_on_use" },
                { scope: { method: "icrc49_call_canister" }, state: "ask_on_use" },
            ]),
        ).toEqual([]);
    });

    test("a denied scope is missing", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc27_accounts" }, state: "denied" },
                { scope: { method: "icrc49_call_canister" }, state: "granted" },
            ]),
        ).toEqual(["icrc27_accounts"]);
    });

    // A wallet which grants nothing can answer with an empty list rather than denying each scope
    test("a scope left out of the response is missing", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc49_call_canister" }, state: "granted" },
            ]),
        ).toEqual(["icrc27_accounts"]);
        expect(missingScopes(required, [])).toEqual(["icrc27_accounts", "icrc49_call_canister"]);
    });
});
