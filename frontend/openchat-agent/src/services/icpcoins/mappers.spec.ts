import type { CryptocurrencyDetails } from "@shared";
import { vi } from "vitest";
import type { CoinWithDetails } from "./candid/types";
import { coinsByMarketcapResponse } from "./mappers";

const CKBTC_LEDGER = "mxzaz-hqaaa-aaaar-qaada-cai";
// CONF in the registry, SWAMP on ICPCoins
const CONF_LEDGER = "lrtnw-paaaa-aaaaq-aadfa-cai";
// Both TENDY in the registry, only the second of which is on ICPCoins
const TENDY_LEDGER = "kylwo-viaaa-aaaaq-aae7a-cai";
const OTHER_TENDY_LEDGER = "iozql-7iaaa-aaaah-advvq-cai";

function token(symbol: string, ledger: string): CryptocurrencyDetails {
    return { symbol, ledger } as CryptocurrencyDetails;
}

function coin(symbol: string, ledger_id: string, overview_json: string): CoinWithDetails {
    return {
        id: 0,
        decimals: 8,
        deleted: false,
        name: symbol,
        rank: 0,
        tags: [],
        ledger_id,
        details_json: "{}",
        details: [],
        overview_json,
        symbol,
        unlisted: false,
    };
}

function pricedCoin(symbol: string, ledger_id: string, price_usd: number | null): CoinWithDetails {
    return coin(symbol, ledger_id, JSON.stringify({ price_usd }));
}

const supportedTokens = [
    token("ckBTC", CKBTC_LEDGER),
    token("CONF", CONF_LEDGER),
    token("TENDY", TENDY_LEDGER),
    token("TENDY", OTHER_TENDY_LEDGER),
];

describe("ICPCoins exchange rates", () => {
    test("are keyed by ledger", () => {
        const rates = coinsByMarketcapResponse(
            { coins: [pricedCoin("ckBTC", CKBTC_LEDGER, 81157.5)], last: [] },
            supportedTokens,
        );

        expect(rates).toEqual({ [CKBTC_LEDGER]: { toUSD: 81157.5 } });
    });

    test("match a coin to a token by ledger when ICPCoins has another symbol for it", () => {
        const rates = coinsByMarketcapResponse(
            { coins: [pricedCoin("SWAMP", CONF_LEDGER, 0.002)], last: [] },
            supportedTokens,
        );

        expect(rates).toEqual({ [CONF_LEDGER]: { toUSD: 0.002 } });
    });

    test("don't give a coin's rate to another token with its symbol", () => {
        const rates = coinsByMarketcapResponse(
            { coins: [pricedCoin("TENDY", OTHER_TENDY_LEDGER, 0.27)], last: [] },
            supportedTokens,
        );

        expect(rates).toEqual({ [OTHER_TENDY_LEDGER]: { toUSD: 0.27 } });
    });

    test("ignore coins whose ledgers we don't support, whatever their symbol", () => {
        const rates = coinsByMarketcapResponse(
            { coins: [pricedCoin("TENDY", "ryjl3-tyaaa-aaaaa-aaaba-cai", 0.27)], last: [] },
            supportedTokens,
        );

        expect(rates).toEqual({});
    });

    test("skip coins without a price", () => {
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        const rates = coinsByMarketcapResponse(
            {
                coins: [
                    pricedCoin("SWAMP", CONF_LEDGER, null),
                    coin("ckBTC", CKBTC_LEDGER, "not json"),
                ],
                last: [],
            },
            supportedTokens,
        );
        spy.mockRestore();

        expect(rates).toEqual({});
    });
});
