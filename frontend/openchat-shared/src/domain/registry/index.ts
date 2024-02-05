import type { CryptocurrencyDetails, NervousSystemSummary } from "../crypto";

export type RegistryUpdatesResponse =
    | RegistryUpdatesResponseSuccess
    | RegistryUpdatesResponseSuccessNoUpdates;

export type RegistryValue = {
    lastUpdated: bigint;
    tokenDetails: CryptocurrencyDetails[];
    nervousSystemSummary: NervousSystemSummary[];
    messageFilters: MessageFilterSummary[];
};

export type RegistryUpdatesResponseSuccess = {
    kind: "success";
    lastUpdated: bigint;
    tokenDetails: CryptocurrencyDetails[];
    nervousSystemSummary: NervousSystemSummary[];
    messageFiltersAdded: MessageFilterSummary[];
    messageFiltersRemoved: bigint[];
};

export type RegistryUpdatesResponseSuccessNoUpdates = {
    kind: "success_no_updates";
};

export type MessageFilterSummary = {
    id: bigint;
    regex: string;
};