import { AuthProvider } from "./auth";
import type { GroupInvite } from "./inviteCodes";

export type AgentConfig = {
    authPrincipal: string;
    authProvider: AuthProvider | undefined;
    icUrl: string;
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
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    achievementUrlPath: string;
    proposalBotCanister: string;
    marketMakerCanister: string;
    signInWithEmailCanister: string;
    signInWithEthereumCanister: string;
    signInWithSolanaCanister: string;
    logger: {
        error(message?: unknown, ...optionalParams: unknown[]): void;
    };
    websiteVersion: string;
    rollbarApiKey: string;
    env: string;
    bitcoinMainnetEnabled: boolean;
    groupInvite?: GroupInvite;
};
