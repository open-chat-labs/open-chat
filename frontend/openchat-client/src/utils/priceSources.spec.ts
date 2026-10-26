import type { PriceSource } from "@shared";
import { priceCredits, priceSourcesFor } from "./priceSources";

const coingecko: PriceSource = {
    name: "CoinGecko",
    url: "https://www.coingecko.com",
    attributionRequired: true,
};
const icpswap: PriceSource = {
    name: "ICPSwap",
    url: "https://www.icpswap.com",
    attributionRequired: false,
};
const sources = new Map([
    ["coingecko", coingecko],
    ["icpswap", icpswap],
]);

describe("priceCredits", () => {
    test("credits the sources that require it, each once", () => {
        expect(priceCredits(sources, ["coingecko", "icpswap", "coingecko"])).toEqual([coingecko]);
    });

    test("credits nothing for prices with no source, or one it doesn't know", () => {
        expect(priceCredits(sources, [undefined, "elsewhere", "icpswap"])).toEqual([]);
    });
});

describe("priceSourcesFor", () => {
    test("names every source the prices come from, each once, whether or not it asks for credit", () => {
        expect(priceSourcesFor(sources, ["icpswap", "coingecko", "icpswap"])).toEqual([
            icpswap,
            coingecko,
        ]);
    });

    test("names nothing for prices with no source, or one it doesn't know", () => {
        expect(priceSourcesFor(sources, [undefined, "elsewhere"])).toEqual([]);
    });
});
