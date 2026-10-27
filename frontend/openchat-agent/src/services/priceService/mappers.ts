import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type {
    CashtagCoin,
    CryptocurrencyDetails,
    PriceHistory,
    PriceSource,
    TokenExchangeRates,
    TokenPrices,
} from "@shared";
import { typeboxValidate } from "../../utils/typebox";

const Prices = Type.Object({
    prices: Type.Record(
        Type.String(),
        Type.Object({ usd: Type.Number(), source: Type.Optional(Type.String()) }),
    ),
});

const Coin = Type.Object({
    id: Type.String(),
    name: Type.String(),
    usd: Type.Number(),
    source: Type.Optional(Type.String()),
});

const Source = Type.Object({
    name: Type.String(),
    url: Type.String(),
});

const PriceHistoryResponse = Type.Object({
    points: Type.Array(Type.Tuple([Type.Number(), Type.Number()])),
    source: Type.Optional(Type.String()),
});

// The prices of the tokens we support, keyed by ledger, and of the coins OpenChat doesn't list,
// keyed by symbol in lower case. Undefined if the tokens' prices can't be parsed, so the prices
// already loaded are kept; coins or sources that can't be parsed are left out, each on its own. A
// coin whose source can't be credited is left out too, as its price mustn't be shown uncredited.
// Whether the prices are fresh is the service's call (it answers 503 when they aren't): the device's
// clock can be hours out
export function pricesResponse(
    json: unknown,
    supportedTokens: CryptocurrencyDetails[],
): TokenPrices | undefined {
    const prices = parse(json, Prices, "prices");
    if (prices === undefined) return undefined;

    const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));
    const exchangeRates: Record<string, TokenExchangeRates> = {};
    for (const [ledger, { usd, source }] of Object.entries(prices.prices)) {
        if (supportedLedgers.has(ledger) && isPrice(usd)) {
            exchangeRates[ledger] = source !== undefined ? { toUSD: usd, source } : { toUSD: usd };
        }
    }

    const sources: Record<string, PriceSource> = {};
    for (const [key, entry] of Object.entries(entries(json, "sources"))) {
        const s = parse(entry, Source, `source ${key}`);
        // it becomes a link
        if (s !== undefined && s.url.startsWith("https://")) {
            sources[key] = { name: s.name, url: s.url };
        }
    }

    const coins: Record<string, CashtagCoin> = {};
    for (const [symbol, entry] of Object.entries(entries(json, "coins"))) {
        const coin = parse(entry, Coin, `coin ${symbol}`);
        const creditable = coin?.source === undefined || sources[coin.source] !== undefined;
        if (coin !== undefined && isPrice(coin.usd) && creditable) {
            coins[symbol.toLowerCase()] = {
                id: coin.id,
                symbol,
                name: coin.name,
                usd: coin.usd,
                source: coin.source,
            };
        }
    }

    return { exchangeRates, coins, sources };
}

// Oldest first. Undefined if the response can't be parsed
export function priceHistoryResponse(json: unknown): PriceHistory | undefined {
    const value = parse(json, PriceHistoryResponse, "a price history");
    if (value === undefined) return undefined;
    return {
        points: value.points
            .filter(([, usd]) => isPrice(usd))
            .map(([timestamp, usd]) => ({ timestamp, usd }))
            .sort((a, b) => a.timestamp - b.timestamp),
        source: value.source,
    };
}

// the entries of an object in the response, to parse each on its own so a bad one doesn't spoil the
// rest; none if it isn't an object
function entries(json: unknown, name: string): Record<string, unknown> {
    const value = isObject(json) ? json[name] : undefined;
    return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parse<T extends TSchema>(json: unknown, schema: T, what: string): Static<T> | undefined {
    try {
        return typeboxValidate(json, schema);
    } catch (err) {
        console.error(`Error parsing the price service's ${what}`, formatError(err));
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
