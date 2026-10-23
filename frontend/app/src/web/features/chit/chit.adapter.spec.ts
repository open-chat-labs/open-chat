import type { ChitState, StreakInsurance } from "@client";
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
