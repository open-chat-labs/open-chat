import {
    i18nKey,
    walletApprovalFee,
    type P2PSwapContent,
    type P2PSwapStatus,
    type ResourceKey,
} from "@shared";

/** Who has taken a swap offer: who reserved it, or who accepted it. */
export function swapTakenBy(status: P2PSwapStatus): string | undefined {
    switch (status.kind) {
        case "p2p_swap_reserved":
            return status.reservedBy;
        case "p2p_swap_accepted":
        case "p2p_swap_completed":
            return status.acceptedBy;
    }
}

/**
 * A swap offer's labels as the mobile app words them: its button and its header. An open offer's
 * header is its time left, which the caller words (`headerLabelKey` is undefined then). Someone
 * else's progress on an offer that's neither the reader's nor taken by them is "not available".
 */
export function swapLabels(
    content: P2PSwapContent,
    reader: { me: string; mine: boolean },
): {
    takenBy: string | undefined;
    takenByYou: boolean;
    buttonLabelKey: string;
    headerLabelKey: string | undefined;
} {
    const takenBy = swapTakenBy(content.status);
    const takenByYou = takenBy === reader.me;
    const ifYours = (key: string) => (takenByYou || reader.mine ? key : "p2pSwap.notAvailable");
    switch (content.status.kind) {
        case "p2p_swap_open":
            return {
                takenBy,
                takenByYou,
                buttonLabelKey: reader.mine ? "p2pSwap.cancel" : "p2pSwap.accept",
                headerLabelKey: undefined,
            };
        case "p2p_swap_cancelled":
            return {
                takenBy,
                takenByYou,
                buttonLabelKey: "p2pSwap.cancelled",
                headerLabelKey: "p2pSwap.cancelled",
            };
        case "p2p_swap_expired":
            return {
                takenBy,
                takenByYou,
                buttonLabelKey: "p2pSwap.expired",
                headerLabelKey: "p2pSwap.expired",
            };
        case "p2p_swap_reserved":
            return {
                takenBy,
                takenByYou,
                buttonLabelKey: ifYours("p2pSwap.progress.pendingCompletion"),
                headerLabelKey: takenByYou ? "p2pSwap.reserved" : "p2pSwap.progress.acceptedBy",
            };
        case "p2p_swap_accepted":
            return {
                takenBy,
                takenByYou,
                buttonLabelKey: ifYours("p2pSwap.progress.pendingCompletion"),
                headerLabelKey: takenByYou ? "p2pSwap.accepted" : "p2pSwap.progress.acceptedBy",
            };
        case "p2p_swap_completed":
            return {
                takenBy,
                takenByYou,
                buttonLabelKey: ifYours("p2pSwap.progress.success"),
                headerLabelKey: takenByYou
                    ? "p2pSwap.progress.completed"
                    : takenBy
                      ? "p2pSwap.progress.acceptedBy"
                      : "p2pSwap.accepted",
            };
    }
}

/**
 * What the reader may do with a swap offer: its sender may cancel it, anyone else may accept it,
 * and only while it's open and hasn't run out (`now` in ms).
 */
export function swapActions(
    content: P2PSwapContent,
    reader: { mine: boolean; now: number },
): { canAccept: boolean; canCancel: boolean } {
    const open = content.status.kind === "p2p_swap_open" && reader.now < Number(content.expiresAt);
    return { canAccept: open && !reader.mine, canCancel: open && reader.mine };
}

/**
 * What accepting a swap offer takes from the reader's wallet: the amount asked, plus two fees (the
 * deposit into escrow and paying it out) and the approval fee. The amount and fee are the message's
 * own token1's: the canister charges from them.
 */
export function swapAcceptCost(amount: bigint, fee: bigint): { fees: bigint; total: bigint } {
    const fees = 2n * fee + walletApprovalFee(fee);
    return { fees, total: amount + fees };
}

/**
 * A failed accept or cancel, as a toast says it. The responses carry only a generic error, so it
 * can't say more than which one failed.
 */
export function swapFailureMessage(accepting: boolean): ResourceKey {
    return i18nKey(accepting ? "p2pSwap.unknown_accept_error" : "p2pSwap.unknown_cancel_error");
}
