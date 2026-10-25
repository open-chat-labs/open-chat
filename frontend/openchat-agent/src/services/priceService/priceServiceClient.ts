import type { CryptocurrencyDetails, TokenExchangeRates, TokenPricePoint } from "@shared";
import type { ExchangeRateClient } from "../openchatAgent";
import { priceHistoryResponse, pricesResponse } from "./mappers";

// OpenChat's pricing service (OC_PRICE_SERVICE_URL), which every token price comes from. The
// browser caches its responses for as long as it says to, so a card opened again soon after costs
// no request.
export class PriceServiceClient implements ExchangeRateClient {
    #baseUrl: string;

    constructor(baseUrl: string) {
        this.#baseUrl = baseUrl.replace(/\/+$/, "");
    }

    async exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates> | undefined> {
        const json = await this.#get("/v1/prices");
        return json !== undefined ? pricesResponse(json, supportedTokens) : undefined;
    }

    async priceHistory(ledger: string): Promise<TokenPricePoint[] | undefined> {
        const json = await this.#get(`/v1/prices/${encodeURIComponent(ledger)}/history?range=7d`);
        return json !== undefined ? priceHistoryResponse(json) : undefined;
    }

    async #get(path: string): Promise<unknown> {
        const res = await fetch(`${this.#baseUrl}${path}`);
        if (!res.ok) {
            console.log("Request to the price service failed", path, res.status);
            return undefined;
        }
        return res.json();
    }
}
