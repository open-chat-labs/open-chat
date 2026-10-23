import { DEFAULT_EVENTS_TTL } from "@client";

// the duration's units, largest first: a TTL reads in the largest one that divides it
const UNITS: [string, number][] = [
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
];

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
