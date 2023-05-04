import type { MessageFormatter } from "./utils/i18n";

export type OpenChatConfig = {
    icUrl?: string;
    iiDerivationOrigin?: string;
    openStorageIndexCanister: string;
    groupIndexCanister: string;
    notificationsCanister: string;
    onlineCanister: string;
    userIndexCanister: string;
    internetIdentityUrl: string;
    nfidUrl: string;
    ledgerCanisterICP: string;
    ledgerCanisterSNS1: string;
    ledgerCanisterBTC: string;
    ledgerCanisterCHAT: string;
    userGeekApiKey: string;
    meteredApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    proposalBotCanister: string;
    marketMakerCanister: string;
    i18nFormatter: MessageFormatter;
    logger: {
        error(message?: unknown, ...optionalParams: unknown[]): void;
    };
    websiteVersion: string;
};
