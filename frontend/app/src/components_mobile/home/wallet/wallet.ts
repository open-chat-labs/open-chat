import { type EnhancedTokenDetails } from "openchat-client";

export type ConversionToken = "usd" | "icp" | "btc" | "eth";

export function getConvertedTokenValue(
    c: ConversionToken,
    t: EnhancedTokenDetails,
): number | undefined {
    switch (c) {
        case "usd":
            return t.dollarBalance;
        case "icp":
            return t.icpBalance;
        case "btc":
            return t.btcBalance;
        case "eth":
            return t.ethBalance;
    }
}

export function formatTokenValue(c: ConversionToken, val?: number): string {
    switch (c) {
        case "usd":
            return val?.toFixed(2) ?? "???";
        case "icp":
            return val?.toFixed(3) ?? "???";
        case "btc":
            return val?.toFixed(6) ?? "???";
        case "eth":
            return val?.toFixed(6) ?? "???";
    }
}

export function convertAndFormat(c: ConversionToken, t: EnhancedTokenDetails): string {
    return formatTokenValue(c, getConvertedTokenValue(c, t));
}
