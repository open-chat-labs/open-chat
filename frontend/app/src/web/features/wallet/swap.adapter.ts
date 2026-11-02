// The client's swaps in WalletSwap's shapes: each DEX's answer, the quote, the steps and how a swap
// went.
import {
    dexName,
    type DexId,
    type DexQuote,
    type ResourceKey,
    type SwapFromWalletStep,
    type SwapOutcome,
    type SwapQuote,
} from "@client";
import type {
    DexQuoteRow,
    SwapQuote as SwapQuoteView,
} from "@openchat/ui/src/features/components/WalletSwap.svelte";
import { wholeTokens } from "./wallet.adapter";

/** Each DEX's answer, by its name: its output in whole tokens, or why it has none. */
export function dexQuoteRows(quotes: [DexId, DexQuote][], decimalsOut: number): DexQuoteRow[] {
    return quotes.map(([dex, q]): DexQuoteRow => {
        const name = dexName(dex);
        switch (q.kind) {
            case "quoting":
                return { dex: name, state: "quoting" };
            case "quoted":
                return { dex: name, state: "quoted", out: wholeTokens(q.amountOut, decimalsOut) };
            case "failed":
                return { dex: name, state: "failed" };
            default:
                return { dex: name, state: "none" };
        }
    });
}

/**
 * The best quote as Swap shows it, with every DEX's answer, and the value warning to confirm in the
 * app's words (`translate` fills in the quote's values). The fees and price impact aren't known, so
 * those rows don't show, and there's no expiry: the minimum output protects a quote that's gone
 * stale.
 */
export function swapQuoteView(
    quote: SwapQuote,
    quotes: [DexId, DexQuote][],
    decimalsOut: number,
    translate: (key: string, values: Record<string, string>) => string,
): SwapQuoteView {
    const values = Object.fromEntries(Object.entries(quote.values).map(([k, v]) => [k, String(v)]));
    return {
        dex: dexName(quote.dex),
        out: wholeTokens(quote.amountOut, decimalsOut),
        quotes: dexQuoteRows(quotes, decimalsOut),
        warning:
            quote.valueWarning === undefined
                ? undefined
                : translate(
                      quote.valueWarning === "dropped"
                          ? "tokenSwap.warningValueDropped"
                          : "tokenSwap.warningValueUnknown",
                      values,
                  ),
    };
}

/** Swap's on-chain step for one the client reports: 0 approve, 1 swap, 2 withdraw. */
export function swapStepIndex(step: SwapFromWalletStep): number {
    switch (step.step) {
        case "approve":
            return 0;
        case "swap":
            return 1;
        case "withdraw":
            return 2;
    }
}

/**
 * What Swap hears of a swap: swapped, with the output in whole tokens; nothing sent and nothing to
 * say (the PIN prompt was dismissed), back to the quote; or failed, with why.
 */
export type SwapAnswer =
    | { kind: "swapped"; out: number }
    | { kind: "not_sent" }
    | { kind: "failed"; message: ResourceKey | undefined };

export function swapAnswer(outcome: SwapOutcome | undefined, decimalsOut: number): SwapAnswer {
    if (outcome === undefined) return { kind: "failed", message: undefined };
    switch (outcome.kind) {
        case "swapped":
            return { kind: "swapped", out: wholeTokens(outcome.amountOut, decimalsOut) };
        case "cancelled":
            return { kind: "not_sent" };
        default:
            return { kind: "failed", message: outcome.message };
    }
}
