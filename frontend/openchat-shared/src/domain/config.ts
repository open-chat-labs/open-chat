export type AgentConfig = {
    icUrl: string;
    iiDerivationOrigin?: string;
    openStorageIndexCanister: string;
    groupIndexCanister: string;
    notificationsCanister: string;
    onlineCanister: string;
    userIndexCanister: string;
    translationsCanister: string;
    registryCanister: string;
    internetIdentityUrl: string;
    nfidUrl: string;
    userGeekApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    proposalBotCanister: string;
    marketMakerCanister: string;
    logger: {
        error(message?: unknown, ...optionalParams: unknown[]): void;
    };
    websiteVersion: string;
    rollbarApiKey: string;
    env: string;
};
