import { Type, type Static } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type { CryptocurrencyDetails, TokenExchangeRates } from "openchat-shared";
import { typeboxValidate } from "../../utils/typebox";
import type { ExchangeRateClient } from "../openchatAgent";

type TokenDetails = Static<typeof TokenDetails>;
export const TokenDetails = Type.Object({
    tokenSymbol: Type.Optional(Type.String()),
    tokenLedgerId: Type.String(),
    price: Type.Number(),
});

type ICSwapResponse = Static<typeof ICSwapResponse>;
export const ICSwapResponse = Type.Object({
    code: Type.Number(),
    message: Type.Optional(Type.String()),
    data: Type.Array(TokenDetails),
});

function getAllTokensResponse(
    supportedTokens: CryptocurrencyDetails[],
    json: unknown,
): Record<string, TokenExchangeRates> {
    const exchangeRates: Record<string, TokenExchangeRates> = {};
    try {
        const value = typeboxValidate(json, ICSwapResponse);
        const supportedLedgers = new Set<string>(supportedTokens.map((t) => t.ledger));

        for (const token of value.data) {
            if (supportedLedgers.has(token.tokenLedgerId) && token.tokenSymbol) {
                exchangeRates[token.tokenSymbol.trim().toLowerCase()] = {
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

export class IcpSwapClient implements ExchangeRateClient {
    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>> {
        return fetch("https://api.icpswap.com/info/token/all")
            .then((res) => {
                if (res.ok) {
                    return res.json();
                } else {
                    console.log(
                        "Failed to load token information from ICSwap",
                        res.status,
                        res.statusText,
                    );
                    return {};
                }
            })
            .then((res) => getAllTokensResponse(supportedTokens, res as ResponseType));
    }
}
