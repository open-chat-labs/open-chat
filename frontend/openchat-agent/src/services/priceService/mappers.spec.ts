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

function quietly<T>(fn: () => T): T {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
        return fn();
    } finally {
        error.mockRestore();
        log.mockRestore();
    }
}

describe("the price service's prices", () => {
    test("are keyed by ledger", () => {
        const rates = pricesResponse(
            {
                timestamp: NOW - MINUTE,
                prices: { [ICP_LEDGER]: { usd: 2.58132 }, [CHAT_LEDGER]: { usd: 0.0281335 } },
            },
            supportedTokens,
            NOW,
        );

        expect(rates).toEqual({
            [ICP_LEDGER]: { toUSD: 2.58132 },
            [CHAT_LEDGER]: { toUSD: 0.0281335 },
        });
    });

    test("ignore ledgers we don't support, fields we don't know, and prices that aren't", () => {
        const rates = pricesResponse(
            {
                timestamp: NOW - MINUTE,
                prices: {
                    [ICP_LEDGER]: { usd: 2.58, change24h: -3.2 },
                    [CKSOL_LEDGER]: { usd: 0 },
                    "74a53-yyaaa-aaaar-qadeq-cai": { usd: 1.2 },
                },
            },
            supportedTokens,
            NOW,
        );

        expect(rates).toEqual({ [ICP_LEDGER]: { toUSD: 2.58 } });
    });

    test("are undefined when over an hour old, so the ones already loaded are kept", () => {
        const rates = quietly(() =>
            pricesResponse(
                { timestamp: NOW - 61 * MINUTE, prices: { [ICP_LEDGER]: { usd: 2.58 } } },
                supportedTokens,
                NOW,
            ),
        );

        expect(rates).toBeUndefined();
    });

    test("are undefined when the response can't be parsed", () => {
        expect(quietly(() => pricesResponse({ error: "oops" }, supportedTokens, NOW))).toBeUndefined();
    });
});

describe("a price history from the price service", () => {
    test("is its points, oldest first", () => {
        const points = priceHistoryResponse({
            ledger: CHAT_LEDGER,
            range: "7d",
            interval: "1h",
            points: [
                [NOW - 2 * 60 * MINUTE, 0.0351],
                [NOW - 60 * MINUTE, 0.0349],
                [NOW, 0.0281335],
            ],
        });

        expect(points).toEqual([
            { timestamp: NOW - 2 * 60 * MINUTE, usd: 0.0351 },
            { timestamp: NOW - 60 * MINUTE, usd: 0.0349 },
            { timestamp: NOW, usd: 0.0281335 },
        ]);
    });

    test("leaves out points that aren't prices", () => {
        const points = priceHistoryResponse({
            points: [
                [NOW - 60 * MINUTE, 0],
                [NOW, 0.0281335],
            ],
        });

        expect(points).toEqual([{ timestamp: NOW, usd: 0.0281335 }]);
    });

    test("is empty for a token with no trades in the range", () => {
        expect(priceHistoryResponse({ ledger: CHAT_LEDGER, points: [] })).toEqual([]);
    });

    test("is undefined when the response can't be parsed", () => {
        expect(quietly(() => priceHistoryResponse({ error: "Unknown ledger" }))).toBeUndefined();
    });
});
