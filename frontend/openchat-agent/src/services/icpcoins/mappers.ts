import type { TokenExchangeRates } from "openchat-shared";
import type { LatestTokenRow } from "./candid/types";

export function getLatestResponse(
    candid: Array<LatestTokenRow>,
): Record<string, TokenExchangeRates> {
    const exchangeRates: Record<string, TokenExchangeRates> = {};

    for (const row of candid) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_pair, pairText, rate] = row;
        const [from, to] = parseSymbolPair(pairText);

        if (to === "usd") {
            exchangeRates[from] = { toUSD: rate };
        }
    }

    return exchangeRates;
}

function parseSymbolPair(pair: string): [string, string] {
    const parts = pair.split("/");
    return [parts[0].toLowerCase(), parts[1].toLowerCase()];
}
