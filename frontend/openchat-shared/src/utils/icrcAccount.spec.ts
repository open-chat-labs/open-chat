import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { encodeIcrcAccount, icrcAccountToUserId, userIdToIcrcAccount } from "./icrcAccount";

const canisterId = "dfdal-2uaaa-aaaaa-qaama-cai";

// Taken from `impl From<UserId> for Account` in backend/libraries/types/src/user.rs by feeding
// it `UserId::new_indexed(canisterId, index)`. The two implementations have to agree exactly:
// the account they produce is the spender an external wallet approves, so a mismatch would have
// the wallet approve an account the user's canister never spends as, and every payment pulled
// from that wallet would fail as an insufficient allowance.
const vectors: [number, string, string | undefined][] = [
    [0, canisterId, undefined],
    [1, "qp43m-xeaaa-aaaaa-qaama-daa", "01"],
    [255, "bhdhu-34aaa-aaaaa-qaamp-7aa", "ff"],
    [256, "5xs3p-c4aaa-aaaaa-qaama-bai", "0100"],
    [1000, "svgk6-q4aaa-aaaaa-qaamo-ray", "03e8"],
    [32767, "zf6bn-quaaa-aaaaa-qaamp-77y", "7fff"],
];

describe("userIdToIcrcAccount", () => {
    test.each(vectors)("index %i", (_index, userId, subaccountHex) => {
        const account = userIdToIcrcAccount(userId);

        expect(account.owner.toText()).toBe(canisterId);

        if (subaccountHex === undefined) {
            expect(account.subaccount).toBeUndefined();
        } else {
            expect(account.subaccount).toHaveLength(32);
            expect(toHex(account.subaccount!)).toBe(subaccountHex.padStart(64, "0"));
        }
    });

    test("a user id which is a plain principal is its own owner", () => {
        // Bot and webhook ids are shorter than a canister id, so they can never be read as indexed
        const botId = Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).toText();
        const account = userIdToIcrcAccount(botId);

        expect(account.owner.toText()).toBe(botId);
        expect(account.subaccount).toBeUndefined();
    });

    test("index 0 encodes to the bare canister id, so existing addresses are unchanged", () => {
        expect(encodeIcrcAccount(userIdToIcrcAccount(canisterId))).toBe(canisterId);
    });

    test("an indexed user encodes to a distinct address", () => {
        const address = encodeIcrcAccount(userIdToIcrcAccount("qp43m-xeaaa-aaaaa-qaama-daa"));
        expect(address).not.toBe(canisterId);
        expect(address.startsWith(`${canisterId}-`)).toBe(true);
        expect(address.endsWith(".1")).toBe(true);
    });
});

describe("icrcAccountToUserId", () => {
    // The inverse has to agree with the forward direction for every index, else a transaction to a
    // user's wallet would be attributed to the canister holding them rather than to the user, and
    // every user in one canister would collapse to the same counterparty.
    test.each(vectors)("index %i round trips", (_index, userId) => {
        expect(icrcAccountToUserId(userIdToIcrcAccount(userId))).toBe(userId);
    });

    test("an explicit all-zero subaccount is the unindexed user", () => {
        const account = { owner: Principal.fromText(canisterId), subaccount: new Uint8Array(32) };

        expect(icrcAccountToUserId(account)).toBe(canisterId);
    });

    test("a bot id, which is not a canister, is still its own wallet", () => {
        const botId = Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).toText();

        expect(icrcAccountToUserId({ owner: Principal.fromText(botId) })).toBe(botId);
    });

    test("an indexed subaccount of an owner which is not a canister is nobody's wallet", () => {
        const owner = Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

        expect(icrcAccountToUserId({ owner, subaccount: subaccountOf(1) })).toBeUndefined();
    });

    test("a subaccount which is not of the indexed form is nobody's wallet", () => {
        const owner = Principal.fromText(canisterId);
        const arbitrary = subaccountOf(1);
        arbitrary[0] = 1;

        expect(icrcAccountToUserId({ owner, subaccount: arbitrary })).toBeUndefined();
    });

    test("an index beyond the range a UserId can hold is nobody's wallet", () => {
        const owner = Principal.fromText(canisterId);

        expect(icrcAccountToUserId({ owner, subaccount: subaccountOf(32767) })).not.toBeUndefined();
        expect(icrcAccountToUserId({ owner, subaccount: subaccountOf(32768) })).toBeUndefined();
    });

    test("a subaccount of the wrong length is nobody's wallet", () => {
        const owner = Principal.fromText(canisterId);

        expect(icrcAccountToUserId({ owner, subaccount: new Uint8Array(31) })).toBeUndefined();
    });
});

function subaccountOf(index: number): Uint8Array {
    const subaccount = new Uint8Array(32);
    subaccount[30] = (index >> 8) & 0xff;
    subaccount[31] = index & 0xff;
    return subaccount;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
