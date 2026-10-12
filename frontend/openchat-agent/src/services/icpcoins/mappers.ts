import { Type, type Static } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type { CryptocurrencyDetails, TokenExchangeRates } from "@shared";
import { typeboxValidate } from "../../utils/typebox";
import type { CoinWithDetails, GetCoinsByMarketcapResp } from "./candid/types";

// Keyed by ledger. Matched by ledger too, not symbol: several of our tokens share a symbol, and
// ICPCoins' symbols aren't always ours (our CONF is its SWAMP, for one)
export function coinsByMarketcapResponse(
    { coins }: GetCoinsByMarketcapResp,
    supportedTokens: CryptocurrencyDetails[],
): Record<string, TokenExchangeRates> {
    const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));
    const exchangeRates: Record<string, TokenExchangeRates> = {};

    for (const coin of coins) {
        if (supportedLedgers.has(coin.ledger_id)) {
            const rate = tryGetRate(coin);
            if (rate !== undefined) {
                exchangeRates[coin.ledger_id] = { toUSD: rate };
            }
        }
    }
    return exchangeRates;
}

type OverviewJson = Static<typeof OverviewJson>;
export const OverviewJson = Type.Object({
    price_usd: Type.Optional(Type.Union([Type.Number(), Type.Null()]))
});

function tryGetRate(coin: CoinWithDetails): number | undefined {
    try {
        const value = typeboxValidate(JSON.parse(coin.overview_json), OverviewJson);
        return value.price_usd ?? undefined;
    } catch (err) {
        console.debug("Error parsing overview_json for token", coin.symbol, formatError(err));
    }
    return undefined;
}

function formatError(err: unknown) {
    if (err instanceof AssertError) {
        return `${err.message}: ${err.error?.path}`;
    }
    return err;
}
