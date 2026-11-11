// Making a prize: what it costs, the least and most it can be, and how its fund is split between
// its winners. Shared by every tree's prize builder.
import { walletApprovalFee, type ChatIdentifier, type PrizeContentInitial } from "@shared";

/** OpenChat's cut of a prize's fund. */
export const PRIZE_FEE_PERCENT = 5n;
/** The most winners a prize can have. */
export const MAX_PRIZE_WINNERS = 1000;
/** The most users a prize can exclude from claiming it. */
export const MAX_PRIZE_EXCLUDED_USERS = 50;

/** How a prize's fund is split: the same for every winner, or a random amount each. */
export type PrizeDistribution = "equal" | "random";

/** Who can claim a prize, by their Diamond membership. */
export type PrizeDiamond = "none" | "standard" | "lifetime";

/** What a prize costs on top of its fund, and the least its fund can be. */
export type PrizeCosts = {
    /** What the prize's canister is paid on top of the fund: a transfer fee per winner, and
     * OpenChat's 5% of the fund. */
    prizeFees: bigint;
    /** Everything on top of the fund: the fund's own transfer, the approval the wallet makes
     * before it's pulled, and the prize's fees. */
    totalFees: bigint;
    /** 100 transfer fees a winner. */
    minAmount: bigint;
};

export function prizeCosts(amount: bigint, winners: number, transferFee: bigint): PrizeCosts {
    const count = BigInt(Math.max(0, winners));
    const prizeFees = transferFee * count + (amount * PRIZE_FEE_PERCENT) / 100n;
    return {
        prizeFees,
        totalFees: transferFee + walletApprovalFee(transferFee) + prizeFees,
        minAmount: 100n * count * transferFee,
    };
}

/** The most the fund can be paid from a balance, with the fees it then costs (never below 0). */
export function prizeMaximum(
    balance: bigint,
    amount: bigint,
    winners: number,
    transferFee: bigint,
): bigint {
    const max = balance - prizeCosts(amount, winners, transferFee).totalFees;
    return max > 0n ? max : 0n;
}

/** 1 to 1000 winners. */
export function validPrizeWinners(winners: number | undefined): winners is number {
    return (
        winners !== undefined &&
        Number.isInteger(winners) &&
        winners >= 1 &&
        winners <= MAX_PRIZE_WINNERS
    );
}

/**
 * The fund split into `winners` prizes that add up to it exactly (any rounding goes to the first
 * prize). Equal shares, or random ones (each 0.1 to 2 times an equal share before they're scaled
 * to the fund), none of them below the transfer fee: what's added to those goes from the biggest.
 */
export function generatePrizes(
    fund: bigint,
    winners: number,
    distribution: PrizeDistribution,
    transferFee: bigint,
    random: () => number = Math.random,
): bigint[] {
    if (winners <= 0) return [];
    const share = Math.round(Number(fund) / winners);
    switch (distribution) {
        case "equal":
            return compensateRounding(
                Array.from({ length: winners }, () => BigInt(share)),
                fund,
            );
        case "random": {
            const min = share * 0.1;
            const max = share * 2;
            const intermediate = Array.from({ length: winners }, () =>
                Math.floor(min + random() * (max - min)),
            );
            const total = intermediate.reduce((agg, p) => agg + p, 0);
            // there may be more prizes than the fund, so they're scaled to it
            const scale = total / Number(fund);
            const scaled = intermediate.map((p) => BigInt(Math.round(p / scale)));
            return atLeastTransferFee(compensateRounding(scaled, fund), transferFee);
        }
    }
}

// any rounding error goes to the first prize
function compensateRounding(prizes: bigint[], fund: bigint): bigint[] {
    const total = prizes.reduce((agg, p) => agg + p, 0n);
    const diff = fund - total;
    if (diff !== 0n) prizes[0] = prizes[0] + diff;
    return prizes;
}

// no prize is below the transfer fee: what that adds is taken from the biggest prize
function atLeastTransferFee(prizes: bigint[], transferFee: bigint): bigint[] {
    let totalAdded = 0n;
    let max = 0n;
    let maxIndex = 0;
    for (let i = 0; i < prizes.length; i++) {
        const prize = prizes[i];
        if (prize < transferFee) {
            prizes[i] = transferFee;
            totalAdded += transferFee - prize;
        } else if (prize > max) {
            max = prize;
            maxIndex = i;
        }
    }
    if (totalAdded > 0n) prizes[maxIndex] = max - totalAdded;
    return prizes;
}

/** Where a prize's fund goes: its group or community. None in a DM, where there are no prizes. */
export function prizeRecipient(chatId: ChatIdentifier): string | undefined {
    switch (chatId.kind) {
        case "channel":
            return chatId.communityId;
        case "group_chat":
            return chatId.groupId;
        default:
            return undefined;
    }
}

/** A prize as a builder holds it. */
export type NewPrize = {
    chatId: ChatIdentifier;
    ledger: string;
    symbol: string;
    transferFee: bigint;
    /** The fund, in the token's smallest unit. */
    amount: bigint;
    winners: number;
    distribution: PrizeDistribution;
    /** How long it runs from when it's made. */
    durationMs: number;
    diamond: PrizeDiamond;
    /** A streak of at least this many days; 0 for none. */
    minStreak: number;
    /** At least this much CHIT earned; 0 for none. */
    minChitEarned: number;
    /** An account registered at least this long ago, in ms; 0 for none. */
    minAccountAgeMs: number;
    /** Users who can't claim it (user ids). */
    excludedUsers: string[];
    /** Where the fund comes from: an external wallet that has approved it (`fromAccount`), one a
     * draft will ask (`fromWallet`), or neither for the user's OpenChat account. */
    from?: { fromAccount?: string; fromWallet?: string };
};

/**
 * The prize to send: its fund split into its prizes, the transfer that pays for them and the
 * prize's fees, and its end `durationMs` from `now`. Unique-person gating is suspended, so it's
 * always off. None in a DM.
 */
export function newPrizeContent(
    prize: NewPrize,
    now: number,
    random: () => number = Math.random,
): PrizeContentInitial | undefined {
    const recipient = prizeRecipient(prize.chatId);
    if (recipient === undefined) return undefined;
    const { prizeFees, totalFees } = prizeCosts(prize.amount, prize.winners, prize.transferFee);
    const prizes = generatePrizes(
        prize.amount,
        prize.winners,
        prize.distribution,
        prize.transferFee,
        random,
    );
    return {
        kind: "prize_content_initial",
        caption: undefined,
        endDate: BigInt(now + prize.durationMs),
        diamondOnly: prize.diamond === "standard",
        lifetimeDiamondOnly: prize.diamond === "lifetime",
        uniquePersonOnly: false,
        streakOnly: prize.minStreak,
        minChitEarned: prize.minChitEarned,
        minAccountAgeMs: prize.minAccountAgeMs,
        excludedUsers: prize.excludedUsers.slice(0, MAX_PRIZE_EXCLUDED_USERS),
        transfer: {
            kind: "pending",
            ledger: prize.ledger,
            token: prize.symbol,
            recipient,
            amountE8s: prizes.reduce((total, p) => total + p, 0n) + prizeFees,
            feeE8s: prize.transferFee,
            createdAtNanos: BigInt(now) * 1_000_000n,
            ...prize.from,
        },
        amount: prize.amount,
        fees: totalFees,
        prizes,
    };
}
