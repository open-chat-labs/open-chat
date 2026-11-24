import { achievementList, achievements, type ChitEvent } from "@client";
import { achievementItems, achievementsCount, latestAchievements } from "./achievements";

const NOW = 10 * 24 * 60 * 60 * 1000;

describe("the ways to earn", () => {
    const entries = achievementList(
        achievements,
        new Set(["sent_text"]),
        [
            {
                id: 7,
                url: "https://partner.example",
                name: "Partner quest",
                chitReward: 5000,
                expires: BigInt(NOW + 1000),
                budgetExhausted: false,
            },
        ],
        NOW,
    );

    test("put each achievement in its group, with its reward, band and the old UI's name", () => {
        const items = achievementItems(entries, (id) => `name of ${id}`);
        expect(items.find((a) => a.id === "sent_text")).toEqual({
            id: "sent_text",
            group: "messaging",
            reward: 700,
            done: true,
            band: "quick",
            label: "name of sent_text",
        });
        expect(items.find((a) => a.id === "referred_1st_user")?.group).toBe("referrals");
        expect(items.find((a) => a.id === "streak_30")).toMatchObject({
            group: "streaks",
            band: "big",
        });
        // a partner's, under its name
        expect(items.find((a) => a.id === "Partner quest")).toMatchObject({
            group: "partners",
            reward: 5000,
            label: "Partner quest",
        });
    });

    test("count what's left for ChitDialog", () => {
        expect(achievementsCount(entries)).toEqual({
            total: entries.length,
            left: entries.length - 1,
        });
    });
});

describe("the latest achievements", () => {
    const event = (ms: number, reason: ChitEvent["reason"], amount = 500): ChitEvent => ({
        amount,
        timestamp: BigInt(ms),
        reason,
    });

    test("are the achievements earned, newest first, at most the count, claims left out", () => {
        const events = [
            event(1, { kind: "achievement_unlocked", type: "sent_text" }),
            event(2, { kind: "daily_claim" }, 200),
            event(3, { kind: "external_achievement_unlocked", name: "Partner quest" }, 5000),
            event(4, { kind: "achievement_unlocked", type: "set_bio" }),
            event(5, { kind: "achievement_unlocked", type: "set_avatar" }),
        ];
        expect(latestAchievements(events, 3)).toEqual([
            { kind: "internal", id: "set_avatar", amount: 500, at: 5 },
            { kind: "internal", id: "set_bio", amount: 500, at: 4 },
            { kind: "external", name: "Partner quest", amount: 5000, at: 3 },
        ]);
    });

    test("show one seen twice once", () => {
        const twice = [
            event(1, { kind: "achievement_unlocked", type: "sent_text" }),
            event(1, { kind: "achievement_unlocked", type: "sent_text" }),
        ];
        expect(latestAchievements(twice, 4)).toHaveLength(1);
    });
});
