import type { ChitState } from "@client";
import { chitDialogProps, chitRailProps, type ChitInputs } from "./chit.adapter";

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

describe("the CHIT dialog's props", () => {
    test("a streak shows as 0 once streakEnds has passed, in the rail and ChitDialog", () => {
        const lapsed = inputs({ streakEnds: BigInt(NOW - 1) });
        expect(chitDialogProps(lapsed, noInsurance).streak).toBe(0);
        expect(chitRailProps(lapsed, false).chitStreak).toBe(0);
        expect(chitDialogProps(inputs(), noInsurance).streak).toBe(6);
        expect(chitRailProps(inputs(), false).chitStreak).toBe(6);
    });

    test("the claim is offered only when nextDailyChitClaim < now, the last sync is under 10 minutes old and disableChit is off", () => {
        const offered = (i: ChitInputs) => [
            chitDialogProps(i, noInsurance).claimable,
            chitRailProps(i, false).chitClaimable,
        ];
        expect(offered(inputs())).toEqual([true, true]);
        expect(offered(inputs({ nextDailyChitClaim: BigInt(NOW + MINUTE) }))).toEqual([
            false,
            false,
        ]);
        expect(offered(inputs({}, { lastSync: NOW - 11 * MINUTE }))).toEqual([false, false]);
        expect(offered(inputs({}, { disabled: true }))).toEqual([false, false]);
    });

    test("today's amount is what claiming pays now, or what today's claim paid", () => {
        // a 6-day streak: claiming makes it 7, which pays 400
        expect(chitDialogProps(inputs(), noInsurance).daily).toBe(400);
        // claimed today, at 7 days
        const claimed = inputs({ streak: 7, nextDailyChitClaim: BigInt(NOW + 60 * MINUTE) });
        expect(chitDialogProps(claimed, noInsurance).daily).toBe(400);
        // a lapsed streak starts again at 1
        expect(chitDialogProps(inputs({ streakEnds: BigInt(NOW - 1) }), noInsurance).daily).toBe(
            200,
        );
    });

    test("counts down to the next claim once today's is claimed", () => {
        const claimed = inputs({ nextDailyChitClaim: BigInt(NOW + 61 * MINUTE + 5000) });
        expect(chitDialogProps(claimed, noInsurance).countdown).toBe("01:01:05");
        expect(chitDialogProps(inputs(), noInsurance).countdown).toBe("");
    });

    test("insured days are the days bought and the days used", () => {
        const props = chitDialogProps(inputs(), { daysInsured: 5, daysMissed: 2 });
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
