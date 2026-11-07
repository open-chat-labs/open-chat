import type { ChitState } from "@client";
import { describe, expect, test } from "vitest";
import type { ChitButtonInputs } from "./chitButton";
import { dailyClaim } from "./dailyClaim";

const NOW = 10 * 24 * 60 * 60 * 1000;
const MINUTE = 60_000;

function inputs(chit: Partial<ChitState> = {}, extra: Partial<ChitButtonInputs> = {}) {
    return {
        chit: {
            streak: 6,
            streakEnds: BigInt(NOW + 60 * MINUTE),
            maxStreak: 9,
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

describe("today's CHIT claim", () => {
    test("isn't known before the first sync", () => {
        expect(dailyClaim(inputs({}, { lastSync: 0 }))).toBeUndefined();
    });

    test("is offered while due, paying the next day of the streak", () => {
        const claim = dailyClaim(inputs());
        expect(claim).toMatchObject({ streak: 6, balance: 1500, earned: 4000, claimable: true });
        expect(claim?.countdown).toBe("");
    });

    test("once made, counts down to the next", () => {
        const claim = dailyClaim(inputs({ nextDailyChitClaim: BigInt(NOW + 60 * MINUTE) }));
        expect(claim?.claimable).toBe(false);
        expect(claim?.countdown).not.toBe("");
    });

    test("isn't offered while CHIT is off", () => {
        expect(dailyClaim(inputs({}, { disabled: true }))?.claimable).toBe(false);
    });

    test("a streak that has ended is none", () => {
        expect(dailyClaim(inputs({ streakEnds: BigInt(NOW - MINUTE) }))?.streak).toBe(0);
    });
});
