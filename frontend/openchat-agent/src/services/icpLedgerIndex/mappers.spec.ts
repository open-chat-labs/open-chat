import { AccountIdentifier } from "@icp-sdk/canisters/ledger/icp";
import { Principal } from "@icp-sdk/core/principal";
import type { AccountTransaction } from "@shared";
import { describe, expect, test } from "vitest";
import type { Wallets } from "../ledgerIndex/mappers";
import { accountTransactions } from "./mappers";

// A user in a MultiUser canister, whose wallet is the account of the principal they sign in with,
// and whose wallet before they were migrated there was the account of the User canister they had
const userId = "qp43m-xeaaa-aaaaa-qaama-daa";
const principal = Principal.fromUint8Array(new Uint8Array(29).fill(7));
const previousUserId = "7ugoi-yiaaa-aaaaa-aabaa-cai";
const wallets: Wallets = {
    accounts: [{ owner: principal }, { owner: Principal.fromText(previousUserId) }],
    userId,
};

function identifier(principal: Principal): string {
    return AccountIdentifier.fromPrincipal({ principal }).toHex();
}

const walletIdentifier = identifier(principal);
const previousWalletIdentifier = identifier(Principal.fromText(previousUserId));
const otherIdentifier = identifier(Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai"));

function transfer(from: string, to: string): AccountTransaction {
    const result = accountTransactions(
        {
            Ok: {
                balance: 0n,
                oldest_tx_id: [],
                transactions: [
                    {
                        id: 1n,
                        transaction: {
                            memo: 0n,
                            icrc1_memo: [],
                            timestamp: [],
                            created_at_time: [],
                            operation: {
                                Transfer: {
                                    from,
                                    to,
                                    fee: { e8s: 10_000n },
                                    amount: { e8s: 1n },
                                    spender: [],
                                },
                            },
                        },
                    },
                ],
            },
        },
        wallets,
    );
    if (result.kind !== "success") throw new Error("Expected success");
    return result.transactions[0];
}

describe("accountTransactions", () => {
    test("the wallet being listed is named by its user's id", () => {
        const t = transfer(walletIdentifier, otherIdentifier);

        expect(t.kind === "transfer" && t.from).toBe(userId);
        expect(t.kind === "transfer" && t.to).toBe(otherIdentifier);
    });

    test("the wallet the user had before being migrated is named by their user id too", () => {
        const t = transfer(previousWalletIdentifier, walletIdentifier);

        expect(t.kind === "transfer" && t.from).toBe(userId);
        expect(t.kind === "transfer" && t.to).toBe(userId);
    });
});
