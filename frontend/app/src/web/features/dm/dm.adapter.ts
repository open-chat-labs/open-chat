import type { PublicProfile, UserBadges } from "@client";
import { cssImage } from "../profile/profile.adapter";

// DmPanel's props from the other person's profile and the DM's settings, as the screen has loaded
// and formatted them.

// the duration's units, largest first: a TTL reads in the largest one that divides it
const UNITS: [string, number][] = [
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
];

// when disappearing messages are turned on, they start at a week, as the old desktop panel did:
// a long default deletes the fewest messages if they're turned on by mistake (#10112)
export const DEFAULT_TTL_LABEL = "1 week";

/** A disappearing-message TTL as DmChatSettings' duration id ("1 week", "8 hours", "30 days"). */
export function ttlLabel(ttl: bigint | undefined): string {
    if (ttl === undefined || ttl <= 0n) return DEFAULT_TTL_LABEL;
    const ms = Number(ttl);
    const [unit, size] = UNITS.find(([, size]) => ms % size === 0) ?? UNITS[UNITS.length - 1];
    const n = Math.round(ms / size);
    return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export type DmPanelInput = {
    name: string;
    profile: PublicProfile;
    avatarUrl: string;
    online: boolean;
    joined: string;
    // their CHIT badges, which userBadges leaves out when the viewer has turned CHIT off
    chit: UserBadges["chit"];
    eventsTTL: bigint | undefined;
    muted: boolean;
    favourite: boolean;
    blocked: boolean;
};

export function dmPanelProps(input: DmPanelInput) {
    return {
        title: input.name,
        handle: input.profile.username,
        about: input.profile.bio,
        avatar: cssImage(input.avatarUrl),
        online: input.online,
        memberSince: input.joined,
        chit: input.chit?.earned.toLocaleString(),
        fav: input.favourite,
        muted: input.muted ? ("always" as const) : null,
        disappearOn: input.eventsTTL !== undefined,
        disappearAfter: ttlLabel(input.eventsTTL),
        blocked: input.blocked,
    };
}
