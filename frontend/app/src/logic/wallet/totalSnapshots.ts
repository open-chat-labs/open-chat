// The wallet total's "today" (native design notes §4): worked out on the device from hourly
// snapshots of the total in each display currency, and hidden until there's one from 24 hours ago.
// Nothing on the backend tracks it. A snapshot is taken while the wallet shows with its balances
// and prices in, at most one an hour, and kept for two days, per user, on this device.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const KEEP = 2 * DAY;

/** The total at a moment, in each display currency it could be priced in (USD, ICP, BTC, ETH). */
export type TotalSnapshot = { at: number; totals: Record<string, number> };

/**
 * The snapshots with the total now added, if the last is an hour old or more (or there's none),
 * and those older than two days dropped. The same list when nothing changes.
 */
export function recordSnapshot(
    snapshots: TotalSnapshot[],
    totals: Record<string, number>,
    now: number,
): TotalSnapshot[] {
    const last = snapshots[snapshots.length - 1];
    if (last !== undefined && now - last.at < HOUR && now >= last.at) return snapshots;
    return [...snapshots.filter((s) => now - s.at <= KEEP && s.at <= now), { at: now, totals }];
}

/**
 * The total's change since this time yesterday, as a fraction (0.018 for +1.8%), in `currency`:
 * against the newest snapshot at least 24 hours old, if it's from no more than an hour before that
 * (a snapshot an hour apart is as near as they come). Undefined without one, or one that was zero
 * or wasn't priced in that currency: the pill stays hidden.
 */
export function changeToday(
    snapshots: TotalSnapshot[],
    current: number,
    currency: string,
    now: number,
): number | undefined {
    const then = snapshots
        .filter((s) => now - s.at >= DAY && now - s.at <= DAY + HOUR)
        .sort((a, b) => b.at - a.at)[0];
    const before = then?.totals[currency];
    if (before === undefined || !(before > 0)) return undefined;
    return (current - before) / before;
}

/** The totals in each display currency, from the total in USD and the currencies' USD rates. */
export function totalsByCurrency(
    totalUsd: number,
    rates: Record<string, number>,
): Record<string, number> {
    return Object.fromEntries(
        Object.entries(rates)
            .filter(([, rate]) => rate > 0)
            .map(([currency, rate]) => [currency, totalUsd / rate]),
    );
}

/** Where a user's snapshots are kept (localStorage, or anything like it). */
export type SnapshotStorage = Pick<Storage, "getItem" | "setItem">;

const key = (userId: string) => `openchat_wallet_total_snapshots_${userId}`;

/** The user's snapshots on this device: none if there are none, or they don't read as snapshots. */
export function loadSnapshots(storage: SnapshotStorage, userId: string): TotalSnapshot[] {
    try {
        const parsed: unknown = JSON.parse(storage.getItem(key(userId)) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter(isSnapshot) : [];
    } catch {
        return [];
    }
}

export function saveSnapshots(
    storage: SnapshotStorage,
    userId: string,
    snapshots: TotalSnapshot[],
): void {
    try {
        storage.setItem(key(userId), JSON.stringify(snapshots));
    } catch (err) {
        // a full or blocked storage only costs the pill
        console.warn("Unable to keep the wallet's total snapshots", err);
    }
}

function isSnapshot(s: unknown): s is TotalSnapshot {
    if (typeof s !== "object" || s === null) return false;
    const { at, totals } = s as { at?: unknown; totals?: unknown };
    return (
        typeof at === "number" &&
        typeof totals === "object" &&
        totals !== null &&
        Object.values(totals).every((v) => typeof v === "number")
    );
}
