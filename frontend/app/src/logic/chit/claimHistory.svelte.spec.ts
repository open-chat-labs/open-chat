import type { ChitEvent, ClaimDailyChitResponse } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    ClaimHistory,
    RELOAD_MARGIN_DAYS,
    reloadFrom,
    withTodaysClaim,
} from "./claimHistory.svelte";

const DAY = 24 * 60 * 60 * 1000;
// 2026-03-01T00:00Z
const MARCH_1 = Date.UTC(2026, 2, 1);
const JOINED = MARCH_1 - 10 * DAY;
const utc = () => 0;

const claim = (ms: number, amount = 200): ChitEvent => ({
    amount,
    timestamp: BigInt(ms),
    reason: { kind: "daily_claim" },
});

const success: ClaimDailyChitResponse = {
    kind: "success",
    streak: 2,
    maxStreak: 2,
    chitBalance: 400,
    chitEarned: 200,
    nextDailyChitClaim: BigInt(MARCH_1 + 2 * DAY),
};

function fakeClient(
    history: (from: bigint) => Promise<ChitEvent[]>,
    answer: () => Promise<ClaimDailyChitResponse> = async () => success,
) {
    return { chitHistory: vi.fn(history), claimDailyChit: vi.fn(answer) };
}

describe("the claim history's reloads", () => {
    test("start when the account was made, then two days before the newest event held", () => {
        expect(reloadFrom([], JOINED)).toBe(BigInt(JOINED));
        expect(reloadFrom([claim(MARCH_1 - DAY), claim(MARCH_1)], JOINED)).toBe(
            BigInt(MARCH_1 - RELOAD_MARGIN_DAYS * DAY),
        );
    });

    test("a load overtaken by a later one changes nothing", async () => {
        let first!: (events: ChitEvent[]) => void;
        const client = fakeClient(vi.fn());
        client.chitHistory
            .mockImplementationOnce(() => new Promise((resolve) => (first = resolve)))
            .mockImplementationOnce(async () => [claim(MARCH_1)]);
        const history = new ClaimHistory(client, JOINED);
        const stale = history.load();
        await history.load();
        first([claim(MARCH_1 - 5 * DAY, 999)]);
        await stale;
        expect(history.days.map((d) => d.amount)).toEqual([200]);
    });

    test("a load that fails leaves the days as they were", async () => {
        const client = fakeClient(async () => [claim(MARCH_1)]);
        const history = new ClaimHistory(client, JOINED);
        await history.load();
        client.chitHistory.mockRejectedValueOnce(new Error("offline"));
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await history.load();
        expect(history.days).toHaveLength(1);
    });
});

describe("claiming from the calendar", () => {
    test("today's claim shows at once, before the history reloaded after it has it", async () => {
        let reload!: (events: ChitEvent[]) => void;
        const client = fakeClient(async () => [claim(MARCH_1)]);
        const history = new ClaimHistory(client, JOINED);
        await history.load();
        client.chitHistory.mockImplementationOnce(
            () => new Promise((resolve) => (reload = resolve)),
        );
        await history.claim(MARCH_1 + DAY + 60_000);
        expect(history.days.find((d) => d.amount === 200 && d.streakDay === 2)).toBeDefined();
        reload([claim(MARCH_1 + DAY + 60_000)]);
    });

    test("reloads whatever the answer, so a day claimed already elsewhere shows as claimed", async () => {
        const client = fakeClient(
            async () => [],
            async () => ({ kind: "already_claimed", nextDailyChitClaim: BigInt(MARCH_1 + DAY) }),
        );
        const history = new ClaimHistory(client, JOINED);
        await history.claim(MARCH_1 + 60_000);
        expect(client.chitHistory).toHaveBeenCalledTimes(1);
    });

    test("a claim that fails rejects, for the dialog to say so", async () => {
        const client = fakeClient(
            async () => [],
            () => Promise.reject(new Error("failed")),
        );
        await expect(new ClaimHistory(client, JOINED).claim()).rejects.toThrow("failed");
    });
});

describe("today's claim on the calendar", () => {
    test("is on the user's own day, with its streak day, the CHIT it paid and when", () => {
        const now = MARCH_1 + DAY + 90 * 60_000;
        expect(withTodaysClaim([], { streak: 7, chitEarned: 400 }, now, utc)).toEqual([
            { day: "2026-03-02", streakDay: 7, amount: 400, minute: 90, at: now },
        ]);
        // 23:30 UTC on the 1st is the 2nd at UTC+2
        expect(withTodaysClaim([], success, MARCH_1 + DAY - 30 * 60_000, () => 120)[0].day).toBe(
            "2026-03-02",
        );
    });

    test("takes the place of what the day had", () => {
        const missed = { day: "2026-03-02", streakDay: 1 };
        expect(withTodaysClaim([missed], success, MARCH_1 + DAY, utc)).toHaveLength(1);
    });
});
