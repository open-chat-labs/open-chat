import { ONE_DAY } from "@client";
import { disableStreakInsuranceFeature } from "@src/utils/features";
import { insuranceRow, streakMilestones, weekStrip } from "./chitScreen";

const TODAY = Date.UTC(2026, 10, 24);
const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe("the streak milestones", () => {
    test("say which are reached, how far the rest are, and which is next", () => {
        const rows = streakMilestones(8, [3, 7, 14, 30]);
        expect(rows.map((r) => [r.days, r.reached, r.left, r.next])).toEqual([
            [3, true, 0, false],
            [7, true, 0, false],
            [14, false, 6, true],
            [30, false, 22, false],
        ]);
    });

    test("say what a claim pays from each on, rising with the streak", () => {
        const rows = streakMilestones(0);
        expect(rows.length).toBeGreaterThan(0);
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i].pays).toBeGreaterThan(rows[i - 1].pays);
        }
    });

    test("have none next once all are reached", () => {
        expect(streakMilestones(400, [3, 7]).some((r) => r.next)).toBe(false);
    });
});

describe("the 7-day strip", () => {
    test("is the last seven days, today last, claimed, insured or missed", () => {
        const strip = weekStrip(
            [
                { day: key(TODAY - 2 * ONE_DAY), streakDay: 1, amount: 200 },
                { day: key(TODAY - ONE_DAY), streakDay: 2, insured: true },
                { day: key(TODAY), streakDay: 3, amount: 200 },
            ],
            TODAY,
            TODAY - 30 * ONE_DAY,
        );
        expect(strip).toHaveLength(7);
        expect(strip.map((d) => d.state)).toEqual([
            "missed",
            "missed",
            "missed",
            "missed",
            "claimed",
            "insured",
            "claimed",
        ]);
        expect(strip[6]).toMatchObject({ day: TODAY, today: true });
    });

    test("has today open until its claim is on the history, and nothing before the account", () => {
        const strip = weekStrip([], TODAY, TODAY - 2 * ONE_DAY);
        expect(strip.map((d) => d.state)).toEqual([
            "none",
            "none",
            "none",
            "none",
            "missed",
            "missed",
            "open",
        ]);
    });
});

describe("the streak insurance row", () => {
    test("is the cover held and the days used", () => {
        expect(insuranceRow({ daysInsured: 5, daysMissed: 2 }, false)).toEqual({
            held: 3,
            used: 2,
        });
    });

    test("is left out of an app store build: insurance is paid in CHAT (invariant 6)", () => {
        expect(insuranceRow({ daysInsured: 5, daysMissed: 2 }, true)).toBeUndefined();
    });

    test("is offered in a full build (the flag this spec runs with)", () => {
        expect(disableStreakInsuranceFeature).toBe(false);
    });
});
