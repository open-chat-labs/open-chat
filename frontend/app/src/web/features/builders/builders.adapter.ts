// The composer's "+" builders (5d) in the library's shapes, and back: what a builder dialog hands
// over, as the client's builders take it, and what the composer stages, as the library shows it.
import {
    formatTokens,
    prizeCosts,
    walletApprovalFee,
    type CryptocurrencyContent,
    type CryptocurrencyDetails,
    type EnhancedTokenDetails,
    type NewPoll,
    type PrizeContentInitial,
    type PrizeDiamond,
    type PrizeDistribution,
    type TokenExchangeRates,
    type UserSummary,
} from "@client";
import type { PollDraft } from "@openchat/ui/src/features/components/PollBuilderDialog.svelte";
import type { PrizeToken } from "@openchat/ui/src/features/components/PrizeBuilderDialog.svelte";
import type {
    CryptoMember,
    CryptoToken,
} from "@openchat/ui/src/features/components/SendCryptoDialog.svelte";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import type { Prize, PrizeDraft, TokenRef, Transfer } from "@openchat/ui/src/lib/types";
import type { PrizeConfig } from "@src/logic/prize/prizeForm.svelte";
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

// PrizeBuilderDialog's durations, in its order (its `dur` is an index into them), with their labels
const PRIZE_DURATIONS: [ms: number, key: string][] = [
    [60 * 60 * 1000, "oneHour"],
    [6 * 60 * 60 * 1000, "sixHours"],
    [24 * 60 * 60 * 1000, "oneDay"],
    [7 * 24 * 60 * 60 * 1000, "sevenDays"],
    [30 * 24 * 60 * 60 * 1000, "thirtyDays"],
    [90 * 24 * 60 * 60 * 1000, "ninetyDays"],
];

/** The index of the dialog's duration nearest `ms`. */
export function prizeDurationIndex(ms: number): number {
    let best = 0;
    PRIZE_DURATIONS.forEach(([d], i) => {
        if (Math.abs(d - ms) < Math.abs(PRIZE_DURATIONS[best][0] - ms)) best = i;
    });
    return best;
}

/** A token a prize can be paid in, as `PrizeBuilderDialog` lists it (`builderTokens`' order). */
export function prizeTokens(
    tokens: EnhancedTokenDetails[],
    rates: { get(ledger: string): TokenExchangeRates | undefined },
    first: string | undefined,
): { ledger: string; token: PrizeToken }[] {
    return builderTokens(tokens, rates, first).flatMap(({ ledger, token }) => {
        const details = tokens.find((t) => t.ledger === ledger);
        if (details === undefined) return [];
        return [
            {
                ledger,
                token: {
                    symbol: token.symbol,
                    mark: token.mark,
                    gradient: token.gradient,
                    bal: token.bal,
                    fee: wholeTokens(details.transferFee, details.decimals),
                    minPer: wholeTokens(details.transferFee * 100n, details.decimals),
                    dp: token.dp,
                },
            },
        ];
    });
}

/**
 * What a prize of `amount` (whole tokens, as the dialog holds it) among `winners` costs, as the
 * dialog shows it (`prizeCosts`): every fee on top of the fund, and the least the fund can be.
 */
export function prizePricing(
    token: TokenFacts,
    amount: number,
    winners: number,
): { fees: number; min: number } {
    const units =
        Number.isFinite(amount) && amount > 0
            ? BigInt(Math.floor(amount * 10 ** token.decimals))
            : 0n;
    const costs = prizeCosts(units, winners, token.transferFee);
    return {
        fees: wholeTokens(costs.totalFees, token.decimals),
        min: wholeTokens(costs.minAmount, token.decimals),
    };
}

/** The restrictions a prize has, as the dialog's draft holds them. */
function prizeGates(
    diamond: PrizeDiamond,
    minStreak: number,
    minChitEarned: number,
): PrizeDraft["gates"] {
    return {
        ...(diamond === "standard" ? { diamond: true } : {}),
        ...(diamond === "lifetime" ? { lifetime: true } : {}),
        ...(minStreak > 0 ? { streak: true } : {}),
        ...(minChitEarned > 0 ? { chit: true } : {}),
    };
}

