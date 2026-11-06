import type { AttachmentContent } from "@shared";

/**
 * A draft's payment from an external wallet, still to be approved by that wallet: `amount` plus
 * `fees` is what the ledger will charge against the allowance, and `approved` absorbs the account
 * the wallet approved into the content, which is then sent paying from it.
 */
export type ExternalWalletPayment = {
    /** The wallet to ask, by its `SignerWallet` id. */
    fromWallet: string;
    ledger: string;
    amount: bigint;
    /** None: a single transfer's fee (the ledger's). */
    fees: bigint | undefined;
    approved: (fromAccount: string) => AttachmentContent;
};

/**
 * What a draft's attached transfer, prize or swap offer still needs from an external wallet
 * before it's sent; none for one paid from the user's OpenChat account, or already approved.
 *
 * A builder never asks a wallet for its approval: it would spend a tap on an allowance the user
 * may abandon without sending. The draft carries the wallet as `fromWallet`, and the send asks for
 * the approval, from the tap that consumes it.
 */
export function externalWalletPayment(
    draft: AttachmentContent | undefined,
): ExternalWalletPayment | undefined {
    switch (draft?.kind) {
        case "crypto_content":
        case "prize_content_initial": {
            const transfer = draft.transfer;
            if (transfer.kind !== "pending" || transfer.fromAccount !== undefined) return undefined;
            if (transfer.fromWallet === undefined) return undefined;
            return {
                fromWallet: transfer.fromWallet,
                ledger: transfer.ledger,
                amount: transfer.amountE8s,
                fees: transfer.feeE8s,
                approved: (fromAccount) => ({
                    ...draft,
                    transfer: { ...transfer, fromWallet: undefined, fromAccount },
                }),
            };
        }
        case "p2p_swap_content_initial": {
            if (draft.fromAccount !== undefined || draft.fromWallet === undefined) return undefined;
            return {
                fromWallet: draft.fromWallet,
                ledger: draft.token0.ledger,
                amount: draft.token0Amount,
                // The escrowed amount funds the swap's outbound transfer as well, so the ledger
                // charges the offer's amount plus two fees against the allowance
                fees: draft.token0.fee * 2n,
                approved: (fromAccount) => ({ ...draft, fromWallet: undefined, fromAccount }),
            };
        }
        default:
            return undefined;
    }
}
