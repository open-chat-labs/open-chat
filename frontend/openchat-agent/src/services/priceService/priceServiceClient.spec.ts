import type { CryptocurrencyDetails } from "@shared";
import { afterEach, vi } from "vitest";
import { PriceServiceClient } from "./priceServiceClient";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const supportedTokens = [{ symbol: "ICP", ledger: ICP_LEDGER } as CryptocurrencyDetails];

function respond(status: number, body: unknown) {
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
}

describe("the price service client", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("asks for the prices and a 7-day history at the service's URL, less any trailing slash", async () => {
        const fetch = respond(200, { timestamp: 0, prices: { [ICP_LEDGER]: { usd: 2.58 } } });
        const client = new PriceServiceClient("https://prices.example.com/");

        expect(await client.exchangeRates(supportedTokens)).toEqual({
            [ICP_LEDGER]: { toUSD: 2.58 },
        });
        await client.priceHistory(ICP_LEDGER);

        expect(fetch.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
            "https://prices.example.com/v1/prices",
            `https://prices.example.com/v1/prices/${ICP_LEDGER}/history?range=7d`,
        ]);
    });

    test("gives no prices or history when the service answers with an error", async () => {
        respond(503, { error: "Prices are stale" });
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        const client = new PriceServiceClient("https://prices.example.com");

        expect(await client.exchangeRates(supportedTokens)).toBeUndefined();
        expect(await client.priceHistory(ICP_LEDGER)).toBeUndefined();
        log.mockRestore();
    });
});
