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
            exchangeRates[from] = { ...exchangeRates[from], toUSD: rate };
        } else if (to === "icp") {
            exchangeRates[from] = { ...exchangeRates[from], toICP: rate };
        }
    }

    exchangeRates["icp"] = { ...exchangeRates["icp"], toICP: 1 };

    const icpToUsd = exchangeRates["icp"]["toUSD"];
    if (icpToUsd !== undefined) {
        exchangeRates["ckusdc"] = { toICP: 1 / icpToUsd, toUSD: 1 };
    }

    return exchangeRates;
}

function parseSymbolPair(pair: string): [string, string] {
    const parts = pair.split("/");
    return [parts[0].toLowerCase(), parts[1].toLowerCase()];
}
