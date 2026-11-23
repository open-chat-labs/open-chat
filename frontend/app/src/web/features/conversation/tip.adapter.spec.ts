import type { EnhancedTokenDetails } from "@client";
import { describe, expect, test } from "vitest";
import { tipTokenOptions } from "./tip.adapter";

function token(ledger: string, symbol: string, balance: bigint, enabled = true) {
    return {
        ledger,
        symbol,
        name: `${symbol} token`,
        decimals: 8,
        balance,
        enabled,
    } as EnhancedTokenDetails;
}

describe("the tip dialog's tokens", () => {
    test("are the enabled ones, by ledger, with what's held and the chosen one marked", () => {
        const options = tipTokenOptions(
            [
                token("icp-ledger", "ICP", 150_000_000n),
                token("chat-ledger", "CHAT", 0n),
                token("off-ledger", "OFF", 1n, false),
            ],
            "chat-ledger",
        );
        expect(options.map((o) => [o.id, o.symbol, o.held, o.current])).toEqual([
            ["icp-ledger", "ICP", "1.50", false],
            ["chat-ledger", "CHAT", undefined, true],
        ]);
    });

    test("tell apart two tokens that share a symbol", () => {
        const options = tipTokenOptions([token("a", "USD", 0n), token("b", "USD", 0n)], "b");
        expect(options.map((o) => o.id)).toEqual(["a", "b"]);
    });
});
