import {
    DiamondMembershipDetails,
    DiamondMembershipDuration,
    UnsupportedValueError,
} from "openchat-shared";
import { derived, writable } from "svelte/store";

export const diamondMembership = writable<DiamondMembershipDetails | undefined>(undefined);

export const isDiamond = derived(diamondMembership, ($diamondMembership) => {
    return $diamondMembership !== undefined && $diamondMembership.expiresAt > Date.now();
});

const MONTH_IN_MS: number = ((4 * 365 + 1) * 24 * 60 * 60 * 1000) / (4 * 12);
const THREE_MONTH_IN_MS: number = 3 * MONTH_IN_MS;
const YEAR_IN_MS: number = 12 * MONTH_IN_MS;

export const canExtendDiamond = derived(diamondMembership, ($diamondMembership) => {
    const now = Date.now();
    const threeMonths = now + THREE_MONTH_IN_MS;
    return (
        $diamondMembership !== undefined &&
        $diamondMembership.expiresAt > now &&
        $diamondMembership.expiresAt < threeMonths
    );
});

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
    throw new UnsupportedValueError("Unknown diamond membership duration supplied", duration);
}
