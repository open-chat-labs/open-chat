import { ModerationFlags, type ModerationFlag } from "openchat-shared";
import { derived, writable } from "svelte/store";

export const moderationFlags = writable(0);

export function hasFlag(mask: number, flag: ModerationFlag): boolean {
    return (mask & flag) !== 0;
}

export const adultEnabled = derived(moderationFlags, (flags) =>
    hasFlag(flags, ModerationFlags.Adult)
);
export const offensiveEnabled = derived(moderationFlags, (flags) =>
    hasFlag(flags, ModerationFlags.Offensive)
);
export const underReviewEnabled = derived(moderationFlags, (flags) =>
    hasFlag(flags, ModerationFlags.UnderReview)
);
