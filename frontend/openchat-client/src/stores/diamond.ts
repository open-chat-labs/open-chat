import type { DiamondMembershipDetails } from "openchat-shared";
import { derived, writable } from "svelte/store";

export const diamondMembership = writable<DiamondMembershipDetails | undefined>(undefined);

export const isDiamond = derived(diamondMembership, ($diamondMembership) => {
    return $diamondMembership !== undefined && $diamondMembership.expiresAt > Date.now();
});
