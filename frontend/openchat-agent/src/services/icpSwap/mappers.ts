import { Type, type Static } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type { CryptocurrencyDetails, TokenExchangeRates } from "@shared";
import { typeboxValidate } from "../../utils/typebox";

type TokenDetails = Static<typeof TokenDetails>;
export const TokenDetails = Type.Object({
    tokenLedgerId: Type.String(),
    price: Type.Number(),
});

type ICSwapResponse = Static<typeof ICSwapResponse>;
export const ICSwapResponse = Type.Object({
    code: Type.Number(),
    message: Type.Optional(Type.String()),
    data: Type.Array(TokenDetails),
});

// Keyed by ledger, since several of our tokens share a symbol
export function getAllTokensResponse(
    supportedTokens: CryptocurrencyDetails[],
    json: unknown,
): Record<string, TokenExchangeRates> {
    const exchangeRates: Record<string, TokenExchangeRates> = {};
    try {
        const value = typeboxValidate(json, ICSwapResponse);
        const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));

        for (const token of value.data) {
            if (supportedLedgers.has(token.tokenLedgerId)) {
                exchangeRates[token.tokenLedgerId] = {
                    toUSD: Number(token.price),
                };
            }
        }
    } catch (err) {
        console.error("Error parsing response from ICSwap/token/all", formatError(err));
    }
    return exchangeRates;
}

function formatError(err: unknown) {
    if (err instanceof AssertError) {
        return `${err.message}: ${err.error?.path}`;
    }
    return err;
}
