import {
    ErrorCode,
    i18nKey,
    type CryptocurrencyDetails,
    type DexId,
    type DexQuote,
    type SwapOutcome,
    type SwapQuoteOutcome,
    type SwapTokensResponse,
} from "@shared";
import { calculateDollarAmount, formatTokens } from "./cryptoFormatter";

export function dexName(dex: DexId): string {
    switch (dex) {
        case "icpswap":
            return "ICPSwap";
        case "taco":
            return "TACO";
    }
    return dex;
}

// The best of the quotes the DEXes gave for swapping `amountIn` of `tokenIn`, which can only be swapped
// if it gives more than 10 transfer fees of `tokenOut`
export function swapQuoteResult(
    tokenIn: CryptocurrencyDetails,
    tokenOut: CryptocurrencyDetails,
    amountIn: bigint,
    quotes: [DexId, DexQuote][],
    toUSD: (ledger: string) => number | undefined,
): SwapQuoteOutcome {
    const best = bestQuote(quotes);
    if (best === undefined) {
        // With no quote in hand, a DEX failing to answer may be what stopped the user getting one
        const failed = quotes.some(([, q]) => q.kind === "failed");
        return {
            kind: "failed",
            message: i18nKey(failed ? "tokenSwap.quoteError" : "tokenSwap.noQuotes", {
                tokenIn: tokenIn.symbol,
            }),
        };
    }

    const [dex, amountOut] = best;
    const amountInText = formatTokens(amountIn, tokenIn.decimals);
    const amountOutText = formatTokens(amountOut, tokenOut.decimals);
    const minAmountOut = 10n * tokenOut.transferFee;
    const usdIn = calculateDollarAmount(amountIn, toUSD(tokenIn.ledger), tokenIn.decimals);
    const usdOut = calculateDollarAmount(amountOut, toUSD(tokenOut.ledger), tokenOut.decimals);
    const values = {
        amountIn: amountInText,
        tokenIn: tokenIn.symbol,
        rate: (Number(amountOutText) / Number(amountInText)).toPrecision(3),
        amountOut: amountOutText,
        tokenOut: tokenOut.symbol,
        dex: dexName(dex),
        minAmountOut: formatTokens(minAmountOut, tokenOut.decimals),
        usdIn,
        usdOut,
    };

    if (amountOut <= minAmountOut) {
        return { kind: "failed", message: i18nKey("tokenSwap.quoteTooLow", values) };
    }

    const valueUnknown = usdIn === "???" || usdOut === "???";
    return {
        kind: "quoted",
        quote: {
            ledgerIn: tokenIn.ledger,
            ledgerOut: tokenOut.ledger,
            dex,
            amountIn,
            amountOut,
            valueWarning: valueUnknown
                ? "unknown"
                : Number(usdOut) < 0.9 * Number(usdIn)
                  ? "dropped"
                  : undefined,
            values,
        },
    };
}

// The DEX which quoted the most, along with what it quoted
function bestQuote(quotes: [DexId, DexQuote][]): [DexId, bigint] | undefined {
    let best: [DexId, bigint] | undefined;
    for (const [dex, quote] of quotes) {
        if (quote.kind === "quoted" && (best === undefined || quote.amountOut > best[1])) {
            best = [dex, quote.amountOut];
        }
    }
    return best;
}

export const swapError = i18nKey("tokenSwap.progress.error");

// The swap may or may not have gone ahead, so the user is told to check their balance
export const swapUnconfirmed = i18nKey("tokenSwap.progress.unknown");

export const swapInsufficientFunds = i18nKey("tokenSwap.progress.insufficientFunds");

export function swapResult(resp: SwapTokensResponse): SwapOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "swapped", amountOut: resp.amountOut };
        case "error":
            switch (resp.code) {
                case ErrorCode.InsufficientFunds:
                    return { kind: "insufficient_funds", message: swapInsufficientFunds };
                // The DEX refused the swap since the rate had moved too far since the quote
                case ErrorCode.SwapFailed:
                    return { kind: "rate_changed", message: i18nKey("tokenSwap.progress.failed") };
                // The call to the DEX failed, so the swap may or may not have gone ahead
                case ErrorCode.Unknown:
                    return { kind: "failed", message: swapUnconfirmed };
            }
            return { kind: "failed", message: swapError };
        case "swap_failed":
        case "internal_error":
        case "pin_required":
        case "pin_incorrect":
        case "too_main_failed_pin_attempts":
            return { kind: "failed", message: swapError };
        default:
            return resp satisfies never;
    }
}
