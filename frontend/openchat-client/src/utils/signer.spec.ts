import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { buildApproveArgs, type ApproveSpendingArgs } from "./signer";

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
        const approveArgs = buildApproveArgs(args());

        expect(approveArgs).toEqual({
            from_subaccount: [],
            spender: { owner: spenderOwner, subaccount: [] },
            amount: 100_000_000n,
            expected_allowance: [],
            expires_at: [],
            fee: [],
            memo: [],
            created_at_time: [],
        });
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
