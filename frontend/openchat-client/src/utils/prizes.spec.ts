import { ErrorCode, type PrizeContent } from "@shared";
import {
    claimPrizeFailedMessage,
    isTrustedClick,
    prizeView,
    prizeWithYourClaim,
    type PrizeReader,
} from "./prizes";

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

describe("a claim which didn't succeed", () => {
    const formatTime = (date: Date) => date.toISOString();

    test("says when you can claim again once you've reached the daily limit", () => {
        expect(
            claimPrizeFailedMessage(
                { kind: "error", code: ErrorCode.LimitReached, message: "1700000000000" },
                formatTime,
            ),
        ).toMatchObject({
            key: "prizes.claimLimitReached",
            params: { time: "2023-11-14T22:13:20.000Z" },
        });
    });

    test("says to try again in a moment while another of your claims is going through", () => {
        expect(
            claimPrizeFailedMessage(
                { kind: "error", code: ErrorCode.AlreadyInProgress, message: undefined },
                formatTime,
            ),
        ).toMatchObject({ key: "prizes.claimInProgress" });
    });

    test("says it was unsuccessful for any other reason", () => {
        for (const resp of [
            { kind: "failure" } as const,
            { kind: "offline" } as const,
            { kind: "error", code: ErrorCode.PrizeEnded, message: undefined } as const,
            { kind: "error", code: ErrorCode.LimitReached, message: undefined } as const,
        ]) {
            expect(claimPrizeFailedMessage(resp, formatTime)).toMatchObject({
                key: "prizes.claimFailed",
            });
        }
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
