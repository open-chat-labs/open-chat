import { AccountIdentifier } from "@icp-sdk/canisters/ledger/icp";
import { Principal } from "@icp-sdk/core/principal";
import {
    APPROVAL_VALIDITY_MS,
    encodeIcrcAccount,
    ErrorCode,
    type PendingCryptocurrencyWithdrawal,
} from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
    Allowance,
    ApproveArgs,
    ApproveResult,
    IcpTransferArgs,
    IcpTransferResult,
    TransferArg,
    TransferResult,
} from "./candid/types";
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

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("success");
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

    test("a payment pulled later is approved for as long as it is given", async () => {
        const validityMs = 7 * 24 * 60 * 60 * 1000;
        allowances = [{ allowance: 0n, expires_at: [] }];
        responses = [{ Ok: 1n }];

        expect(await client.approveSpending(LEDGER, SPENDER, 100n, FEE, validityMs)).toEqual(
            "success",
        );
        expect(approvals.map((a) => a.expires_at)).toEqual([
            [BigInt(NOW_MS + validityMs) * 1_000_000n],
        ]);
    });

    test("nothing is approved unless the account can afford the payment and the approval", async () => {
        balance = 100n + FEE - 1n;
        allowances = [{ allowance: 0n, expires_at: [] }];

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("insufficient_funds");
        expect(approvals).toEqual([]);
    });

    test("an allowance which changed as it was being added to is read again", async () => {
        allowances = [
            { allowance: 0n, expires_at: [] },
            { allowance: 40n, expires_at: [] },
        ];
        responses = [{ Err: { AllowanceChanged: { current_allowance: 40n } } }, { Ok: 1n }];

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("success");
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

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("failure");
        expect(approvals.length).toEqual(2);
    });

    test("an approval which a slow clock had expire already is made again by the ledger's time", async () => {
        const ledgerTime = BigInt(NOW_MS + 60 * 60 * 1000) * 1_000_000n;
        allowances = [
            { allowance: 0n, expires_at: [] },
            { allowance: 0n, expires_at: [] },
        ];
        responses = [{ Err: { Expired: { ledger_time: ledgerTime } } }, { Ok: 1n }];

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("success");
        expect(approvals.map((a) => a.expires_at)).toEqual([
            [EXPIRY],
            [ledgerTime + BigInt(APPROVAL_VALIDITY_MS) * 1_000_000n],
        ]);
    });

    test("an approval the ledger rejects is not retried", async () => {
        allowances = [{ allowance: 0n, expires_at: [] }];
        responses = [{ Err: { TemporarilyUnavailable: null } }];

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("failure");
        expect(approvals.length).toEqual(1);
    });

    test("the ledger finding the account can't afford the approval is reported as such", async () => {
        allowances = [{ allowance: 0n, expires_at: [] }];
        responses = [{ Err: { InsufficientFunds: { balance: 0n } } }];

        expect(
            await client.approveSpending(LEDGER, SPENDER, 100n, FEE, APPROVAL_VALIDITY_MS),
        ).toEqual("insufficient_funds");
    });
});

