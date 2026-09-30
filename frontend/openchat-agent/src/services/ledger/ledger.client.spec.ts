import { Principal } from "@icp-sdk/core/principal";
import { APPROVAL_VALIDITY_MS } from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Allowance, ApproveArgs, ApproveResult } from "./candid/types";
import { LedgerClient } from "./ledger.client";

const NOW_MS = 1_800_000_000_000;
const EXPIRY = BigInt(NOW_MS + APPROVAL_VALIDITY_MS) * 1_000_000n;
const LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const ME = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
const SPENDER = {
    owner: Principal.fromText("dfdal-2uaaa-aaaaa-qaama-cai"),
    subaccount: new Uint8Array(32).fill(7),
};
const FEE = 10n;

describe("LedgerClient.approveSpending", () => {
    let balance: bigint;
    let allowances: Allowance[];
    let responses: ApproveResult[];
    let approvals: ApproveArgs[];
    let client: LedgerClient;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        vi.spyOn(console, "warn").mockImplementation(() => {});

        balance = 1_000n;
        allowances = [];
        responses = [];
        approvals = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = Object.create(LedgerClient.prototype) as any;
        c.identity = { getPrincipal: () => ME };
        c.service = {
            icrc1_balance_of: { withOptions: () => () => Promise.resolve(balance) },
            icrc2_allowance: { withOptions: () => () => Promise.resolve(allowances.shift()) },
            icrc2_approve: {
                withOptions: () => (args: ApproveArgs) => {
                    approvals.push(args);
                    return Promise.resolve(responses.shift());
                },
            },
        };
        client = c;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("the amount is approved from the caller's own account", async () => {
        allowances = [{ allowance: 0n, expires_at: [] }];
        responses = [{ Ok: 1n }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual("success");
        expect(approvals).toEqual([
            {
                spender: { owner: SPENDER.owner, subaccount: [SPENDER.subaccount] },
                amount: 100n,
                expected_allowance: [0n],
                expires_at: [EXPIRY],
                from_subaccount: [],
                fee: [],
                memo: [],
                created_at_time: [],
            },
        ]);
    });

    test("the amount is added to what the spender may already pull", async () => {
        allowances = [{ allowance: 500n, expires_at: [] }];
        responses = [{ Ok: 1n }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual("success");
        expect(approvals.map((a) => [a.amount, a.expected_allowance, a.expires_at])).toEqual([
            [600n, [500n], []],
        ]);
    });

    test("nothing is approved unless the account can afford the payment and the approval", async () => {
        balance = 100n + FEE - 1n;
        allowances = [{ allowance: 0n, expires_at: [] }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual(
            "insufficient_funds",
        );
        expect(approvals).toEqual([]);
    });

    test("an allowance which changed as it was being added to is read again", async () => {
        allowances = [
            { allowance: 0n, expires_at: [] },
            { allowance: 40n, expires_at: [] },
        ];
        responses = [{ Err: { AllowanceChanged: { current_allowance: 40n } } }, { Ok: 1n }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual("success");
        expect(approvals.map((a) => [a.amount, a.expected_allowance])).toEqual([
            [100n, [0n]],
            [140n, [40n]],
        ]);
    });

    test("an allowance which keeps changing is given up on", async () => {
        allowances = [
            { allowance: 0n, expires_at: [] },
            { allowance: 40n, expires_at: [] },
        ];
        responses = [
            { Err: { AllowanceChanged: { current_allowance: 40n } } },
            { Err: { AllowanceChanged: { current_allowance: 80n } } },
        ];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual("failure");
        expect(approvals.length).toEqual(2);
    });

    test("an approval which a slow clock had expire already is made again by the ledger's time", async () => {
        const ledgerTime = BigInt(NOW_MS + 60 * 60 * 1000) * 1_000_000n;
        allowances = [
            { allowance: 0n, expires_at: [] },
            { allowance: 0n, expires_at: [] },
        ];
        responses = [{ Err: { Expired: { ledger_time: ledgerTime } } }, { Ok: 1n }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual("success");
        expect(approvals.map((a) => a.expires_at)).toEqual([
            [EXPIRY],
            [ledgerTime + BigInt(APPROVAL_VALIDITY_MS) * 1_000_000n],
        ]);
    });

    test("an approval the ledger rejects is not retried", async () => {
        allowances = [{ allowance: 0n, expires_at: [] }];
        responses = [{ Err: { TemporarilyUnavailable: null } }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual("failure");
        expect(approvals.length).toEqual(1);
    });

    test("the ledger finding the account can't afford the approval is reported as such", async () => {
        allowances = [{ allowance: 0n, expires_at: [] }];
        responses = [{ Err: { InsufficientFunds: { balance: 0n } } }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE)).toEqual(
            "insufficient_funds",
        );
    });
});
