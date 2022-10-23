export type AgentConfig = {
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
    logger: {
        error(message?: unknown, ...optionalParams: unknown[]): void;
    };
};
