import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import {
    encodeIcrcAccount,
    icrcAccountToUserId,
    spenderSubaccount,
    userCanisterSpenderAccount,
    userWalletAccount,
} from "./icrcAccount";

const canisterId = "dfdal-2uaaa-aaaaa-qaama-cai";
// A user in the MultiUser canister `canisterId`, at index 1
const indexedUserId = "qp43m-xeaaa-aaaaa-qaama-daa";
// A self-authenticating principal, as users sign in with
const principal = Principal.fromUint8Array(new Uint8Array(29).fill(7)).toText();

describe("userWalletAccount", () => {
    test("a user alone in their canister holds their funds in its account", () => {
        const account = userWalletAccount(canisterId, principal);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toBeUndefined();
    });

    test("a user in a MultiUser canister holds their funds in their principal's account", () => {
        const account = userWalletAccount(indexedUserId, principal);

        expect(account.owner.toText()).toBe(principal);
        expect(account.subaccount).toBeUndefined();
    });

    test("the wallet of a user alone in their canister encodes to their user id", () => {
        expect(encodeIcrcAccount(userWalletAccount(canisterId, principal))).toBe(canisterId);
    });
});

describe("userCanisterSpenderAccount", () => {
    test("a User canister spends as itself", () => {
        const account = userCanisterSpenderAccount(canisterId, principal);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toBeUndefined();
    });

    test("a MultiUser canister spends under the user's own subaccount", () => {
        const account = userCanisterSpenderAccount(indexedUserId, principal);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toEqual(spenderSubaccount(Principal.fromText(principal)));
    });
});

describe("spenderSubaccount", () => {
    // `ledger_utils::convert_to_subaccount` writes the principal's length, then its bytes, then
    // zeroes. A mismatch would have the user approve a subaccount their canister never spends
    // under, and every payment pulled from their wallet would fail as an insufficient allowance.
    test("is the principal's length followed by its bytes", () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const subaccount = spenderSubaccount(Principal.fromUint8Array(bytes));

        expect(subaccount).toHaveLength(32);
        expect(toHex(subaccount)).toBe("0a0102030405060708090a".padEnd(64, "0"));
    });

    test("fits the longest principal", () => {
        const subaccount = spenderSubaccount(Principal.fromUint8Array(new Uint8Array(29).fill(7)));

        expect(subaccount).toHaveLength(32);
        expect(subaccount[0]).toBe(29);
        expect(subaccount.subarray(1, 30).every((b) => b === 7)).toBe(true);
        expect(subaccount.subarray(30).every((b) => b === 0)).toBe(true);
    });
});

describe("icrcAccountToUserId", () => {
    test("the default subaccount is the owner's wallet", () => {
        expect(icrcAccountToUserId({ owner: Principal.fromText(canisterId) })).toBe(canisterId);
        expect(icrcAccountToUserId({ owner: Principal.fromText(principal) })).toBe(principal);
    });

    test("an explicit all-zero subaccount is the owner's wallet", () => {
        const account = { owner: Principal.fromText(canisterId), subaccount: new Uint8Array(32) };

        expect(icrcAccountToUserId(account)).toBe(canisterId);
    });

    test("any other subaccount is nobody's wallet", () => {
        const owner = Principal.fromText(canisterId);
        const subaccount = new Uint8Array(32);
        subaccount[31] = 1;

        expect(icrcAccountToUserId({ owner, subaccount })).toBeUndefined();
    });

    test("a subaccount of the wrong length is nobody's wallet", () => {
        const owner = Principal.fromText(canisterId);

        expect(icrcAccountToUserId({ owner, subaccount: new Uint8Array(31) })).toBeUndefined();
    });
});

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
