import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import {
    indexedUserId,
    isMultiUserCanisterUser,
    userCanisterId,
    userIndexWithinCanister,
} from "./userId";

const canisterId = "dfdal-2uaaa-aaaaa-qaama-cai";

// Taken from `UserId::new_indexed(canisterId, index)` in backend/libraries/types/src/user.rs
const indexedVectors: [number, string][] = [
    [1, "qp43m-xeaaa-aaaaa-qaama-daa"],
    [255, "bhdhu-34aaa-aaaaa-qaamp-7aa"],
    [256, "5xs3p-c4aaa-aaaaa-qaama-bai"],
    [1000, "svgk6-q4aaa-aaaaa-qaamo-ray"],
    [32767, "zf6bn-quaaa-aaaaa-qaamp-77y"],
];

const botId = Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).toText();

describe("indexed user ids", () => {
    test.each(indexedVectors)("index %i round trips", (index, userId) => {
        expect(indexedUserId(Principal.fromText(canisterId), index)).toBe(userId);
        expect(userCanisterId(userId).toText()).toBe(canisterId);
        expect(userIndexWithinCanister(userId)).toBe(index);
    });

    test("a User canister user is held by the canister their id names, at index 0", () => {
        expect(userCanisterId(canisterId).toText()).toBe(canisterId);
        expect(userIndexWithinCanister(canisterId)).toBe(0);
    });
});

describe("isMultiUserCanisterUser", () => {
    test("a user with a User canister of their own is not", () => {
        expect(isMultiUserCanisterUser(canisterId)).toBe(false);
    });

    test.each(indexedVectors)("index %i is", (_index, userId) => {
        expect(isMultiUserCanisterUser(userId)).toBe(true);
    });

    test("index 0 in a MultiUser canister is, since the index tag is still set", () => {
        const bytes = Principal.fromText(canisterId).toUint8Array().slice();
        bytes[8] = 0;
        bytes[9] = 0x80;
        expect(isMultiUserCanisterUser(Principal.fromUint8Array(bytes).toText())).toBe(true);
    });

    test("a bot or webhook id is not", () => {
        expect(isMultiUserCanisterUser(botId)).toBe(false);
    });
});
