import { AccountIdentifier } from "@icp-sdk/canisters/ledger/icp";
import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import {
    encodeIcrcAccount,
    icrcAccountToUserId,
    isAccountOfMultiUserCanisterUserId,
    paymentSpenderAccount,
    spenderSubaccount,
    userCanisterSpenderAccount,
    userWalletAccount,
    walletApprovalFee,
} from "./icrcAccount";

const canisterId = "dfdal-2uaaa-aaaaa-qaama-cai";
// A user in the MultiUser canister `canisterId`, at index 1
const indexedUserId = "qp43m-xeaaa-aaaaa-qaama-daa";
// A self-authenticating principal, as users sign in with
const principal = Principal.fromUint8Array(new Uint8Array(29).fill(7)).toText();
const getPrincipal = () => principal;
// A user alone in their canister has no need of their principal, so it must never be asked for
const noPrincipal = (): string => {
    throw new Error("The principal was asked for");
};

describe("userWalletAccount", () => {
    test("a user alone in their canister holds their funds in its account", () => {
        const account = userWalletAccount(canisterId, noPrincipal);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toBeUndefined();
    });

    test("a user in a MultiUser canister holds their funds in their principal's account", () => {
        const account = userWalletAccount(indexedUserId, getPrincipal);

        expect(account.owner.toText()).toBe(principal);
        expect(account.subaccount).toBeUndefined();
    });

    test("the wallet of a user alone in their canister encodes to their user id", () => {
        expect(encodeIcrcAccount(userWalletAccount(canisterId, noPrincipal))).toBe(canisterId);
    });
});

describe("userCanisterSpenderAccount", () => {
    test("a User canister spends as itself", () => {
        const account = userCanisterSpenderAccount(canisterId, noPrincipal);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toBeUndefined();
    });

    test("a MultiUser canister spends under the user's own subaccount", () => {
        const account = userCanisterSpenderAccount(indexedUserId, getPrincipal);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toEqual(spenderSubaccount(Principal.fromText(principal)));
    });
});

describe("paymentSpenderAccount", () => {
    const groupId = "rrkah-fqaaa-aaaaa-aaaaq-cai";
    const communityId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
    const group = { kind: "group_chat", groupId } as const;
    const channel = { kind: "channel", communityId, channelId: 1 } as const;
    const direct = { kind: "direct_chat", userId: groupId } as const;

    test("a User canister pulls every payment its user makes", () => {
        for (const chatId of [group, channel, direct, undefined]) {
            const account = paymentSpenderAccount(canisterId, chatId, noPrincipal);

            expect(account.owner.toText()).toBe(canisterId);
            expect(account.subaccount).toBeUndefined();
        }
    });

    test("a group or community pulls a payment made in it by a user who holds their own funds", () => {
        for (const [chatId, owner] of [
            [group, groupId],
            [channel, communityId],
        ] as const) {
            const account = paymentSpenderAccount(indexedUserId, chatId, getPrincipal);

            expect(account.owner.toText()).toBe(owner);
            expect(account.subaccount).toEqual(spenderSubaccount(Principal.fromText(principal)));
        }
    });

    test("a MultiUser canister pulls any other payment made by a user who holds their own funds", () => {
        for (const chatId of [direct, undefined]) {
            const account = paymentSpenderAccount(indexedUserId, chatId, getPrincipal);

            expect(account.owner.toText()).toBe(canisterId);
            expect(account.subaccount).toEqual(spenderSubaccount(Principal.fromText(principal)));
        }
    });
});

describe("walletApprovalFee", () => {
    test("a user alone in their canister pays no approval fee", () => {
        expect(walletApprovalFee(canisterId, 10_000n)).toBe(0n);
    });

    test("a user who holds their own funds pays the transfer fee for the approval", () => {
        expect(walletApprovalFee(indexedUserId, 10_000n)).toBe(10_000n);
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

describe("isAccountOfMultiUserCanisterUserId", () => {
    test("a MultiUser user's id is refused, under any subaccount", () => {
        const subaccount = new Uint8Array(32);
        subaccount[31] = 1;
        const withSubaccount = encodeIcrcAccount({
            owner: Principal.fromText(indexedUserId),
            subaccount,
        });

        expect(isAccountOfMultiUserCanisterUserId(indexedUserId)).toBe(true);
        expect(isAccountOfMultiUserCanisterUserId(withSubaccount)).toBe(true);
    });

    test("a wallet is not refused", () => {
        expect(isAccountOfMultiUserCanisterUserId(canisterId)).toBe(false);
        expect(isAccountOfMultiUserCanisterUserId(principal)).toBe(false);
    });

    test("anything else is not refused", () => {
        const accountIdentifier = AccountIdentifier.fromPrincipal({
            principal: Principal.fromText(indexedUserId),
        }).toHex();

        expect(isAccountOfMultiUserCanisterUserId("")).toBe(false);
        expect(isAccountOfMultiUserCanisterUserId("not an address")).toBe(false);
        // A hash, from which the owner can't be read
        expect(isAccountOfMultiUserCanisterUserId(accountIdentifier)).toBe(false);
    });
});

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
