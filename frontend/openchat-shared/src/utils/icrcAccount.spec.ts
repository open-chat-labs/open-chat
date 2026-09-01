import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { encodeIcrcAccount, userIdToIcrcAccount } from "./icrcAccount";

describe("userIdToIcrcAccount", () => {
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

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
