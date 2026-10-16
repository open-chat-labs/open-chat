import { describe, expect, test } from "vitest";
import { TacoIndexClient } from "./taco.index.client";

const ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";

describe("TacoIndexClient walletInputTokens", () => {
    function client(enabled: boolean, allowedTokens: string[]): TacoIndexClient {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = Object.create(TacoIndexClient.prototype);
        client.service = {
            getV2Enabled: () => Promise.resolve(enabled),
            getV2AllowedTokens: () => Promise.resolve(allowedTokens),
        };
        return client;
    }

    test("are the tokens TACO allows to be pulled from the wallet", async () => {
        expect(await client(true, [ICP, CHAT]).walletInputTokens()).toEqual(new Set([ICP, CHAT]));
    });

    // TACO can list allowed tokens while it has wallet swaps switched off altogether
    test("are none while TACO has wallet swaps switched off", async () => {
        expect(await client(false, [ICP, CHAT]).walletInputTokens()).toEqual(new Set());
    });
});
