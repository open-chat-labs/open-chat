import type { CryptocurrencyDetails, PriceHistory, PriceSubject, TokenPrices } from "@shared";
import type { ExchangeRateClient } from "../openchatAgent";
import { getAllTokensResponse } from "./mappers";

export class IcpSwapClient implements ExchangeRateClient {
    // only the exchange rates of the tokens OpenChat lists: no coins, and nothing to credit
    exchangeRates(supportedTokens: CryptocurrencyDetails[]): Promise<TokenPrices | undefined> {
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
            .then((res) => {
                const exchangeRates =
                    res !== undefined
                        ? getAllTokensResponse(supportedTokens, res as ResponseType)
                        : undefined;
                return exchangeRates !== undefined
                    ? { exchangeRates, coins: {}, sources: {} }
                    : undefined;
            });
    }

    // ICPSwap is only used where there's no price service, and the price charts come from that
    priceHistory(_subject: PriceSubject): Promise<PriceHistory | undefined> {
        return Promise.resolve(undefined);
    }
}
