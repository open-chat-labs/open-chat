export type DfxInvocation = { command: string; args: string[] };
export type RunCommand = (command: string, args: string[]) => Promise<string>;

export type PublicKeyBuildOptions = {
    network?: string;
    canister?: string;
    outputPath?: string | URL;
    platform?: NodeJS.Platform;
    wslDistro?: string;
    dfxExecutable?: string;
    expectedDfxVersion?: string;
    runCommand?: RunCommand;
};

export declare function resolveDfxInvocation(
    network: string,
    platform?: NodeJS.Platform,
    wslDistro?: string,
    canister?: string,
    dfxExecutable?: string,
): DfxInvocation;
export declare function extractPublicKey(result: string): string;
export declare function writePublicKeyFile(options?: PublicKeyBuildOptions): Promise<void>;
export declare function publicKeyBuildPlugin(options?: PublicKeyBuildOptions): {
    name: string;
    buildStart(): Promise<void>;
};
