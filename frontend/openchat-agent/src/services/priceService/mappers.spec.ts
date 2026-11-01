import type { CryptocurrencyDetails } from "@shared";
import { vi } from "vitest";
import { priceHistoryResponse, pricesResponse } from "./mappers";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const CHAT_LEDGER = "2ouva-viaaa-aaaaq-aaamq-cai";
const CKSOL_LEDGER = "ls5lp-lqaaa-aaaar-qb5oa-cai";
const NOW = 1_792_926_499_000;
const MINUTE = 60 * 1000;

function token(symbol: string, ledger: string): CryptocurrencyDetails {
    return { symbol, ledger } as CryptocurrencyDetails;
}

const supportedTokens = [
    token("ICP", ICP_LEDGER),
    token("CHAT", CHAT_LEDGER),
    token("ckSOL", CKSOL_LEDGER),
];

const sources = {
    coingecko: {
        name: "CoinGecko",
        url: "https://www.coingecko.com",
        token_url: "https://www.coingecko.com/en/coins/{id}",
    },
    icpswap: {
        name: "ICPSwap",
        url: "https://www.icpswap.com",
        token_url: "https://app.icpswap.com/info-tokens/details/{id}",
    },
};

function quietly<T>(fn: () => T): T {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
        return fn();
    } finally {
        error.mockRestore();
    }
}

describe("the price service's prices", () => {
    test("are keyed by ledger, with where each is from", () => {
        const prices = pricesResponse(
            {
                timestamp: NOW - MINUTE,
                prices: {
                    [ICP_LEDGER]: { usd: 2.58132, source: "icpswap" },
                    [CHAT_LEDGER]: { usd: 0.0281335 },
                },
            },
            supportedTokens,
        );

        expect(prices?.exchangeRates).toEqual({
            [ICP_LEDGER]: { toUSD: 2.58132, source: "icpswap" },
            [CHAT_LEDGER]: { toUSD: 0.0281335 },
        });
    });

    test("ignore ledgers we don't support, fields we don't know, and prices that aren't", () => {
        const prices = pricesResponse(
            {
                timestamp: NOW - MINUTE,
                prices: {
                    [ICP_LEDGER]: { usd: 2.58, change24h: -3.2 },
                    [CKSOL_LEDGER]: { usd: 0 },
                    "74a53-yyaaa-aaaar-qadeq-cai": { usd: 1.2 },
                },
            },
            supportedTokens,
        );

        expect(prices?.exchangeRates).toEqual({ [ICP_LEDGER]: { toUSD: 2.58 } });
    });

    test("don't judge how old they are by the device's clock, which can be hours out", () => {
        const prices = pricesResponse(
            { timestamp: NOW - 24 * 60 * MINUTE, prices: { [ICP_LEDGER]: { usd: 2.58 } } },
            supportedTokens,
        );

        expect(prices?.exchangeRates).toEqual({ [ICP_LEDGER]: { toUSD: 2.58 } });
    });

    test("include the coins OpenChat doesn't list, keyed by symbol in lower case", () => {
        const prices = pricesResponse(
            {
                prices: {},
                coins: {
                    ADA: {
                        id: "cardano",
                        name: "Cardano",
                        usd: 0.204927,
                        source: "coingecko",
                        change24h: -1.2,
                    },
                    DUD: { id: "dud", name: "Dud", usd: 0, source: "coingecko" },
                },
                sources,
            },
            supportedTokens,
        );

        expect(prices?.coins).toEqual({
            ada: {
                id: "cardano",
                symbol: "ADA",
                name: "Cardano",
                usd: 0.204927,
                source: "coingecko",
            },
        });
    });

    test("include where prices come from", () => {
        const prices = pricesResponse(
            {
                prices: {},
                sources: {
                    ...sources,
                    shady: { name: "Shady", token_url: "javascript:alert(1)" },
                },
            },
            supportedTokens,
        );

        expect(prices?.sources).toEqual({
            coingecko: { name: "CoinGecko", tokenUrl: "https://www.coingecko.com/en/coins/{id}" },
            icpswap: {
                name: "ICPSwap",
                tokenUrl: "https://app.icpswap.com/info-tokens/details/{id}",
            },
        });
    });

    test("leave out a coin whose source isn't described, as it couldn't be credited", () => {
        const prices = pricesResponse(
            {
                prices: {},
                coins: { ADA: { id: "cardano", name: "Cardano", usd: 0.2, source: "coingecko" } },
                sources: { icpswap: sources.icpswap },
            },
            supportedTokens,
        );

        expect(prices?.coins).toEqual({});
    });

    test("leave out a source with no token url and its coins, but keep the tokens' prices", () => {
        const prices = quietly(() =>
            pricesResponse(
                {
                    prices: { [ICP_LEDGER]: { usd: 2.58 } },
                    coins: {
                        ADA: { id: "cardano", name: "Cardano", usd: 0.2, source: "coingecko" },
                    },
                    sources: { coingecko: { name: "CoinGecko", url: "https://www.coingecko.com" } },
                },
                supportedTokens,
            ),
        );

        expect(prices).toEqual({
            exchangeRates: { [ICP_LEDGER]: { toUSD: 2.58 } },
            coins: {},
            sources: {},
        });
    });

    test("parse each source on its own, so a bad one doesn't drop the rest", () => {
        const prices = quietly(() =>
            pricesResponse(
                {
                    prices: {},
                    coins: {
                        ADA: { id: "cardano", name: "Cardano", usd: 0.2, source: "coingecko" },
                    },
                    sources: { ...sources, newcomer: { name: "Newcomer" } },
                },
                supportedTokens,
            ),
        );

        expect(Object.keys(prices?.sources ?? {})).toEqual(["coingecko", "icpswap"]);
        expect(prices?.coins.ada?.id).toBe("cardano");
    });

    test("keep the tokens' prices when the coins or sources can't be parsed", () => {
        const prices = quietly(() =>
            pricesResponse(
                {
                    prices: { [ICP_LEDGER]: { usd: 2.58 } },
                    coins: { ADA: { usd: "lots" } },
                    sources: [],
                },
                supportedTokens,
            ),
        );

        expect(prices).toEqual({
            exchangeRates: { [ICP_LEDGER]: { toUSD: 2.58 } },
            coins: {},
            sources: {},
        });
    });

    test("are undefined when the tokens' prices can't be parsed", () => {
        expect(quietly(() => pricesResponse({ error: "oops" }, supportedTokens))).toBeUndefined();
    });
});

