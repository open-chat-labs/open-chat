import type { ChannelIdentifier } from "../chat";
import type { CryptocurrencyDetails, NervousSystemSummary } from "../crypto";
import type { DexId } from "../dexes";

export type RegistryUpdatesResponse =
    | RegistryUpdatesResponseSuccess
    | RegistryUpdatesResponseSuccessNoUpdates;

export type AirdropChannelDetails = {
    id: ChannelIdentifier;
    channelName: string;
    communityName: string;
    url: string;
};

export type RegistryValue = {
    lastUpdated: bigint;
    tokenDetails: CryptocurrencyDetails[];
    nervousSystemSummary: NervousSystemSummary[];
    swapProviders: DexId[];
    messageFilters: MessageFilterSummary[];
    currentAirdropChannel: AirdropChannelDetails;
};

export type RegistryUpdatesResponseSuccess = {
    kind: "success";
    lastUpdated: bigint;
    tokenDetails: CryptocurrencyDetails[];
    nervousSystemSummary: NervousSystemSummary[];
    swapProviders: DexId[] | undefined;
    messageFiltersAdded: MessageFilterSummary[];
    messageFiltersRemoved: bigint[];
    currentAirdropChannel: AirdropChannelDetails;
};

export type RegistryUpdatesResponseSuccessNoUpdates = {
    kind: "success_no_updates";
};

export type MessageFilterSummary = {
    id: bigint;
    regex: string;
};
