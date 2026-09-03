import { describe, expect, test } from "vitest";
import { userIdToApiIcrcAccount } from "./icrcAccount";

describe("userIdToApiIcrcAccount", () => {
    const canisterId = "dfdal-2uaaa-aaaaa-qaama-cai";

    test("a user alone in their canister is the canister's default account", () => {
        const account = userIdToApiIcrcAccount(canisterId);

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toEqual([]);
    });

    test("an indexed user is a subaccount of the canister holding them", () => {
        // `UserId::new_indexed(canisterId, 1000)`, per the vector in openchat-shared
        const account = userIdToApiIcrcAccount("svgk6-q4aaa-aaaaa-qaamo-ray");

        expect(account.owner.toText()).toBe(canisterId);
        expect(account.subaccount).toHaveLength(1);
        const subaccount = account.subaccount[0]!;
        expect(subaccount).toHaveLength(32);
        expect(Array.from(subaccount.subarray(30))).toEqual([0x03, 0xe8]);
        expect(subaccount.subarray(0, 30).every((b) => b === 0)).toBe(true);
    });
});
