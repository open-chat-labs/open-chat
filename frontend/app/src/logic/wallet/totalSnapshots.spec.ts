import { describe, expect, test } from "vitest";
import {
    changeToday,
    loadSnapshots,
    recordSnapshot,
    saveSnapshots,
    totalsByCurrency,
    type TotalSnapshot,
} from "./totalSnapshots";

const HOUR = 3_600_000;
const NOW = 100 * 24 * HOUR;
const snap = (hoursAgo: number, usd: number): TotalSnapshot => ({
    at: NOW - hoursAgo * HOUR,
    totals: { USD: usd },
});

describe("recording the total", () => {
    test("the first snapshot is taken at once", () => {
        expect(recordSnapshot([], { USD: 10 }, NOW)).toEqual([{ at: NOW, totals: { USD: 10 } }]);
    });

    test("at most one an hour", () => {
        const list = [snap(0.5, 10)];
        expect(recordSnapshot(list, { USD: 11 }, NOW)).toBe(list);
        expect(recordSnapshot([snap(1, 10)], { USD: 11 }, NOW)).toHaveLength(2);
    });

    test("snapshots older than two days are dropped", () => {
        const next = recordSnapshot([snap(49, 1), snap(30, 2)], { USD: 3 }, NOW);
        expect(next.map((s) => s.totals.USD)).toEqual([2, 3]);
    });

    test("a clock moved back drops the snapshots from its future", () => {
        const next = recordSnapshot([snap(-5, 1)], { USD: 3 }, NOW);
        expect(next.map((s) => s.totals.USD)).toEqual([3]);
    });
});

describe("the total's change today", () => {
    test("hidden until there's a snapshot from 24 hours ago", () => {
        expect(changeToday([], 10, "USD", NOW)).toBeUndefined();
        expect(changeToday([snap(23, 8), snap(1, 9)], 10, "USD", NOW)).toBeUndefined();
    });

    test("against the newest snapshot at least 24 hours old", () => {
        expect(changeToday([snap(24.8, 5), snap(24.2, 8)], 10, "USD", NOW)).toBeCloseTo(0.25);
    });

    test("not against one much older than a day (the wallet wasn't opened then)", () => {
        expect(changeToday([snap(30, 8)], 10, "USD", NOW)).toBeUndefined();
    });

    test("down is negative", () => {
        expect(changeToday([snap(24, 20)], 10, "USD", NOW)).toBeCloseTo(-0.5);
    });

    test("in the display currency, hidden where yesterday's wasn't priced in it or was zero", () => {
        const s: TotalSnapshot = { at: NOW - 24 * HOUR, totals: { USD: 10, ICP: 2 } };
        expect(changeToday([s], 3, "ICP", NOW)).toBeCloseTo(0.5);
        expect(changeToday([s], 3, "BTC", NOW)).toBeUndefined();
        expect(changeToday([snap(24, 0)], 3, "USD", NOW)).toBeUndefined();
    });
});

describe("totals by currency", () => {
    test("the USD total over each rate", () => {
        expect(totalsByCurrency(100, { USD: 1, ICP: 5 })).toEqual({ USD: 100, ICP: 20 });
    });
});

describe("keeping them", () => {
    function memory(): Storage {
        const items = new Map<string, string>();
        return {
            getItem: (k: string) => items.get(k) ?? null,
            setItem: (k: string, v: string) => void items.set(k, v),
        } as Storage;
    }

    test("per user, read back as saved", () => {
        const storage = memory();
        saveSnapshots(storage, "u1", [snap(1, 5)]);
        expect(loadSnapshots(storage, "u1")).toEqual([snap(1, 5)]);
        expect(loadSnapshots(storage, "u2")).toEqual([]);
    });

    test("anything that doesn't read as snapshots is none", () => {
        const storage = memory();
        storage.setItem("openchat_wallet_total_snapshots_u1", "{nope");
        expect(loadSnapshots(storage, "u1")).toEqual([]);
        storage.setItem(
            "openchat_wallet_total_snapshots_u1",
            '[{"at":"x"},{"at":1,"totals":{"USD":2}}]',
        );
        expect(loadSnapshots(storage, "u1")).toEqual([{ at: 1, totals: { USD: 2 } }]);
    });
});
