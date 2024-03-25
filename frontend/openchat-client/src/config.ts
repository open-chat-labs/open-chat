import type { Logger } from "openchat-shared";
import type { MessageFormatter } from "./utils/i18n";
import type { GroupInvite } from "openchat-shared";

export type OpenChatConfig = {
    icUrl?: string;
    iiDerivationOrigin?: string;
    openStorageIndexCanister: string;
    groupIndexCanister: string;
    notificationsCanister: string;
    identityCanister: string;
    onlineCanister: string;
    userIndexCanister: string;
    translationsCanister: string;
    registryCanister: string;
    internetIdentityUrl: string;
    nfidUrl: string;
    userGeekApiKey: string;
    videoBridgeUrl: string;
    meteredApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    proposalBotCanister: string;
    marketMakerCanister: string;
    i18nFormatter: MessageFormatter;
    logger: Logger;
    websiteVersion: string;
    rollbarApiKey: string;
    env: string;
    groupInvite?: GroupInvite,
};
