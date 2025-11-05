import { Type, type Static } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type { CryptocurrencyDetails, TokenExchangeRates } from "openchat-shared";
import { typeboxValidate } from "../../utils/typebox";
import type { CoinWithDetails, GetCoinsByMarketcapResp } from "./candid/types";

export function coinsByMarketcapResponse(
    { coins }: GetCoinsByMarketcapResp,
    supportedTokens: CryptocurrencyDetails[],
): Record<string, TokenExchangeRates> {
    const supportedSymbols = new Set<string>(supportedTokens.map((t) => t.symbol.toLowerCase()));
    supportedSymbols.add("btc");
    supportedSymbols.add("eth");

    const symbolOverrides = new Map<string, string>([["ckbtc", "btc"]]);
    const exchangeRates: Record<string, TokenExchangeRates> = {};

    for (const coin of coins) {
        const originalSymbol = coin.symbol.toLowerCase();
        const symbol = symbolOverrides.get(originalSymbol) ?? originalSymbol;

        if (supportedSymbols.has(symbol)) {
            const rate = tryGetRate(coin);
            if (rate !== undefined) {
                exchangeRates[symbol] = { toUSD: rate };
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
