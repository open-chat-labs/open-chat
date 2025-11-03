import { Type, type Static } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import type { TokenExchangeRates } from "openchat-shared";
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
    supportedSymbols: Set<string>,
    json: unknown,
): Record<string, TokenExchangeRates> {
    const exchangeRates: Record<string, TokenExchangeRates> = {};
    try {
        const value = typeboxValidate(json, ICSwapResponse);

        for (const token of value.data) {
            const symbol = token.tokenSymbol?.trim().toLowerCase();
            if (symbol && supportedSymbols.has(symbol)) {
                exchangeRates[symbol] = {
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
        supportedSymbols: Set<string>,
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
            .then((res) => getAllTokensResponse(supportedSymbols, res as ResponseType));
    }
}
