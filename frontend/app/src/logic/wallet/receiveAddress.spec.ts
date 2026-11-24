import { describe, expect, test } from "vitest";
import { icNetwork, userWalletAddress } from "./receiveAddress";

describe("the IC network of a token's networks", () => {
    test("is ckBTC for BTC, ckSOL for SOL and ICP for a oneSec token's chains", () => {
        expect(icNetwork(["BTC", "ckBTC"])).toBe("ckBTC");
        expect(icNetwork(["SOL", "ckSOL"])).toBe("ckSOL");
        expect(icNetwork(["ICP", "Ethereum", "Arbitrum"])).toBe("ICP");
    });

    test("is none for a token with no networks to choose from", () => {
        expect(icNetwork([])).toBeUndefined();
    });
});

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
