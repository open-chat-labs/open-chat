import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { apiIcrcAccount } from "./icrcAccount";

describe("apiIcrcAccount", () => {
    const owner = Principal.fromText("dfdal-2uaaa-aaaaa-qaama-cai");

    test("the default subaccount is an empty option", () => {
        const account = apiIcrcAccount({ owner });

        expect(account.owner).toBe(owner);
        expect(account.subaccount).toEqual([]);
    });

    test("a subaccount is wrapped in an option", () => {
        const subaccount = new Uint8Array(32).fill(1);
        const account = apiIcrcAccount({ owner, subaccount });

        expect(account.owner).toBe(owner);
        expect(account.subaccount).toEqual([subaccount]);
    });
});
