import type { PriceSource } from "@shared";
import { priceSourcesFor } from "./priceSources";

const coingecko: PriceSource = { name: "CoinGecko", url: "https://www.coingecko.com" };
const icpswap: PriceSource = { name: "ICPSwap", url: "https://www.icpswap.com" };
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
