import type { P2PSwapContent } from "@shared";
import { swapAcceptCost, swapActions } from "./swaps";

const token = (symbol: string, fee: bigint) => ({
    symbol,
    ledger: symbol.toLowerCase(),
    decimals: 8,
    fee,
});

function swap(status: P2PSwapContent["status"] = { kind: "p2p_swap_open" }): P2PSwapContent {
    return {
        kind: "p2p_swap_content",
        token0: token("CHAT", 100_000n),
        token1: token("ICP", 10_000n),
        token0Amount: 5_000_000_000n,
        token1Amount: 100_000_000n,
        expiresAt: 1000n,
        status,
        swapId: 1,
        token0TxnIn: 1n,
    } as P2PSwapContent;
}

describe("a swap offer", () => {
    test("can be cancelled by its sender and accepted by anyone else, only while open and not read-only", () => {
        expect(swapActions(swap(), { mine: true, now: 0, readonly: false })).toEqual({
            canAccept: false,
            canCancel: true,
        });
        expect(swapActions(swap(), { mine: false, now: 0, readonly: false })).toEqual({
            canAccept: true,
            canCancel: false,
        });
        expect(swapActions(swap(), { mine: false, now: 1000, readonly: false }).canAccept).toBe(
            false,
        );
        expect(swapActions(swap(), { mine: true, now: 1000, readonly: false }).canCancel).toBe(
            false,
        );
        expect(swapActions(swap(), { mine: false, now: 0, readonly: true }).canAccept).toBe(false);
        expect(
            swapActions(swap({ kind: "p2p_swap_reserved", reservedBy: "bob" }), {
                mine: false,
                now: 0,
                readonly: false,
            }).canAccept,
        ).toBe(false);
    });

    test("costs its amount plus the two deposit fees and the approval fee to accept", () => {
        expect(swapAcceptCost(100_000_000n, 10_000n)).toEqual({
            fees: 30_000n,
            total: 100_030_000n,
        });
    });
});
