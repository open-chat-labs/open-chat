import type { Logger } from "openchat-shared";

export type AgentConfig = {
    icUrl: string;
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
    ledgerCanisterKINIC: string;
    ledgerCanisterHOTORNOT: string;
    ledgerCanisterGHOST: string;
    userGeekApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    proposalBotCanister: string;
    marketMakerCanister: string;
    logger: Logger;
};