describe("a price history from the price service", () => {
    test("is its points, oldest first, and where they're from", () => {
        const history = priceHistoryResponse({
            id: "cardano",
            range: "7d",
            interval: "1h",
            source: "coingecko",
            points: [
                [NOW - 2 * 60 * MINUTE, 0.2131],
                [NOW, 0.204927],
                [NOW - 60 * MINUTE, 0.2101],
            ],
        });

        expect(history).toEqual({
            points: [
                { timestamp: NOW - 2 * 60 * MINUTE, usd: 0.2131 },
                { timestamp: NOW - 60 * MINUTE, usd: 0.2101 },
                { timestamp: NOW, usd: 0.204927 },
            ],
            source: "coingecko",
        });
    });

    test("leaves out points that aren't prices", () => {
        const history = priceHistoryResponse({
            points: [
                [NOW - 60 * MINUTE, 0],
                [NOW, 0.0281335],
            ],
        });

        expect(history).toEqual({
            points: [{ timestamp: NOW, usd: 0.0281335 }],
            source: undefined,
        });
    });

    test("is empty for a token that has never traded", () => {
        expect(priceHistoryResponse({ ledger: CHAT_LEDGER, points: [] })?.points).toEqual([]);
    });

    test("is undefined when the response can't be parsed", () => {
        expect(quietly(() => priceHistoryResponse({ error: "Unknown ledger" }))).toBeUndefined();
    });
});
