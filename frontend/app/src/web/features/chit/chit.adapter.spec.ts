import { achievementList, achievements, type ChitState, type StreakInsurance } from "@client";
import {
    achievementItems,
    achievementsCount,
    chitDialogProps,
    chitRailProps,
    leaderboardBoards,
    type ChitInputs,
} from "./chit.adapter";

const NOW = 10 * 24 * 60 * 60 * 1000;
const MINUTE = 60_000;

function inputs(chit: Partial<ChitState> = {}, extra: Partial<ChitInputs> = {}): ChitInputs {
    return {
        chit: {
            streak: 6,
            streakEnds: BigInt(NOW + 60 * MINUTE),
            maxStreak: 9,
            // today's claim is open
            nextDailyChitClaim: BigInt(NOW - MINUTE),
            chitBalance: 1500,
            totalChitEarned: 4000,
            ...chit,
        },
        lastSync: NOW - MINUTE,
        disabled: false,
        now: NOW,
        ...extra,
    };
}

const noInsurance = { daysInsured: 0, daysMissed: 0 };

// the dialog's props once the user's CHIT is known (after the first sync)
function known(i: ChitInputs, insurance: StreakInsurance) {
    const props = chitDialogProps(i, insurance);
    if (props === undefined) throw new Error("not known");
    return props;
}

describe("the CHIT dialog's props", () => {
    test("are unknown till the first sync, rather than a placeholder that offers a claim", () => {
        expect(chitDialogProps(inputs({}, { lastSync: 0 }), noInsurance)).toBeUndefined();
    });

    test("a streak shows as 0 once streakEnds has passed, in the rail and ChitDialog", () => {
        const lapsed = inputs({ streakEnds: BigInt(NOW - 1) });
        expect(known(lapsed, noInsurance).streak).toBe(0);
        expect(chitRailProps(lapsed, false).chitStreak).toBe(0);
        expect(known(inputs(), noInsurance).streak).toBe(6);
        expect(chitRailProps(inputs(), false).chitStreak).toBe(6);
    });

    test("the claim is offered only when nextDailyChitClaim < now, the last sync is under 10 minutes old and disableChit is off", () => {
        // the rail, as the old desktop rail offers it
        const offered = (i: ChitInputs) => chitRailProps(i, false).chitClaimable;
        expect(offered(inputs())).toBe(true);
        expect(offered(inputs({ nextDailyChitClaim: BigInt(NOW + MINUTE) }))).toBe(false);
        expect(offered(inputs({}, { lastSync: NOW - 11 * MINUTE }))).toBe(false);
        expect(offered(inputs({}, { disabled: true }))).toBe(false);
    });

    test("the dialog offers the claim whenever it's due and CHIT is on, however old the last sync, as the old CHIT modal does", () => {
        const offered = (i: ChitInputs) => known(i, noInsurance).claimable;
        expect(offered(inputs({}, { lastSync: NOW - 60 * MINUTE }))).toBe(true);
        expect(offered(inputs({ nextDailyChitClaim: BigInt(NOW + MINUTE) }))).toBe(false);
        expect(offered(inputs({}, { disabled: true }))).toBe(false);
    });

    test("today's amount is what claiming pays now, or what today's claim paid", () => {
        // a 6-day streak: claiming makes it 7, which pays 400
        expect(known(inputs(), noInsurance).daily).toBe(400);
        // claimed today, at 7 days
        const claimed = inputs({ streak: 7, nextDailyChitClaim: BigInt(NOW + 60 * MINUTE) });
        expect(known(claimed, noInsurance).daily).toBe(400);
        // a lapsed streak starts again at 1
        expect(known(inputs({ streakEnds: BigInt(NOW - 1) }), noInsurance).daily).toBe(200);
        // due, though not offered (CHIT off): still what claiming would pay
        expect(known(inputs({}, { disabled: true }), noInsurance).daily).toBe(400);
    });

    test("counts down to the next claim once today's is claimed", () => {
        const claimed = inputs({ nextDailyChitClaim: BigInt(NOW + 61 * MINUTE + 5000) });
        expect(known(claimed, noInsurance).countdown).toBe("01:01:05");
        expect(known(inputs(), noInsurance).countdown).toBe("");
        // due though not offered: nothing to count down to, never a negative time
        expect(known(inputs({}, { disabled: true }), noInsurance).countdown).toBe("");
    });

    test("insured days are the days bought and the days used", () => {
        const props = known(inputs(), { daysInsured: 5, daysMissed: 2 });
        expect([props.insured, props.used]).toEqual([5, 2]);
    });
});

describe("the rail's CHIT button", () => {
    test("is hidden while CHIT is off, and once claimed when the user hides it then", () => {
        const claimed = inputs({ nextDailyChitClaim: BigInt(NOW + MINUTE) });
        expect(chitRailProps(inputs(), true).chitShown).toBe(true);
        expect(chitRailProps(claimed, true).chitShown).toBe(false);
        expect(chitRailProps(claimed, false).chitShown).toBe(true);
        expect(chitRailProps(inputs({}, { disabled: true }), false).chitShown).toBe(false);
    });
});

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

describe("the leaderboard's boards", () => {
    // 2026-03-01, 00:30 UTC: still March in UTC, whatever the local date
    const MARCH = Date.UTC(2026, 2, 1, 0, 30);
    const balances = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
            userId: `u${i}`,
            username: `user${i}`,
            balance: 1000 - i,
        }));

    test("are this month's, last month's and all time's top 10, months in UTC", () => {
        const boards = leaderboardBoards(
            { thisMonth: balances(12), lastMonth: balances(3), allTime: [] },
            "nobody",
            MARCH,
            "en",
            "All time",
        );
        expect(Object.keys(boards)).toEqual(["thisMonth", "lastMonth", "allTime"]);
        expect([boards.thisMonth.label, boards.lastMonth.label, boards.allTime.label]).toEqual([
            "March",
            "February",
            "All time",
        ]);
        expect(boards.thisMonth.rows).toHaveLength(10);
        expect(boards.thisMonth.rows[0]).toEqual(["user0", 1000]);
        expect(boards.thisMonth.you).toBeUndefined();
    });

    test("show the user's place on a board they're on", () => {
        const boards = leaderboardBoards(
            { thisMonth: balances(5), lastMonth: [], allTime: [] },
            "u3",
            MARCH,
            "en",
            "All time",
        );
        expect(boards.thisMonth.you).toEqual({ rank: 4, score: 997 });
    });

    test("are there, empty, before the leaderboard loads", () => {
        const boards = leaderboardBoards(undefined, "u1", MARCH, "en", "All time");
        expect(boards.allTime.rows).toEqual([]);
    });
});
