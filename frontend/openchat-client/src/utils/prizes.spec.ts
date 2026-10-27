import type { PrizeContent } from "@shared";
import { isTrustedClick, prizeView, type PrizeReader } from "./prizes";

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
    requiresCaptcha: false,
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
    // 5a invariant 2 (the captcha half is prizeClaimStep's, app/src/logic/prize)
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