/** A new prize's starting point in the dialog: the split, duration and restrictions last used. */
export function prizeDefaults(config: PrizeConfig): Partial<PrizeDraft> {
    return {
        even: config.distribution === "equal",
        dur: prizeDurationIndex(config.durationMs),
        gates: prizeGates(config.diamond, config.minStreak, config.minChitEarned),
        ...(config.minStreak > 0 ? { streak: config.minStreak } : {}),
        ...(config.minChitEarned > 0 ? { chit: config.minChitEarned } : {}),
    };
}

/** What `PrizeBuilderDialog`'s prize asks for, as `PrizeForm` holds it (its amount aside). */
export function prizeChoices(prize: Prize): PrizeConfig & { winners: number } {
    const rule = (kind: string) => prize.rules.find((r) => r.kind === kind);
    const distribution: PrizeDistribution = prize.even ? "equal" : "random";
    return {
        winners: prize.winners,
        distribution,
        durationMs: prize.durationMs,
        diamond: rule("lifetime") ? "lifetime" : rule("diamond") ? "standard" : "none",
        minStreak: rule("streak")?.min ?? 0,
        minChitEarned: rule("chit")?.min ?? 0,
    };
}

/**
 * A prize staged in the composer, as the composer's chip shows it and as `PrizeBuilderDialog`
 * edits it again: its fund, winners, how long it runs and how many restrictions it has, and what
 * it costs with the fees. Its split shows as even when every prize after the first is the same
 * (rounding goes to the first). None for one whose transfer isn't pending.
 */
export function composerPrize(
    content: PrizeContentInitial,
    token: TokenFacts,
    t: Translate,
): Prize | undefined {
    const transfer = content.transfer;
    if (transfer.kind !== "pending") return undefined;
    const winners = content.prizes.length;
    const durationMs = Number(content.endDate) - Number(transfer.createdAtNanos / 1_000_000n);
    const dur = prizeDurationIndex(durationMs);
    const [ms, key] = PRIZE_DURATIONS[dur];
    const even = content.prizes.slice(1).every((p) => p === content.prizes[1]);
    const diamond: PrizeDiamond = content.lifetimeDiamondOnly
        ? "lifetime"
        : content.diamondOnly
          ? "standard"
          : "none";
    const gates = prizeGates(diamond, content.streakOnly, content.minChitEarned);
    const rules: Prize["rules"] = [
        ...(diamond === "standard" ? [{ kind: "diamond" as const }] : []),
        ...(diamond === "lifetime" ? [{ kind: "lifetime" as const }] : []),
        ...(content.minChitEarned > 0
            ? [{ kind: "chit" as const, min: content.minChitEarned }]
            : []),
        ...(content.streakOnly > 0 ? [{ kind: "streak" as const, min: content.streakOnly }] : []),
    ];
    const short = t(`ui.prizeBuilderDialog.durations.${key}Short`);
    const amountText = tokenAmount(content.amount, token);
    return {
        token: tokenRef(token),
        amount: wholeTokens(content.amount, token.decimals),
        amountText,
        winners,
        even,
        endsIn: short,
        endsInLabel: t(`ui.prizeBuilderDialog.durations.${key}`),
        endsAt: Number(content.endDate),
        durationMs: ms,
        gates: [],
        rules,
        fee: wholeTokens(content.fees, token.decimals),
        feeText: tokenAmount(content.fees, token),
        totalText: tokenAmount(content.amount + content.fees, token),
        summary: [
            t("ui.prizeBuilderDialog.summaryWinners", { count: winners }),
            short,
            ...(rules.length > 0
                ? [t("ui.prizeBuilderDialog.summaryRules", { count: rules.length })]
                : []),
        ].join(" · "),
        draft: {
            tok: token.symbol,
            amt: typedAmount(content.amount, token.decimals),
            win: String(winners),
            dur,
            even,
            gates,
            streak: content.streakOnly > 0 ? content.streakOnly : 7,
            chit: content.minChitEarned > 0 ? content.minChitEarned : 10000,
        },
    };
}
