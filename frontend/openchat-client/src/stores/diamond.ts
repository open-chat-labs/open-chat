import { type DiamondMembershipDuration, UnsupportedValueError } from "openchat-shared";

const MONTH_IN_MS: number = ((4 * 365 + 1) * 24 * 60 * 60 * 1000) / (4 * 12);
const THREE_MONTH_IN_MS: number = 3 * MONTH_IN_MS;
const YEAR_IN_MS: number = 12 * MONTH_IN_MS;

export function diamondDurationToMs(duration: DiamondMembershipDuration): number {
    if (duration === "one_month") {
        return MONTH_IN_MS;
    }
    if (duration === "three_months") {
        return THREE_MONTH_IN_MS;
    }
    if (duration === "one_year") {
        return YEAR_IN_MS;
    }
    if (duration === "lifetime") {
        return YEAR_IN_MS * 1000;
    }
    throw new UnsupportedValueError("Unknown diamond membership duration supplied", duration);
}
