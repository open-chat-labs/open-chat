import type { P2PSwapContent, P2PSwapStatus } from "@shared";
import { swapAcceptCost, swapActions, swapStatusWithLocal } from "./swaps";

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

describe("a swap's status with the one this client set", () => {
    const open: P2PSwapStatus = { kind: "p2p_swap_open" };
    const reserved: P2PSwapStatus = { kind: "p2p_swap_reserved", reservedBy: "me" };
    const accepted: P2PSwapStatus = {
        kind: "p2p_swap_accepted",
        acceptedBy: "me",
        token1TxnIn: 7n,
    };
    const completed: P2PSwapStatus = {
        kind: "p2p_swap_completed",
        acceptedBy: "me",
        token1TxnIn: 7n,
        token0TxnOut: 8n,
        token1TxnOut: 9n,
    };
    const cancelled: P2PSwapStatus = { kind: "p2p_swap_cancelled" };

    test("is the message's own when this client set none", () => {
        expect(swapStatusWithLocal(open, undefined)).toBe(open);
    });

    test("is the local one while the message hasn't caught up with the accept or cancel", () => {
        expect(swapStatusWithLocal(open, reserved)).toBe(reserved);
        expect(swapStatusWithLocal(open, accepted)).toBe(accepted);
        expect(swapStatusWithLocal(reserved, accepted)).toBe(accepted);
        expect(swapStatusWithLocal(open, cancelled)).toBe(cancelled);
    });

    test("is the message's once it has got as far, so a settled swap doesn't stay pending", () => {
        expect(swapStatusWithLocal(completed, accepted)).toBe(completed);
        expect(swapStatusWithLocal(accepted, reserved)).toBe(accepted);
        const theirs: P2PSwapStatus = { ...accepted, token1TxnIn: 11n };
        expect(swapStatusWithLocal(theirs, accepted)).toBe(theirs);
        expect(swapStatusWithLocal(cancelled, cancelled)).toBe(cancelled);
    });
});
