import type { DiamondMembershipDetails } from "openchat-shared";
import { derived, writable } from "svelte/store";

export const diamondMembership = writable<DiamondMembershipDetails | undefined>(undefined);

export const isDiamond = derived(diamondMembership, ($diamondMembership) => {
    return $diamondMembership !== undefined && $diamondMembership.expiresAt > Date.now();
});

export const canExtendDiamond = derived(diamondMembership, ($diamondMembership) => {
    const now = Date.now();
    const threeMonths = now + (1000 * 60 * 60 * 24 * 365.25) / 4;
    return (
        $diamondMembership !== undefined &&
        $diamondMembership.expiresAt > now &&
        $diamondMembership.expiresAt < threeMonths
    );
});
