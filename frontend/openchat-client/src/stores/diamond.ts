import type { DiamondMembershipDetails } from "openchat-shared";
import { derived, readable, writable } from "svelte/store";

function intervalStore(duration: number) {
    return readable(Date.now(), (set) => {
        const interval = window.setInterval(() => {
            set(Date.now());
        }, duration);

        return function stop() {
            window.clearInterval(interval);
        };
    });
}

export const now = intervalStore(60000);
export const diamondMembership = writable<DiamondMembershipDetails | undefined>(undefined);

export const isDiamond = derived(diamondMembership, ($diamondMembership) => {
    return $diamondMembership !== undefined && $diamondMembership.expiresAt > Date.now();
});
