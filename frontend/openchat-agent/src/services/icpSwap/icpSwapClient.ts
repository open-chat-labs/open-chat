import type { CryptocurrencyDetails, TokenExchangeRates } from "@shared";
import type { ExchangeRateClient } from "../openchatAgent";
import { getAllTokensResponse } from "./mappers";

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
