import { isPrincipalValid, type TokenExchangeRates } from "openchat-shared";
import type { PublicTokenOverview } from "./candid/types";

export function getAllTokensResponse(
    candid: Array<PublicTokenOverview>,
): Record<string, TokenExchangeRates> {
    const exchangeRates: Record<string, TokenExchangeRates> = {};

    for (const token of candid) {
        const symbol = token.symbol.trim().toLowerCase();
        if (symbol !== "btc" && token.volumeUSD7d > 0 && isPrincipalValid(token.address)) {
            exchangeRates[symbol] = {
                toUSD: token.priceUSD,
            };
        }
    }

    return exchangeRates;
}
