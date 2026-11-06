import { ONE_DAY, type TokenInfo } from "@shared";
import {
    newSwapOfferContent,
    swapOfferConfirmation,
    swapOfferCosts,
    swapOfferExpiry,
    swapOfferMaximum,
    swapOfferStep,
    type NewSwapOffer,
} from "./swapOffer";

const icp: TokenInfo = { ledger: "icp", symbol: "ICP", fee: 10_000n, decimals: 8 };
const chat: TokenInfo = { ledger: "chat", symbol: "CHAT", fee: 100_000n, decimals: 8 };

const offer: NewSwapOffer = {
    token0: icp,
    token1: chat,
    amount0: 100_000_000n,
    amount1: 5_000_000_000n,
    expiresInMs: ONE_DAY,
};

describe("a swap offer", () => {
    // 5d invariant 2
    test("a swap offer's deposit fees are two transfer fees plus the approval fee, and its expiry is never past 90 days", () => {
        expect(swapOfferCosts(10_000n)).toEqual({
            depositFees: 20_000n,
            approvalFee: 10_000n,
            totalFees: 30_000n,
            minAmount: 100_000n,
        });
        expect(newSwapOfferContent({ ...offer, expiresInMs: 365 * ONE_DAY })?.expiresIn).toBe(
            BigInt(90 * ONE_DAY),
        );
        expect(swapOfferExpiry(90 * ONE_DAY)).toBe(BigInt(90 * ONE_DAY));
        expect(swapOfferExpiry(ONE_DAY)).toBe(BigInt(ONE_DAY));
    });

    test("offers at most the balance less its fees", () => {
        expect(swapOfferMaximum(1_000_000n, 10_000n)).toBe(970_000n);
        expect(swapOfferMaximum(20_000n, 10_000n)).toBe(0n);
    });

    test("is only made by a Diamond member, and confirmed once it's valid", () => {
        expect(swapOfferStep(false, true)).toBe("upgrade");
        expect(swapOfferStep(true, false)).toBe("invalid");
        expect(swapOfferStep(true, true)).toBe("confirm");
    });

    test("is confirmed with what it takes from the wallet, fees and all", () => {
        expect(swapOfferConfirmation(100_000_000n, icp)).toMatchObject({
            key: "p2pSwap.confirmSend",
            params: { amount: "1.0003", token: "ICP", fees: 3 },
        });
    });

    test("swaps two different tokens", () => {
        expect(newSwapOfferContent({ ...offer, token1: icp })).toBeUndefined();
        expect(newSwapOfferContent(offer)).toEqual({
            kind: "p2p_swap_content_initial",
            token0: icp,
            token1: chat,
            token0Amount: 100_000_000n,
            token1Amount: 5_000_000_000n,
            caption: undefined,
            expiresIn: BigInt(ONE_DAY),
        });
    });

    // 5d invariant 4, for a swap offer
    test("from an external wallet carries the wallet, for the send to ask", () => {
        const content = newSwapOfferContent({ ...offer, from: { fromWallet: "plug" } });
        expect(content?.fromWallet).toBe("plug");
        expect(content?.fromAccount).toBeUndefined();
    });
});
