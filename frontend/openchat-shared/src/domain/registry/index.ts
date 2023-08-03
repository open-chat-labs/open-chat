export type RegistryUpdatesResponse = RegistryUpdatesResponseSuccess | RegistryUpdatesResponseSuccessNoUpdates;

export type RegistryValue = {
    lastUpdated: bigint;
    tokenDetails: TokenDetails[],
}

export type RegistryUpdatesResponseSuccess = {
    kind: "success";
    lastUpdated: bigint;
    tokenDetails?: TokenDetails[];
}

export type RegistryUpdatesResponseSuccessNoUpdates = {
    kind: "success_no_updates";
}

export type TokenDetails = {
    ledgerCanisterId: string;
    name: string;
    symbol: string;
    decimals: number;
    fee: bigint;
    logo: string;
    snsCanisters?: {
        root: string
        governance: string
    };
    infoUrl: string;
    howToBuyUrl: string;
    transactionUrlFormat: string;
    added: bigint;
    lastUpdated: bigint;
}
