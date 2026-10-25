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

// Keyed by ledger, since several of our tokens share a symbol. Undefined if the response can't be
// parsed. ICPSwap gives a price of 0 for a token it has no price for, which is left out, so its
// price is unknown rather than $0
export function getAllTokensResponse(
    supportedTokens: CryptocurrencyDetails[],
    json: unknown,
): Record<string, TokenExchangeRates> | undefined {
    try {
        const value = typeboxValidate(json, ICSwapResponse);
        const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));
        const exchangeRates: Record<string, TokenExchangeRates> = {};

        for (const token of value.data) {
            const price = Number(token.price);
            if (supportedLedgers.has(token.tokenLedgerId) && Number.isFinite(price) && price > 0) {
                exchangeRates[token.tokenLedgerId] = { toUSD: price };
            }
        }
        return exchangeRates;
    } catch (err) {
        console.error("Error parsing response from ICSwap/token/all", formatError(err));
        return undefined;
    }
}

function formatError(err: unknown) {
    if (err instanceof AssertError) {
        return `${err.message}: ${err.error?.path}`;
    }
    return err;
}
