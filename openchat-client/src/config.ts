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
    enableClientCaching: boolean;
    ledgerCanisterICP: string;
    ledgerCanisterBTC: string;
    ledgerCanisterCHAT: string;
    userGeekApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    proposalBotCanister: string;
    i18nFormatter: MessageFormatter;
};
