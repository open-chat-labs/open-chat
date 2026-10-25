import { Type } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type { CryptocurrencyDetails, TokenExchangeRates, TokenPricePoint } from "@shared";
import { typeboxValidate } from "../../utils/typebox";

// Prices this old mean the service has stopped refreshing them
const STALE_AFTER_MILLIS = 60 * 60 * 1000;

const PricesResponse = Type.Object({
    timestamp: Type.Number(),
    prices: Type.Record(Type.String(), Type.Object({ usd: Type.Number() })),
});

const PriceHistoryResponse = Type.Object({
    points: Type.Array(Type.Tuple([Type.Number(), Type.Number()])),
});

// Keyed by ledger, for the tokens we support. Undefined if the response can't be parsed or its
// prices are stale, so the prices already loaded are kept
export function pricesResponse(
    json: unknown,
    supportedTokens: CryptocurrencyDetails[],
    now: number,
): Record<string, TokenExchangeRates> | undefined {
    try {
        const value = typeboxValidate(json, PricesResponse);
        if (now - value.timestamp > STALE_AFTER_MILLIS) {
            console.log("The price service's prices are stale", value.timestamp);
            return undefined;
        }
        const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));
        const exchangeRates: Record<string, TokenExchangeRates> = {};
        for (const [ledger, { usd }] of Object.entries(value.prices)) {
            if (supportedLedgers.has(ledger) && isPrice(usd)) {
                exchangeRates[ledger] = { toUSD: usd };
            }
        }
        return exchangeRates;
    } catch (err) {
        console.error("Error parsing the price service's prices", formatError(err));
        return undefined;
    }
}

// Oldest first. Undefined if the response can't be parsed
export function priceHistoryResponse(json: unknown): TokenPricePoint[] | undefined {
    try {
        const value = typeboxValidate(json, PriceHistoryResponse);
        return value.points
            .filter(([, usd]) => isPrice(usd))
            .map(([timestamp, usd]) => ({ timestamp, usd }))
            .sort((a, b) => a.timestamp - b.timestamp);
    } catch (err) {
        console.error("Error parsing a price history from the price service", formatError(err));
        return undefined;
    }
}

function isPrice(usd: number): boolean {
    return Number.isFinite(usd) && usd > 0;
}

function formatError(err: unknown) {
    if (err instanceof AssertError) {
        return `${err.message}: ${err.error?.path}`;
    }
    return err;
}
