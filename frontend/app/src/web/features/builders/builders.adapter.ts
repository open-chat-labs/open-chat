// The composer's "+" builders (5d) in the library's shapes, and back: what a builder dialog hands
// over, as the client's builders take it, and what the composer stages, as the library shows it.
import {
    formatTokens,
    walletApprovalFee,
    type CryptocurrencyContent,
    type CryptocurrencyDetails,
    type EnhancedTokenDetails,
    type NewPoll,
    type TokenExchangeRates,
    type UserSummary,
} from "@client";
import type { PollDraft } from "@openchat/ui/src/features/components/PollBuilderDialog.svelte";
import type {
    CryptoMember,
    CryptoToken,
} from "@openchat/ui/src/features/components/SendCryptoDialog.svelte";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import type { TokenRef, Transfer } from "@openchat/ui/src/lib/types";
import { formatConvertedValue } from "@src/logic/wallet/walletState.svelte";
import { swatchFor } from "../chats/chatList.adapter";
import { displayDecimals, wholeTokens } from "../wallet/wallet.adapter";

/** A library resource key (or the app's) with its values, in the app's language. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * A poll as `PollBuilderDialog` publishes it, as `newPollContent` takes it: public votes are a poll
 * that isn't anonymous, hidden results one that doesn't show its votes before it ends, and "lock
 * votes" a poll that doesn't let its voters change them (a multiple-choice poll always does).
 */
export function newPoll(draft: PollDraft): NewPoll {
    return {
        question: draft.question,
        answers: draft.options.map((o) => o.label),
        anonymous: !draft.publicVotes,
        showVotesBeforeEndDate: !draft.hideResults,
        allowMultipleVotesPerUser: draft.multiple,
        allowUserToChangeVote: draft.canChange,
        durationMs: draft.durationMs,
    };
}

/** A token as a builder lists it, and the ledger it stands for (the library knows it by symbol). */
export type BuilderToken = { ledger: string; token: CryptoToken };

/** A token's face: its symbol's first letter on the swatch its ledger picks (as the wallet's). */
export function tokenRef(token: Pick<EnhancedTokenDetails, "symbol" | "ledger">): TokenRef {
    return {
        symbol: token.symbol,
        mark: token.symbol.slice(0, 1),
        gradient: AVATAR_GRADIENTS[swatchFor(token.ledger)],
    };
}

/**
 * The tokens a payment builder offers, `first` first (the token last sent, as the old builders
 * start from), in the wallet's order after it. One per symbol, since the library tells tokens
 * apart by their symbol: the first listed is kept. A payment pulled from the wallet costs the
 * transfer's fee and its approval's (`fee`); the least it can be is 10 transfer fees (`min`, the
 * old builders' `minAmount`).
 */
export function builderTokens(
    tokens: EnhancedTokenDetails[],
    rates: { get(ledger: string): TokenExchangeRates | undefined },
    first: string | undefined,
): BuilderToken[] {
    const ordered = [
        ...tokens.filter((t) => t.ledger === first),
        ...tokens.filter((t) => t.ledger !== first),
    ];
    const symbols = new Set<string>();
    return ordered.flatMap((t) => {
        if (symbols.has(t.symbol)) return [];
        symbols.add(t.symbol);
        const usd = rates.get(t.ledger)?.toUSD ?? 0;
        return [
            {
                ledger: t.ledger,
                token: {
                    ...tokenRef(t),
                    name: t.name,
                    bal: wholeTokens(t.balance, t.decimals),
                    fee: wholeTokens(t.transferFee + walletApprovalFee(t.transferFee), t.decimals),
                    min: wholeTokens(t.transferFee * 10n, t.decimals),
                    usd,
                    dp: displayDecimals(t.decimals, usd),
                },
            },
        ];
    });
}

/** Someone a transfer can go to, as `SendCryptoDialog` lists them. */
export function cryptoMember(user: UserSummary): CryptoMember {
    return {
        id: user.userId,
        name: user.displayName ?? user.username,
        handle: `@${user.username}`,
    };
}

/** What a staged payment's chip needs to know of its token (the registry's). */
export type TokenFacts = Pick<
    CryptocurrencyDetails,
    "symbol" | "ledger" | "decimals" | "transferFee"
>;

/** An amount in a token, as the composer's chip says it: "1.5 ICP". */
function tokenAmount(amount: bigint, token: TokenFacts): string {
    return `${formatTokens(amount, token.decimals)} ${token.symbol}`;
}

/** An amount as a builder's field holds it: its digits with a "." (no grouping), in full. */
export function typedAmount(amount: bigint, decimals: number): string {
    return formatTokens(amount, decimals, ".", true);
}

/**
 * A transfer staged in the composer, as the composer's chip shows it and as `SendCryptoDialog`
 * edits it again: the amount, who it goes to and its dollar value, and what it costs with the fees
 * (the transfer's and its approval's). None for a transfer that isn't pending.
 */
export function composerTransfer(
    content: CryptocurrencyContent,
    token: TokenFacts,
    price: number | undefined,
    recipient: UserSummary | undefined,
    t: Translate,
): Transfer | undefined {
    const transfer = content.transfer;
    if (transfer.kind !== "pending") return undefined;
    const fee = (transfer.feeE8s ?? token.transferFee) + walletApprovalFee(token.transferFee);
    const usd = price === undefined ? 0 : wholeTokens(transfer.amountE8s, token.decimals) * price;
    const usdText = price === undefined ? "" : formatConvertedValue("usd", usd);
    const member: CryptoMember =
        recipient === undefined
            ? { id: transfer.recipient, name: transfer.recipient, handle: "" }
            : cryptoMember(recipient);
    const amountText = tokenAmount(transfer.amountE8s, token);
    return {
        type: "transfer",
        token: tokenRef(token),
        amount: wholeTokens(transfer.amountE8s, token.decimals),
        amountText,
        usd,
        usdText,
        recipient: { id: member.id, name: member.name, handle: member.handle },
        fee: wholeTokens(fee, token.decimals),
        feeText: tokenAmount(fee, token),
        totalText: tokenAmount(transfer.amountE8s + fee, token),
        title: amountText,
        summary: t("ui.sendCryptoDialog.summary", { handle: member.handle, usd: usdText }),
        draft: {
            tok: token.symbol,
            amt: typedAmount(transfer.amountE8s, token.decimals),
            to: transfer.recipient,
        },
    };
}
