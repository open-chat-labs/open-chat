import type { PriceSource } from "@shared";
import { priceSourcesFor, priceSourceUrl } from "./priceSources";

const coingecko: PriceSource = {
    name: "CoinGecko",
    tokenUrl: "https://www.coingecko.com/en/coins/{id}",
};
const icpswap: PriceSource = {
    name: "ICPSwap",
    tokenUrl: "https://app.icpswap.com/info-tokens/details/{id}",
};
const sources = new Map([
    ["coingecko", coingecko],
    ["icpswap", icpswap],
]);

describe("priceSourcesFor", () => {
    test("names every source the prices come from, each once", () => {
        expect(priceSourcesFor(sources, ["icpswap", "coingecko", "icpswap"])).toEqual([
            icpswap,
            coingecko,
        ]);
    });

    test("names nothing for prices with no source, or one it doesn't know", () => {
        expect(priceSourcesFor(sources, [undefined, "elsewhere"])).toEqual([]);
    });
});

describe("priceSourceUrl", () => {
    test("links a token to its page, by its ledger", () => {
        const subject = { kind: "token", ledger: "2ouva-viaaa-aaaaq-aaamq-cai" } as const;
        expect(priceSourceUrl(icpswap, subject)).toEqual(
            "https://app.icpswap.com/info-tokens/details/2ouva-viaaa-aaaaq-aaamq-cai",
        );
    });

    test("links a coin to its page, by its id", () => {
        expect(priceSourceUrl(coingecko, { kind: "coin", id: "cardano" })).toEqual(
            "https://www.coingecko.com/en/coins/cardano",
        );
    });

    test("escapes the id", () => {
        expect(priceSourceUrl(coingecko, { kind: "coin", id: "a/b?c" })).toEqual(
            "https://www.coingecko.com/en/coins/a%2Fb%3Fc",
        );
    });
});
