import {
    i18nKey,
    type MakeProposalOutcome,
    type NervousSystemDetails,
    type ProposalExecutionPayment,
    type SubmitProposalResponse,
} from "@shared";

// 500 CHAT plus the transfer fee
export const TOKEN_LISTING_FEE = 50_000_100_000n;
// 1/5000th of a CHAT
export const CHAT_FEE_PER_CHIT_AWARD = 20_000n;
// The ProposalsBot pulls the proposal's fee as soon as it is submitted, but a token's listing fee or
// an achievement's CHAT is only pulled once the proposal is executed, after a vote of up to 6 days (4,
// extended by up to 2 if the result changes near the end)
export const PROPOSAL_EXECUTION_WINDOW = BigInt(1000 * 60 * 60 * 24 * 7);

// What the ProposalsBot is approved to take when the proposal is submitted
export function proposalFee({ proposalRejectionFee, token }: NervousSystemDetails): bigint {
    return proposalRejectionFee + 2n * token.transferFee;
}

// What the user needs in their wallet to submit a proposal, before any payment its execution takes
export function proposalFundsRequired({
    proposalRejectionFee,
    token,
}: NervousSystemDetails): bigint {
    return proposalRejectionFee + 3n * token.transferFee;
}

// What a proposal's execution takes once it passes
export function executionPaymentAmount(
    payment: ProposalExecutionPayment | undefined,
    transferFee: bigint,
): bigint {
    switch (payment?.kind) {
        case undefined:
            return 0n;
        case "token_listing":
            return TOKEN_LISTING_FEE;
        case "achievement":
            return (
                BigInt(payment.chitReward * payment.maxAwards) * CHAT_FEE_PER_CHIT_AWARD +
                transferFee
            );
    }
}

export function proposalFailed(): MakeProposalOutcome {
    return { kind: "failed", message: i18nKey("proposal.maker.unexpectedError") };
}

export function submitProposalResult(resp: SubmitProposalResponse): MakeProposalOutcome {
    switch (resp.kind) {
        case "success":
        case "retrying":
            return { kind: "submitted" };
        case "user_suspended":
        case "governance_canister_not_supported":
        case "insufficient_payment":
        case "transfer_failed":
        case "internal_error":
        case "offline":
            return proposalFailed();
        default:
            return resp satisfies never;
    }
}
