import { walletApprovalFee, type ChatIdentifier } from "@shared";
import {
    generatePrizes,
    newPrizeContent,
    prizeCosts,
    prizeMaximum,
    prizeRecipient,
    validPrizeWinners,
    type NewPrize,
} from "./prizeBuilder";

const fee = 10_000n;
const group: ChatIdentifier = { kind: "group_chat", groupId: "g" };

// a seeded generator, so the random split is the same each run
function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
}

const prize: NewPrize = {
    chatId: group,
    ledger: "ledger",
    symbol: "ICP",
    transferFee: fee,
    amount: 123_456_789n,
    winners: 20,
    distribution: "random",
    durationMs: 86_400_000,
    diamond: "none",
    minStreak: 0,
    minChitEarned: 0,
};

describe("a prize", () => {
    // 5d invariant 1
    test("a prize's prizes add up exactly to its fund, none is below the transfer fee, and its fees include OpenChat's 5%, the approval fee and one transfer fee per winner", () => {
        for (const distribution of ["random", "equal"] as const) {
            for (const [amount, winners] of [
                [123_456_789n, 20],
                [100n * 7n * fee, 7],
                [987_654_321_000n, 1000],
                [1_000_000n, 1],
            ] as const) {
                const content = newPrizeContent(
                    { ...prize, amount, winners, distribution },
                    0,
                    seeded(winners),
                );
                const prizes = content?.prizes ?? [];
                expect(prizes).toHaveLength(winners);
                expect(prizes.reduce((a, p) => a + p, 0n)).toBe(amount);
                expect(prizes.every((p) => p >= fee)).toBe(true);
                const prizeFees = fee * BigInt(winners) + (amount * 5n) / 100n;
                expect(content?.fees).toBe(fee + walletApprovalFee(fee) + prizeFees);
                // the fund's transfer pays for the prizes and the prize's fees
                expect(content?.transfer.kind === "pending" && content.transfer.amountE8s).toBe(
                    amount + prizeFees,
                );
            }
        }
    });

    test("a random split's prizes below the transfer fee are made up from the biggest", () => {
        // one draw at the bottom of the range, the rest at the top: scaled, the small one falls
        // below the fee
        let first = true;
        const draws = () => {
            const draw = first ? 0 : 0.999;
            first = false;
            return draw;
        };
        // shares of 10 fees, so the smallest draw is a fee, which scaling takes below it
        const prizes = generatePrizes(30n * fee, 3, "random", fee, draws);
        expect(prizes[0]).toBe(fee);
        expect(prizes.every((p) => p >= fee)).toBe(true);
        expect(prizes.reduce((a, p) => a + p, 0n)).toBe(30n * fee);
    });

    test("an equal split gives any rounding to the first prize", () => {
        expect(generatePrizes(1_000_001n, 4, "equal", 1n)).toEqual([
            250_001n,
            250_000n,
            250_000n,
            250_000n,
        ]);
    });

    test("is at least 100 transfer fees a winner, and at most the balance less what it costs", () => {
        expect(prizeCosts(0n, 20, fee).minAmount).toBe(20_000_000n);
        const balance = 1_000_000_000n;
        const max = prizeMaximum(balance, 500_000_000n, 20, fee);
        expect(max).toBe(balance - prizeCosts(500_000_000n, 20, fee).totalFees);
        expect(prizeMaximum(0n, 500_000_000n, 20, fee)).toBe(0n);
    });

    test("has 1 to 1000 winners", () => {
        expect(validPrizeWinners(0)).toBe(false);
        expect(validPrizeWinners(1)).toBe(true);
        expect(validPrizeWinners(1000)).toBe(true);
        expect(validPrizeWinners(1001)).toBe(false);
        expect(validPrizeWinners(2.5)).toBe(false);
        expect(validPrizeWinners(undefined)).toBe(false);
    });

    test("is paid to its group or community, and never made in a DM", () => {
        expect(prizeRecipient(group)).toBe("g");
        expect(prizeRecipient({ kind: "channel", communityId: "c", channelId: 1 })).toBe("c");
        const dm: ChatIdentifier = { kind: "direct_chat", userId: "bob" };
        expect(prizeRecipient(dm)).toBeUndefined();
        expect(newPrizeContent({ ...prize, chatId: dm }, 0)).toBeUndefined();
    });

    test("ends its duration from when it's made, with its restrictions; never unique-person gated", () => {
        const content = newPrizeContent(
            { ...prize, diamond: "lifetime", minStreak: 7, minChitEarned: 5000 },
            1000,
        );
        expect(content).toMatchObject({
            endDate: 86_401_000n,
            diamondOnly: false,
            lifetimeDiamondOnly: true,
            uniquePersonOnly: false,
            streakOnly: 7,
            minChitEarned: 5000,
            amount: 123_456_789n,
        });
        expect(newPrizeContent({ ...prize, diamond: "standard" }, 0)?.diamondOnly).toBe(true);
    });

    // 5d invariant 4, for a prize
    test("from an external wallet carries the wallet, for the send to ask", () => {
        const content = newPrizeContent({ ...prize, from: { fromWallet: "plug" } }, 0);
        expect(content?.transfer).toMatchObject({ fromWallet: "plug" });
        expect(content?.transfer.kind === "pending" && content.transfer.fromAccount).toBe(
            undefined,
        );
    });
});
