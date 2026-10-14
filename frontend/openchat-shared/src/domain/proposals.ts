import type { ResourceKey } from "../utils/i18n";

export type CandidateProposal = {
    title: string;
    url: string | undefined;
    summary: string;
    action: CandidateProposalAction;
};

/**
 * A payment a proposal's execution takes once it passes, on top of the fee for submitting it: the
 * listing fee for adding a token, or the CHAT that pays for an achievement's CHIT awards
 */
export type ProposalExecutionPayment =
    | { kind: "token_listing" }
    | { kind: "achievement"; chitReward: number; maxAwards: number };

export type MakeProposalOutcome =
    | { kind: "submitted" }
    | { kind: "cancelled" }
    | { kind: "failed"; message: ResourceKey };

export type CandidateProposalAction =
    | Motion
    | TransferSnsFunds
    | AdvanceSnsTargetVersion
    | ExecuteGenericNervousSystemFunction;

export type Motion = {
    kind: "motion";
};

export type TransferSnsFunds = {
    kind: "transfer_sns_funds";
    treasury: Treasury;
    amount: bigint;
    recipient: Icrc1Account;
};

export type Icrc1Account = {
    owner: string;
    subaccount: string | undefined;
};

export type Treasury = "SNS" | "ICP";

export type AdvanceSnsTargetVersion = {
    kind: "advance_sns_target_version";
};

export type ExecuteGenericNervousSystemFunction = {
    kind: "execute_generic_nervous_system_function";
    functionId: bigint;
    payload: Uint8Array;
};
