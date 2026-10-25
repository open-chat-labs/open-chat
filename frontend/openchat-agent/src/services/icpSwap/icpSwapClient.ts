import type { CryptocurrencyDetails, TokenExchangeRates, TokenPricePoint } from "@shared";
import type { ExchangeRateClient } from "../openchatAgent";
import { getAllTokensResponse } from "./mappers";

export class IcpSwapClient implements ExchangeRateClient {
    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates> | undefined> {
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
                    return undefined;
                }
            })
            .then((res) =>
                res !== undefined
                    ? getAllTokensResponse(supportedTokens, res as ResponseType)
                    : undefined,
            );
    }

    // ICPSwap is only used where there's no price service, and the price charts come from that
    priceHistory(_ledger: string): Promise<TokenPricePoint[] | undefined> {
        return Promise.resolve(undefined);
    }
}
