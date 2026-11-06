import type { ChitState } from "@client";
import { describe, expect, test } from "vitest";
import { chitButton, type ChitButtonInputs } from "./chitButton";

const NOW = 10 * 24 * 60 * 60 * 1000;
const MINUTE = 60_000;

function inputs(next: number, extra: Partial<ChitButtonInputs> = {}): ChitButtonInputs {
    const chit: ChitState = {
        streak: 6,
        streakEnds: BigInt(NOW + 60 * MINUTE),
        maxStreak: 9,
        nextDailyChitClaim: BigInt(next),
        chitBalance: 1500,
        totalChitEarned: 4000,
    };
    return { chit, lastSync: NOW - MINUTE, disabled: false, now: NOW, ...extra };
}

describe("the CHIT button", () => {
    test("offers today's claim (the dot) while it's due and the last sync is recent", () => {
        expect(chitButton(inputs(NOW - MINUTE), false).claimable).toBe(true);
        expect(chitButton(inputs(NOW + MINUTE), false).claimable).toBe(false);
        // CHIT that hasn't synced lately might offer a claim the backend turns down
        expect(chitButton(inputs(NOW - MINUTE, { lastSync: 0 }), false).claimable).toBe(false);
    });

    test("once claimed, goes if the user hides it then; never shows while CHIT is off", () => {
        expect(chitButton(inputs(NOW + MINUTE), true).shown).toBe(false);
        expect(chitButton(inputs(NOW + MINUTE), false).shown).toBe(true);
        expect(chitButton(inputs(NOW - MINUTE), true).shown).toBe(true);
        expect(chitButton(inputs(NOW - MINUTE, { disabled: true }), false)).toMatchObject({
            shown: false,
            claimable: false,
        });
    });
});
