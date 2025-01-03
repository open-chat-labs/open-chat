import { type CryptocurrencyDetails, type TokenExchangeRates } from "openchat-shared";
import type { PublicTokenOverview } from "./candid/types";

export function getAllTokensResponse(
    candid: Array<PublicTokenOverview>,
    supportedTokens: CryptocurrencyDetails[],
): Record<string, TokenExchangeRates> {
    const exchangeRates: Record<string, TokenExchangeRates> = {};
    const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));

    for (const token of candid) {
        if (supportedLedgers.has(token.address)) {
            exchangeRates[token.symbol.trim().toLowerCase()] = {
                toUSD: token.priceUSD,
            };
        }
    }

    return exchangeRates;
}
