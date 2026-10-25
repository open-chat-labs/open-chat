import type { PriceSource } from "@shared";
import { priceCredits } from "./priceSources";

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
