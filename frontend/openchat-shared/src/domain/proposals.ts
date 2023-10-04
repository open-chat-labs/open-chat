import { Principal } from "@dfinity/principal";

export type CandidateProposal = {
    title: string;
    url: string | undefined;
    summary: string;
    action: CandidateProposalAction;
};

export type CandidateProposalAction = Motion | TransferSnsFunds;

export type Motion = {
    kind: "motion",
}

export type TransferSnsFunds = {
    kind: "transfer",
    treasury: Treasury,
    amount: bigint,
    to: Principal,
}

export type Treasury = ICP | SNS;

export type ICP = {
    kind: "ICP"
}

export type SNS = {
    kind: "SNS"
}