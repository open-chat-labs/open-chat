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
    kind: "transfer_sns_funds",
    treasury: Treasury,
    amount: bigint,
    recipient: Icrc1Account;
}

export type Icrc1Account = {
    owner: string,
    subaccount: string | undefined,
}
  
export type Treasury = "SNS" | "ICP";
