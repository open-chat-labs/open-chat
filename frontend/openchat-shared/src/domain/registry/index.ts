import type { CryptocurrencyDetails, NervousSystemSummary } from "../crypto";

export type RegistryUpdatesResponse =
    | RegistryUpdatesResponseSuccess
    | RegistryUpdatesResponseSuccessNoUpdates;

export type RegistryValue = {
    lastUpdated: bigint;
    tokenDetails: CryptocurrencyDetails[];
    nervousSystemSummary: NervousSystemSummary[];
};

export type RegistryUpdatesResponseSuccess = {
    kind: "success";
    lastUpdated: bigint;
    tokenDetails: CryptocurrencyDetails[];
    nervousSystemSummary: NervousSystemSummary[];
};

export type RegistryUpdatesResponseSuccessNoUpdates = {
    kind: "success_no_updates";
};
