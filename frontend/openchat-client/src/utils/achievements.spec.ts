import { achievements, type ChitEvent, type ExternalAchievement } from "@shared";
import { achievementList, achievementReward, chitEarnedSummary } from "./achievements";

describe("what an achievement pays", () => {
    test("is the backend's reward", () => {
        expect(achievementReward("sent_text")).toBe(700);
        expect(achievementReward("streak_365")).toBe(50000);
        expect(achievementReward("referred_50th_user")).toBe(50000);
    });
});

describe("the achievements to show", () => {
    const NOW = 1_000_000;
    const external = (
        name: string,
        chitReward: number,
        extra: Partial<ExternalAchievement> = {},
    ): ExternalAchievement => ({
        id: chitReward,
        url: `https://example.com/${name}`,
        name,
        chitReward,
        expires: BigInt(NOW + 1000),
        budgetExhausted: false,
        ...extra,
    });

    test("are the offered ones and any other already earned, each with its reward", () => {
        const list = achievementList(achievements, new Set(["changed_theme"]), [], NOW);
        const ids = list.map((a) => (a.kind === "internal" ? a.id : a.name));
        expect(ids).toContain("sent_text");
        // not offered, but earned
        expect(ids).toContain("changed_theme");
        // neither
        expect(ids).not.toContain("started_call");
        expect(list.find((a) => a.kind === "internal" && a.id === "changed_theme")).toEqual({
            kind: "internal",
            id: "changed_theme",
            reward: 800,
            done: true,
        });
    });

    test("then the external ones earned or still open, the best paying first", () => {
        const list = achievementList(
            ["sent_text"],
            new Set(["Old"]),
            [
                external("Small", 100),
                external("Big", 900),
                external("Expired", 500, { expires: BigInt(NOW - 1) }),
                external("Spent", 400, { budgetExhausted: true }),
                // past its time but earned: still shown
                external("Old", 300, { expires: BigInt(NOW - 1) }),
            ],
            NOW,
        );
        expect(list.map((a) => (a.kind === "internal" ? a.id : [a.name, a.done]))).toEqual([
            "sent_text",
            ["Big", false],
            ["Old", true],
            ["Small", false],
        ]);
    });
});

describe("the earned popup", () => {
    const event = (amount: number, reason: ChitEvent["reason"]): ChitEvent => ({
        amount,
        timestamp: 1n,
        reason,
    });

    test("sums the CHIT and names each achievement", () => {
        expect(
            chitEarnedSummary([
                event(700, { kind: "achievement_unlocked", type: "sent_text" }),
                event(300, { kind: "external_achievement_unlocked", name: "Partner" }),
                event(200, { kind: "daily_claim" }),
            ]),
        ).toEqual({
            amount: 1200,
            achievements: [
                { kind: "internal", id: "sent_text" },
                { kind: "external", name: "Partner" },
            ],
            maxStreak: false,
        });
    });

    test("says when the longest streak is among them", () => {
        expect(
            chitEarnedSummary([event(50000, { kind: "achievement_unlocked", type: "streak_365" })])
                .maxStreak,
        ).toBe(true);
    });
});
