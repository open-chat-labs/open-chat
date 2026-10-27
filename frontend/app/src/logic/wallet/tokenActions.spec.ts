import { describe, expect, test } from "vitest";
import {
    hasTransactionHistory,
    tokenActions,
    tokenActionsContext,
    type TokenActionsContext,
} from "./tokenActions";

const context = (over: Partial<TokenActionsContext> = {}): TokenActionsContext => ({
    swappable: new Set(["swappable-ledger"]),
    manualWallet: false,
    disabled: { send: false, receive: false, swap: false },
    ...over,
});

describe("a token's actions", () => {
    test("invariant 4: Remove only in a manual wallet, Swap only for an enabled swappable token, Receive only for an enabled token", () => {
        expect(tokenActions({ ledger: "swappable-ledger", enabled: true }, context())).toEqual([
            "send",
            "receive",
            "swap",
            "refresh",
        ]);
        // not swappable
        expect(tokenActions({ ledger: "other", enabled: true }, context())).toEqual([
            "send",
            "receive",
            "refresh",
        ]);
        // disabled: only sent away, even when it's swappable
        expect(tokenActions({ ledger: "swappable-ledger", enabled: false }, context())).toEqual([
            "send",
            "refresh",
        ]);
        expect(
            tokenActions({ ledger: "other", enabled: true }, context({ manualWallet: true })),
        ).toContain("remove");
    });

    test("an action the build turns off is never offered", () => {
        const offered = tokenActions(
            { ledger: "swappable-ledger", enabled: true },
            context({ disabled: { send: true, receive: true, swap: true } }),
        );
        expect(offered).toEqual(["refresh"]);
    });

    test("only a token with an index canister has a history", () => {
        expect(hasTransactionHistory({ index: "index-canister" })).toBe(true);
        expect(hasTransactionHistory({ index: undefined })).toBe(false);
    });
});

describe("the token actions' context", () => {
    test("a manual wallet config is a manual wallet; the build's flags come with it", () => {
        const swappable = new Set(["x"]);
        const manual = tokenActionsContext(swappable, { kind: "manual_wallet", tokens: new Set() });
        expect(manual.manualWallet).toBe(true);
        expect(manual.swappable).toBe(swappable);
        expect(manual.disabled).toEqual({ send: false, receive: false, swap: false });
        expect(
            tokenActionsContext(swappable, { kind: "auto_wallet", minDollarValue: 0 }).manualWallet,
        ).toBe(false);
    });
});
