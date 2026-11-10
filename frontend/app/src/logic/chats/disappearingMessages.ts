import { DEFAULT_EVENTS_TTL } from "@client";

// the duration's units, largest first: a TTL reads in the largest one that divides it
const UNITS: [string, number][] = [
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
];

/**
 * The lengths a chat's disappearing messages can be set to, as duration ids: the web's picker's
 * (the library's TimedToggle), which the native DM details offer too.
 */
export const DISAPPEARING_DURATIONS: readonly string[] = [
    "1 hour",
    "8 hours",
    "12 hours",
    "1 day",
    "1 week",
    "30 days",
];

/**
 * The lengths to offer for a chat whose TTL is `ttl`: the usual ones, and the chat's own too
 * where it's another (set from another app), in order of length, so it shows and stays picked.
 */
export function disappearingChoices(ttl: bigint | undefined): string[] {
    const current = ttlDurationId(ttl);
    if (DISAPPEARING_DURATIONS.includes(current)) return [...DISAPPEARING_DURATIONS];
    return [...DISAPPEARING_DURATIONS, current].sort((a, b) => durationIdMs(a) - durationIdMs(b));
}

/** A duration id's unit and count ("8 hours" → hour, 8), for words in the app's language. */
export function durationParts(id: string): { unit: DurationUnit; count: number } | undefined {
    const m = id.match(/^(\d+) (minute|hour|day|week)s?$/);
    return m === null ? undefined : { unit: m[2] as DurationUnit, count: Number(m[1]) };
}

export type DurationUnit = "minute" | "hour" | "day" | "week";

/** A duration id's length in milliseconds (0 for one that isn't). */
export function durationIdMs(id: string): number {
    const parts = durationParts(id);
    if (parts === undefined) return 0;
    const size = UNITS.find(([unit]) => unit === parts.unit)?.[1] ?? 0;
    return parts.count * size;
}

/**
 * A disappearing-message TTL as a duration id ("1 week", "8 hours", "30 days"): the length a
 * settings panel shows and converts back to the same milliseconds. Off reads as the length they
 * start at when turned on (DEFAULT_EVENTS_TTL).
 */
export function ttlDurationId(ttl: bigint | undefined): string {
    const ms = Number(ttl === undefined || ttl <= 0n ? DEFAULT_EVENTS_TTL : ttl);
    const [unit, size] = UNITS.find(([, size]) => ms % size === 0) ?? UNITS[UNITS.length - 1];
    const n = Math.round(ms / size);
    return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
