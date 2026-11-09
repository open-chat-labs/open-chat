import type { PrizeContent } from "@shared";
import { isTrustedClick, prizeView, prizeWithYourClaim, type PrizeReader } from "./prizes";

const prize: PrizeContent = {
    kind: "prize_content",
    prizesRemaining: 2,
    prizesPending: 0,
    diamondOnly: false,
    lifetimeDiamondOnly: false,
    uniquePersonOnly: false,
    streakOnly: 0,
    winnerCount: 1,
    userIsWinner: false,
    token: "ICP",
    ledger: "icp",
    endDate: 1000n,
    minChitEarned: 0,
};

const reader: PrizeReader = {
    mine: false,
    direct: false,
    previewingOrLapsed: false,
    now: 0,
    diamond: false,
    lifetimeDiamond: false,
    streak: 0,
    chitEarned: 0,
};

describe("claiming a prize", () => {
    // 5a invariant 2
    test("a prize claim is sent only from a trusted click", () => {
        // a script's click is never trusted
        expect(isTrustedClick(new MouseEvent("click"))).toBe(false);
    });

    test("is offered only to an eligible reader who didn't send it, outside a DM, while it's open", () => {
        expect(prizeView(prize, reader).canClaim).toBe(true);
        expect(prizeView(prize, { ...reader, mine: true }).canClaim).toBe(false);
        expect(prizeView(prize, { ...reader, direct: true }).canClaim).toBe(false);
        expect(prizeView(prize, { ...reader, now: 1000 }).canClaim).toBe(false);
        expect(prizeView({ ...prize, prizesRemaining: 0 }, reader).canClaim).toBe(false);
        expect(prizeView({ ...prize, streakOnly: 3 }, { ...reader, streak: 2 })).toMatchObject({
            canClaim: false,
            gates: [{ met: false }],
        });
    });
});

describe("a prize once your claim has succeeded", () => {
    test("counts you as a winner and takes one of the remaining prizes, keeping the total", () => {
        expect(prizeWithYourClaim(prize)).toMatchObject({
            userIsWinner: true,
            winnerCount: 2,
            prizesRemaining: 1,
            prizesPending: 0,
        });
    });

    test("takes it from the pending ones when some were pending", () => {
        expect(prizeWithYourClaim({ ...prize, prizesPending: 1 })).toMatchObject({
            userIsWinner: true,
            winnerCount: 2,
            prizesRemaining: 2,
            prizesPending: 0,
        });
    });

    test("is the message's own once that counts you as a winner", () => {
        const won = { ...prize, userIsWinner: true, winnerCount: 2, prizesRemaining: 1 };
        expect(prizeWithYourClaim(won)).toBe(won);
    });
});
