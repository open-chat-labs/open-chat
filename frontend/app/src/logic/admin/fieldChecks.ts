import { formatTokens, isPrincipalValid } from "@client";

// What the console's fields say under themselves as they're typed in (the new web UI's
// console): why a value can't be used, and what an e8s amount comes to. The words are English
// only, as the console's are. The actions check again before they call anything.

/** Why a principal (or a comma separated list of them) can't be used; blank is fine. */
export function principalProblem(text: string, list = false): string | undefined {
    const ids = list
        ? text
              .split(",")
              .map((id) => id.trim())
              .filter((id) => id !== "")
        : [text.trim()].filter((id) => id !== "");
    const invalid = ids.find((id) => !isPrincipalValid(id));
    if (invalid === undefined) return undefined;
    return list
        ? `"${invalid}" is not a valid principal`
        : "Not a valid principal, which looks like rdmx6-jaaaa-aaaaa-aaadq-cai";
}

/** Why a whole number can't be used; blank is fine. */
export function wholeNumberProblem(text: string): string | undefined {
    const trimmed = text.trim();
    return trimmed === "" || /^\d+$/.test(trimmed) ? undefined : "A whole number";
}

/** Why a referral threshold can't be used: blank turns its category off. */
export function thresholdProblem(text: string): string | undefined {
    const trimmed = text.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return isNaN(n) || n < 0 || n > 1 ? "From 0 to 1" : undefined;
}

/** What an e8s amount comes to in its token ("15.00 CHAT"); none while it isn't a whole number. */
export function e8sAmount(text: string, symbol: string): string | undefined {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    return `${formatTokens(BigInt(trimmed), 8)} ${symbol}`;
}
