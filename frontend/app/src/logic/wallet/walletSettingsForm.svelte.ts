// The wallet settings form, for every tree's settings: which tokens the wallet lists (automatic,
// by a minimum value, or hand-picked) as a copy of the stored config, saved when the form closes.
import {
    cloneWalletConfig,
    walletConfigChanged,
    walletConfigForMode,
    type OpenChat,
    type WalletConfig,
} from "@client";

// `invalid`: changed, but the minimum isn't a number, so nothing was saved
export type WalletSettingsSave = "unchanged" | "invalid" | "saved" | "failed";

/**
 * Edits a copy of the stored wallet config, never the stored one (6d invariant 4): switching mode
 * starts hand-picking from the default tokens and automatic at a $0 minimum, and going back to the
 * stored mode restores the stored config. `save` stores the copy only if it differs.
 */
export class WalletSettingsForm {
    #client: Pick<OpenChat, "setWalletConfig">;
    #stored: () => WalletConfig;
    #defaultLedgers: () => Set<string>;

    config = $state<WalletConfig>({ kind: "auto_wallet", minDollarValue: 0 });

    constructor(
        client: Pick<OpenChat, "setWalletConfig">,
        stored: () => WalletConfig,
        defaultLedgers: () => Set<string>,
    ) {
        this.#client = client;
        this.#stored = stored;
        this.#defaultLedgers = defaultLedgers;
        this.config = cloneWalletConfig(stored());
    }

    selectMode(kind: WalletConfig["kind"]): void {
        if (this.config.kind === kind) return;
        this.config = walletConfigForMode(kind, this.#stored(), this.#defaultLedgers());
    }

    toggleMode(): void {
        this.selectMode(this.config.kind === "auto_wallet" ? "manual_wallet" : "auto_wallet");
    }

    /** Lists the token or stops listing it, in a hand-picked wallet. */
    toggleToken(ledger: string): void {
        if (this.config.kind !== "manual_wallet") return;
        const tokens = new Set(this.config.tokens);
        if (tokens.has(ledger)) tokens.delete(ledger);
        else tokens.add(ledger);
        this.config = { kind: "manual_wallet", tokens };
    }

    /** The hand-picked tokens, all at once. */
    setTokens(ledgers: Iterable<string>): void {
        if (this.config.kind !== "manual_wallet") return;
        this.config = { kind: "manual_wallet", tokens: new Set(ledgers) };
    }

    /** The automatic wallet's minimum value, in dollars. */
    setMinimum(minDollarValue: number): void {
        if (this.config.kind !== "auto_wallet") return;
        this.config = { kind: "auto_wallet", minDollarValue };
    }

    get valid(): boolean {
        return this.config.kind === "manual_wallet" || !isNaN(Number(this.config.minDollarValue));
    }

    get changed(): boolean {
        return walletConfigChanged(this.#stored(), this.config);
    }

    /** Stores the config when it differs from the stored one, and is valid. */
    async save(): Promise<WalletSettingsSave> {
        if (!this.changed) return "unchanged";
        if (!this.valid) return "invalid";
        const ok = await this.#client.setWalletConfig(cloneWalletConfig(this.config));
        return ok ? "saved" : "failed";
    }
}
