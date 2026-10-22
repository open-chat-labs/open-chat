import type { WalletConfig } from "@shared";
import { describe, expect, test } from "vitest";
import { cloneWalletConfig, walletConfigForMode, walletConfigWithoutToken } from "./walletConfig";

// Both wallet settings forms toggle tokens by mutating the form config's `tokens` Set in place,
// then compare the form config with the stored one on close to decide whether to save.
function toggleToken(config: WalletConfig, ledger: string) {
    if (config.kind !== "manual_wallet") throw new Error("expected manual_wallet");
    if (config.tokens.has(ledger)) {
        config.tokens.delete(ledger);
    } else {
        config.tokens.add(ledger);
    }
}

describe("wallet settings form config", () => {
    test("editing the form config never changes the stored config, so the edit is seen and saved", () => {
        const stored: WalletConfig = { kind: "manual_wallet", tokens: new Set(["a", "b"]) };

        // Opening the form, and re-selecting the mode the stored config already has.
        for (const form of [
            cloneWalletConfig(stored),
            walletConfigForMode("manual_wallet", stored, new Set()),
        ]) {
            toggleToken(form, "c");
            expect(stored).toEqual({ kind: "manual_wallet", tokens: new Set(["a", "b"]) });
            expect(form).toEqual({ kind: "manual_wallet", tokens: new Set(["a", "b", "c"]) });
        }
    });
});

describe("removing a token from the wallet", () => {
    test("leaves the stored config unchanged, so undoing a failed save restores it", () => {
        const stored: WalletConfig = { kind: "manual_wallet", tokens: new Set(["a", "b"]) };
        const next = walletConfigWithoutToken(stored, "a");
        expect(next).toEqual({ kind: "manual_wallet", tokens: new Set(["b"]) });
        expect(stored).toEqual({ kind: "manual_wallet", tokens: new Set(["a", "b"]) });
        expect(walletConfigWithoutToken(stored, "x")).toBeUndefined();
        expect(
            walletConfigWithoutToken({ kind: "auto_wallet", minDollarValue: 0 }, "a"),
        ).toBeUndefined();
    });
});
