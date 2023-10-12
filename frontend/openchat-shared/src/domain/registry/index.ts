export type RegistryUpdatesResponse =
    | RegistryUpdatesResponseSuccess
    | RegistryUpdatesResponseSuccessNoUpdates;

export type RegistryValue = {
    lastUpdated: bigint;
    tokenDetails: TokenDetails[];
    nervousSystemDetails: NervousSystemSummary[];
};

export type RegistryUpdatesResponseSuccess = {
    kind: "success";
    lastUpdated: bigint;
    tokenDetails: TokenDetails[];
    nervousSystemDetails: NervousSystemSummary[];
};

export type RegistryUpdatesResponseSuccessNoUpdates = {
    kind: "success_no_updates";
};

export type TokenDetails = {
    ledgerCanisterId: string;
    name: string;
    symbol: string;
    decimals: number;
    fee: bigint;
    logo: string;
    nervousSystem?: {
        root: string;
        governance: string;
    };
    infoUrl: string;
    howToBuyUrl: string;
    transactionUrlFormat: string;
    added: bigint;
    lastUpdated: bigint;
};

export type NervousSystemSummary = {
    rootCanisterId: string;
    governanceCanisterId: string;
    ledgerCanisterId: string;
    isNns: boolean;
    proposalRejectionFee: bigint;
    submittingProposalsEnabled: boolean;
};
