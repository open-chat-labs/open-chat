import { Principal } from "@icp-sdk/core/principal";
import type { AccountTransaction } from "@shared";
import { describe, expect, test } from "vitest";
import type { ApiAccount } from "./candid/idl";
import { accountTransactions, type Wallet } from "./mappers";

// A user in the MultiUser canister "dfdal-2uaaa-aaaaa-qaama-cai", at index 1, whose wallet is the
// account of the principal they sign in with
const userId = "qp43m-xeaaa-aaaaa-qaama-daa";
const principal = Principal.fromUint8Array(new Uint8Array(29).fill(7));
const wallet: Wallet = { account: { owner: principal }, userId };

const otherUserId = "rrkah-fqaaa-aaaaa-aaaaq-cai";

function transfer(from: ApiAccount, to: ApiAccount): AccountTransaction {
    const result = accountTransactions(
        {
            Ok: {
                balance: 0n,
                oldest_tx_id: [],
                transactions: [
                    {
                        id: 1n,
                        transaction: {
                            kind: "transfer",
                            timestamp: 0n,
                            burn: [],
                            mint: [],
                            approve: [],
                            transfer: [
                                {
                                    from,
                                    to,
                                    fee: [],
                                    memo: [],
                                    created_at_time: [],
                                    amount: 1n,
                                    spender: [],
                                },
                            ],
                        },
                    },
                ],
            },
        },
        wallet,
    );
    if (result.kind !== "success") throw new Error("Expected success");
    return result.transactions[0];
}

describe("accountTransactions", () => {
    test("the wallet being listed is named by its user's id", () => {
        const t = transfer(
            { owner: principal, subaccount: [] },
            { owner: Principal.fromText(otherUserId), subaccount: [] },
        );

        expect(t.kind === "transfer" && t.from).toBe(userId);
        expect(t.kind === "transfer" && t.to).toBe(otherUserId);
    });

    test("the wallet is recognised with an explicit all-zero subaccount", () => {
        const t = transfer(
            { owner: Principal.fromText(otherUserId), subaccount: [] },
            { owner: principal, subaccount: [new Uint8Array(32)] },
        );

        expect(t.kind === "transfer" && t.to).toBe(userId);
    });

    test("another subaccount of the wallet's owner keeps its full encoding", () => {
        const subaccount = new Uint8Array(32);
        subaccount[31] = 1;
        const t = transfer(
            { owner: principal, subaccount: [subaccount] },
            { owner: Principal.fromText(otherUserId), subaccount: [] },
        );

        expect(t.kind === "transfer" && t.from).not.toBe(userId);
        expect(t.kind === "transfer" && t.from).toContain(".1");
    });
});