describe("LedgerClient.withdraw", () => {
    const CHAT_LEDGER = "2ouva-viaaa-aaaaq-aaamq-cai";
    const CREATED = 1_800_000_000_000_000_000n;
    const RECIPIENT = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");
    const RECIPIENT_SUBACCOUNT = new Uint8Array(32).fill(5);
    const RECIPIENT_ACCOUNT_ID = AccountIdentifier.fromPrincipal({ principal: RECIPIENT });
    // "OC_SEND", as the User canister's `withdraw_crypto_v2` memos a withdrawal
    const MEMO = new TextEncoder().encode("OC_SEND");
    const MEMO_NUMBER = 0x4f435f53454e44n;

    let icrc1Transfers: [string, TransferArg][];
    let icpTransfers: [string, IcpTransferArgs][];
    let icrc1Response: TransferResult;
    let icpResponse: IcpTransferResult;
    let client: LedgerClient;

    function withdrawal(
        to: string,
        overrides: Partial<PendingCryptocurrencyWithdrawal> = {},
    ): PendingCryptocurrencyWithdrawal {
        return {
            kind: "pending",
            ledger: CHAT_LEDGER,
            token: "CHAT",
            to,
            amountE8s: 500n,
            feeE8s: FEE,
            createdAtNanos: CREATED,
            ...overrides,
        };
    }

    const icpToAccountId = (overrides: Partial<PendingCryptocurrencyWithdrawal> = {}) =>
        withdrawal(RECIPIENT_ACCOUNT_ID.toHex(), {
            ledger: LEDGER,
            token: "ICP",
            feeE8s: 10_000n,
            ...overrides,
        });

    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});

        icrc1Transfers = [];
        icpTransfers = [];
        icrc1Response = { Ok: 7n };
        icpResponse = { Ok: 8n };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = Object.create(LedgerClient.prototype) as any;
        c.identity = { getPrincipal: () => ME };
        c.service = {
            icrc1_transfer: {
                withOptions:
                    ({ canisterId }: { canisterId: string }) =>
                    (args: TransferArg) => {
                        icrc1Transfers.push([canisterId, args]);
                        return Promise.resolve(icrc1Response);
                    },
            },
            transfer: {
                withOptions:
                    ({ canisterId }: { canisterId: string }) =>
                    (args: IcpTransferArgs) => {
                        icpTransfers.push([canisterId, args]);
                        return Promise.resolve(icpResponse);
                    },
            },
        };
        client = c;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("a token is sent to an ICRC-1 account from the caller's own account", async () => {
        const response = await client.withdraw(withdrawal(RECIPIENT.toText()));

        expect(icrc1Transfers).toEqual([
            [
                CHAT_LEDGER,
                {
                    to: { owner: RECIPIENT, subaccount: [] },
                    amount: 500n,
                    fee: [FEE],
                    memo: [MEMO],
                    from_subaccount: [],
                    created_at_time: [CREATED],
                },
            ],
        ]);
        expect(icpTransfers).toEqual([]);
        expect(response).toEqual({
            kind: "completed",
            ledger: CHAT_LEDGER,
            to: RECIPIENT.toText(),
            amountE8s: 500n,
            feeE8s: FEE,
            memo: MEMO_NUMBER,
            blockIndex: 7n,
        });
    });

    test("an ICRC-1 account's subaccount is sent to", async () => {
        const to = encodeIcrcAccount({ owner: RECIPIENT, subaccount: RECIPIENT_SUBACCOUNT });

        await client.withdraw(withdrawal(to));

        expect(icrc1Transfers.map(([, args]) => args.to)).toEqual([
            { owner: RECIPIENT, subaccount: [RECIPIENT_SUBACCOUNT] },
        ]);
    });

    test("ICP is sent to an ICRC-1 account as an ICRC-1 transfer", async () => {
        await client.withdraw(
            withdrawal(RECIPIENT.toText(), { ledger: LEDGER, token: "ICP", feeE8s: 10_000n }),
        );

        expect(icrc1Transfers.map(([ledger, args]) => [ledger, args.to, args.fee])).toEqual([
            [LEDGER, { owner: RECIPIENT, subaccount: [] }, [10_000n]],
        ]);
        expect(icpTransfers).toEqual([]);
    });

    test("ICP is sent to an account identifier by the ICP ledger's own transfer", async () => {
        const response = await client.withdraw(icpToAccountId());

        expect(icpTransfers).toEqual([
            [
                LEDGER,
                {
                    to: RECIPIENT_ACCOUNT_ID.toUint8Array(),
                    amount: { e8s: 500n },
                    fee: { e8s: 10_000n },
                    memo: MEMO_NUMBER,
                    from_subaccount: [],
                    created_at_time: [{ timestamp_nanos: CREATED }],
                },
            ],
        ]);
        expect(icrc1Transfers).toEqual([]);
        expect(response).toEqual({
            kind: "completed",
            ledger: LEDGER,
            to: RECIPIENT_ACCOUNT_ID.toHex(),
            amountE8s: 500n,
            feeE8s: 10_000n,
            memo: MEMO_NUMBER,
            blockIndex: 8n,
        });
    });

    test("ICP sent to an account identifier pays the ICP ledger's fee, whatever fee is given", async () => {
        await client.withdraw(icpToAccountId({ feeE8s: undefined }));
        await client.withdraw(icpToAccountId({ feeE8s: 0n }));

        expect(icpTransfers.map(([, args]) => args.fee)).toEqual([
            { e8s: 10_000n },
            { e8s: 10_000n },
        ]);
    });

    test("an account identifier isn't sent to for any token but ICP", async () => {
        await expect(client.withdraw(withdrawal(RECIPIENT_ACCOUNT_ID.toHex()))).rejects.toThrow();

        expect(icrc1Transfers).toEqual([]);
        expect(icpTransfers).toEqual([]);
    });

    const insufficientFunds = {
        kind: "error",
        code: ErrorCode.InsufficientFunds,
        message: undefined,
    };
    const transferFailed = {
        kind: "error",
        code: ErrorCode.TransferFailed,
        message: expect.stringContaining("Transfer failed."),
    };

    test.each<[string, TransferResult, unknown]>([
        ["InsufficientFunds", { Err: { InsufficientFunds: { balance: 1n } } }, insufficientFunds],
        ["TemporarilyUnavailable", { Err: { TemporarilyUnavailable: null } }, transferFailed],
    ])("the ICRC-1 ledger's %s is mapped", async (_, ledgerResponse, expected) => {
        icrc1Response = ledgerResponse;

        expect(await client.withdraw(withdrawal(RECIPIENT.toText()))).toEqual(expected);
    });

    test.each<[string, IcpTransferResult, unknown]>([
        [
            "InsufficientFunds",
            { Err: { InsufficientFunds: { balance: { e8s: 1n } } } },
            insufficientFunds,
        ],
        ["BadFee", { Err: { BadFee: { expected_fee: { e8s: 20n } } } }, transferFailed],
    ])("the ICP ledger's %s is mapped", async (_, ledgerResponse, expected) => {
        icpResponse = ledgerResponse;

        expect(await client.withdraw(icpToAccountId())).toEqual(expected);
    });

    test("a failure names the ledger's error", async () => {
        icrc1Response = { Err: { BadFee: { expected_fee: 20n } } };

        const response = await client.withdraw(withdrawal(RECIPIENT.toText()));

        expect(response.kind === "error" && response.message).toEqual(
            'Transfer failed. {"BadFee":{"expected_fee":"20"}}',
        );
    });

    test("a transfer the ICRC-1 ledger already made is reported as made", async () => {
        icrc1Response = { Err: { Duplicate: { duplicate_of: 3n } } };

        expect(await client.withdraw(withdrawal(RECIPIENT.toText()))).toMatchObject({
            kind: "completed",
            blockIndex: 3n,
        });
    });

    test("a transfer the ICP ledger already made is reported as made", async () => {
        icpResponse = { Err: { TxDuplicate: { duplicate_of: 4n } } };

        expect(await client.withdraw(icpToAccountId())).toMatchObject({
            kind: "completed",
            blockIndex: 4n,
        });
    });
});
