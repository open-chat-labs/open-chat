import type { WalletConfig } from "@shared";

/**
 * A copy of `config` that a settings form can edit without touching the original. The `tokens` Set
 * isn't proxied by `$state`, so sharing it would let the form change the stored config in place.
 */
export function cloneWalletConfig(config: WalletConfig): WalletConfig {
    switch (config.kind) {
        case "auto_wallet":
            return { ...config };
        case "manual_wallet":
            return { kind: "manual_wallet", tokens: new Set(config.tokens) };
    }
}

/**
 * The config a wallet settings form starts editing when the user picks `kind`: a copy of the
 * stored config if it's already that kind, otherwise that kind's defaults.
 */
export function walletConfigForMode(
    kind: WalletConfig["kind"],
    stored: WalletConfig,
    defaultLedgers: Set<string>,
): WalletConfig {
    if (stored.kind === kind) return cloneWalletConfig(stored);
    switch (kind) {
        case "auto_wallet":
            return { kind: "auto_wallet", minDollarValue: 0 };
        case "manual_wallet":
            return { kind: "manual_wallet", tokens: new Set(defaultLedgers) };
    }
}
