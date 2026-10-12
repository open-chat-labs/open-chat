import type { CryptocurrencyDetails } from "@shared";
import { vi } from "vitest";
import { getAllTokensResponse } from "./mappers";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
// Both TENDY in the registry
const TENDY_LEDGER = "kylwo-viaaa-aaaaq-aae7a-cai";
const OTHER_TENDY_LEDGER = "iozql-7iaaa-aaaah-advvq-cai";

function token(symbol: string, ledger: string): CryptocurrencyDetails {
    return { symbol, ledger } as CryptocurrencyDetails;
}

// ICPSwap sends its prices as strings
function response(...tokens: [string, string, string][]) {
    return {
        code: 200,
        message: null,
        data: tokens.map(([tokenSymbol, tokenLedgerId, price]) => ({
            tokenSymbol,
            tokenLedgerId,
            tokenName: tokenSymbol,
            price,
        })),
    };
}

const supportedTokens = [
    token("ICP", ICP_LEDGER),
    token("TENDY", TENDY_LEDGER),
    token("TENDY", OTHER_TENDY_LEDGER),
];

describe("ICPSwap exchange rates", () => {
    test("are keyed by ledger, so tokens which share a symbol keep their own rates", () => {
        const rates = getAllTokensResponse(
            supportedTokens,
            response(
                ["TENDY", OTHER_TENDY_LEDGER, "0.295900000000000000"],
                ["TENDY", TENDY_LEDGER, "0.081200000000000000"],
            ),
        );

        expect(rates).toEqual({
            [TENDY_LEDGER]: { toUSD: 0.0812 },
            [OTHER_TENDY_LEDGER]: { toUSD: 0.2959 },
        });
    });

    test("ignore the tokens of ledgers we don't support, whatever their symbol", () => {
        const rates = getAllTokensResponse(
            supportedTokens,
            response(
                ["ICP", "74a53-yyaaa-aaaar-qadeq-cai", "0.000018074090074466"],
                ["ICP", ICP_LEDGER, "3.485600000000000000"],
                ["ICP", "ete3q-rqaaa-aaaal-qdlva-cai", "0"],
            ),
        );

        expect(rates).toEqual({ [ICP_LEDGER]: { toUSD: 3.4856 } });
    });

    test("are empty when the response can't be parsed", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const rates = getAllTokensResponse(supportedTokens, {});
        spy.mockRestore();

        expect(rates).toEqual({});
    });
});
