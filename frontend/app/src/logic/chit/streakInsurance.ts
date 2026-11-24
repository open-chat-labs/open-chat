import {
    CHAT_E8S,
    STREAK_INSURANCE_MAX_DAYS,
    streakInsuranceDayPrice,
    streakInsurancePrice,
    walletApprovalFee,
    type StreakInsurance,
} from "@client";

// Buying streak insurance, paid in CHAT, as the web's StreakInsuranceDialog and the native Streak
// insurance screen offer it. Moved from the web's CHIT adapter (N11).

// CHAT e8s as CHAT
function chat(e8s: bigint): number {
    return Number(e8s) / Number(CHAT_E8S);
}

/**
 * StreakInsuranceDialog's `prices`: what each position of the user's cover costs, in CHAT. The
 * dialog prices a position by the cover held (bought less missed days used), the backend by the
 * days bought, so the positions are offset by the days used, and there are fewer of them as the
 * days bought can't pass 30: what the dialog shows is what's charged.
 */
export function streakInsuranceDialogPrices({ daysMissed }: StreakInsurance): number[] {
    return Array.from(
        { length: Math.max(STREAK_INSURANCE_MAX_DAYS - daysMissed, 0) },
        (_, position) => chat(streakInsuranceDayPrice(daysMissed + position)),
    );
}

/**
 * The CHAT the dialog can spend, in CHAT: the balance less the fee for the approval the user makes
 * before the price is taken (the price itself is burned, with no fee), so a day it offers can be
 * paid. None for a balance not loaded, or while CHAT's fee isn't known (without it, nothing is
 * known to be left for the approval).
 */
export function streakInsuranceBalance(
    balanceE8s: bigint,
    transferFee: bigint | undefined,
): number {
    if (transferFee === undefined) return 0;
    const spendable = balanceE8s - walletApprovalFee(transferFee);
    return spendable > 0n ? chat(spendable) : 0;
}

/**
 * What buying `requested` more days sends: the days, capped so cover bought never passes 30, and
 * their price worked out from the cover bought (streakInsuranceStore), never the dialog's figure.
 */
export function streakInsurancePurchase(
    { daysInsured }: StreakInsurance,
    requested: number,
): { days: number; price: bigint } {
    const days = Math.max(Math.min(requested, STREAK_INSURANCE_MAX_DAYS - daysInsured), 0);
    return { days, price: streakInsurancePrice(daysInsured, days) };
}

/** How many rungs of the price ladder the native screen shows, from the next day to add. */
export const LADDER_RUNGS = 7;

/** What the native Streak insurance screen shows for `picked` more days of cover. */
export type InsuranceQuote = {
    /** Days of cover held: bought less used. */
    held: number;
    used: number;
    /** How many more can be added. */
    room: number;
    /** The days to add: `picked`, within the room (0 with none). */
    days: number;
    /** What they cost, in CHAT. */
    total: number;
    affordable: boolean;
    canBuy: boolean;
    /** The next rungs of the price ladder (positions in the cover, 0-based), those added marked. */
    ladder: { position: number; price: number; adding: boolean }[];
};

/**
 * The cover held, the days to add and what they cost, as StreakInsuranceDialog works them out:
 * `prices` are streakInsuranceDialogPrices' (one a position, their number the most that can be
 * held), `balance` streakInsuranceBalance's (CHAT that can be spent).
 */
export function insuranceQuote(
    prices: readonly number[],
    { daysInsured, daysMissed }: StreakInsurance,
    picked: number,
    balance: number,
): InsuranceQuote {
    const held = Math.min(Math.max(daysInsured - daysMissed, 0), prices.length);
    const room = prices.length - held;
    const days = Math.max(Math.min(picked, room), 0);
    const total = prices.slice(held, held + days).reduce((sum, p) => sum + p, 0);
    const affordable = total <= balance;
    const ladder = prices
        .slice(held, held + Math.max(LADDER_RUNGS, days))
        .map((price, i) => ({ position: held + i, price, adding: i < days }));
    return {
        held,
        used: daysMissed,
        room,
        days,
        total,
        affordable,
        canBuy: days > 0 && affordable,
        ladder,
    };
}
