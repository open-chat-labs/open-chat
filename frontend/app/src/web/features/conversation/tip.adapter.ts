// The tip dialog's tokens (5b) as TokenPicker lists them (the amount card's pill is `tokenRef`'s).
import { formatTokens, type EnhancedTokenDetails } from "@client";
import type { TokenOption } from "@openchat/ui/src/lib/types";
import { tokenRef } from "../builders/builders.adapter";

/**
 * The tokens a tip can be paid in, as the old tip dialogs' token selector listed them: every
 * enabled token in the wallet's order, each by its ledger (two can share a symbol), with what the
 * wallet holds of it (one it holds none of is listed after, as TokenPicker groups them), and the
 * chosen one marked.
 */
export function tipTokenOptions(tokens: EnhancedTokenDetails[], chosen: string): TokenOption[] {
    return tokens
        .filter((t) => t.enabled)
        .map((t) => ({
            ...tokenRef(t),
            id: t.ledger,
            name: t.name,
            held: t.balance > 0n ? formatTokens(t.balance, t.decimals) : undefined,
            current: t.ledger === chosen,
        }));
}
