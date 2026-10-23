// What streak insurance costs, as the backend charges it: each day of cover costs twice the one
// before, by the days bought so far (missed days spend cover but don't make it cheaper again),
// and no more than 30 days can be bought.

/** The most days of cover a user can buy (the backend's `Streak::MAX_DAYS_INSURED`). */
export const STREAK_INSURANCE_MAX_DAYS = 30;

const CHAT_E8S = 100_000_000n;

/**
 * What `additionalDays` more days of cover cost, in CHAT e8s, with `daysInsured` bought already:
 * the price sent with the purchase.
 */
export function streakInsurancePrice(daysInsured: number, additionalDays: number): bigint {
    let total = 0n;
    for (let i = 0; i < additionalDays; i++) {
        total += 2n ** BigInt(daysInsured + i) * CHAT_E8S;
    }
    return total;
}
