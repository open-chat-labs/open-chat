import { DEFAULT_EVENTS_TTL } from "@client";
import { DISAPPEARING_DURATIONS, durationMs } from "@openchat/ui/src/lib/durations";

// The lengths and their milliseconds are the library's (the web's picker's, TimedToggle), so the
// native details offer what the web does and read it the same way.
export { DISAPPEARING_DURATIONS, durationMs };

// the duration's units, largest first: a TTL reads in the largest one that divides it
const UNITS: [DurationUnit, number][] = [
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
];

/**
 * The lengths to offer for a chat whose TTL is `ttl`: the usual ones, and the chat's own too
 * where it's another (set from another app), in order of length, so it shows and stays picked.
 */
export function disappearingChoices(ttl: bigint | undefined): string[] {
    const current = ttlDurationId(ttl);
    if (DISAPPEARING_DURATIONS.includes(current)) return [...DISAPPEARING_DURATIONS];
    return [...DISAPPEARING_DURATIONS, current].sort((a, b) => durationMs(a) - durationMs(b));
}

/** A duration id's unit and count ("8 hours" → hour, 8), for words in the app's language. */
export function durationParts(id: string): { unit: DurationUnit; count: number } | undefined {
    const m = id.match(/^(\d+) (minute|hour|day|week)s?$/);
    return m === null ? undefined : { unit: m[2] as DurationUnit, count: Number(m[1]) };
}

export type DurationUnit = "minute" | "hour" | "day" | "week";

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
