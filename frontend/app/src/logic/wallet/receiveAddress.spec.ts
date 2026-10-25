import { describe, expect, test } from "vitest";
import { userWalletAddress } from "./receiveAddress";

describe("the user's wallet address", () => {
    test("is their user canister's account when their id is a canister, without asking the principal", () => {
        const canister = "ryjl3-tyaaa-aaaaa-aaaba-cai";
        expect(
            userWalletAddress(canister, () => {
                throw new Error("not asked");
            }),
        ).toBe(canister);
    });
});
