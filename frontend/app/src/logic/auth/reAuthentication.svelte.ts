// Signing in again to prove it's the user (resetting a forgotten pin, claiming a prize, deleting
// the account), as the old trees' ReAuthenticate shows it: pick a way to sign in, then a wallet or
// an emailed link where that needs one. The client does the signing in and refuses another
// account (reAuthenticate); this holds the steps between.

import {
    AuthProvider,
    selectedAuthProviderStore,
    type OpenChat,
    type ReAuthOutcome,
    type ResourceKey,
} from "@client";
import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import { configKeys } from "@shared";
import { i18nKey } from "@src/i18n/i18n";

export type ReAuthStep =
    | "choose_provider"
    | "choose_eth_wallet"
    | "choose_sol_wallet"
    | "signing_in_with_email";

export type ReAuthSuccess = Extract<ReAuthOutcome, { kind: "success" }>;

export class ReAuthentication {
    #client: OpenChat;
    // the emailed link being waited on
    #emailLink: AbortController | undefined;

    step = $state<ReAuthStep>("choose_provider");
    // why the last attempt didn't sign the user in again
    error = $state<ResourceKey>();
    // the code the emailed link shows, and whether it's still waited on
    verificationCode = $state<string>();
    polling = $state(false);

    constructor(client: OpenChat) {
        this.#client = client;
    }

    /**
     * Signs in again with `provider`. Resolves with the sign-in once it's done; undefined when the
     * user has a wallet to pick next, or it failed (`error` says why) or was given up.
     */
    async login(provider: AuthProvider, email: string): Promise<ReAuthSuccess | undefined> {
        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);
        this.error = undefined;
        switch (provider) {
            case AuthProvider.ETH:
                this.step = "choose_eth_wallet";
                return;
            case AuthProvider.SOL:
                this.step = "choose_sol_wallet";
                return;
            case AuthProvider.EMAIL:
                return this.#withEmail(email);
            case AuthProvider.PASSKEY:
                return this.#settle(await this.#client.reAuthenticate({ kind: "passkey" }));
            case AuthProvider.II:
            case AuthProvider.NFID:
                return this.#settle(
                    await this.#client.reAuthenticate({
                        kind: "auth_client",
                        provider: provider === AuthProvider.II ? "ii" : "nfid",
                    }),
                );
        }
    }

    /** A wallet signed the user in (the old trees' wallet buttons do it themselves). */
    async walletConnected(
        provider: AuthProvider,
        key: ECDSAKeyIdentity,
        delegation: DelegationChain,
    ): Promise<ReAuthSuccess | undefined> {
        return this.#settle(
            await this.#client.reAuthenticate({ kind: "identity", provider, key, delegation }),
        );
    }

    /** Stops waiting for an emailed link. */
    destroy(): void {
        this.#emailLink?.abort();
        this.#emailLink = undefined;
        this.polling = false;
    }

    async #withEmail(email: string): Promise<ReAuthSuccess | undefined> {
        this.destroy();
        const link = new AbortController();
        this.#emailLink = link;
        this.step = "signing_in_with_email";
        this.verificationCode = undefined;
        // a failed check says so, and the link still works if it's followed later
        const resp = await this.#client.requestEmailReAuthentication(
            email,
            link.signal,
            () => (this.error = i18nKey("identity.failure.pollingError")),
        );
        if (resp.kind === "cancelled") return;
        if (resp.kind === "failed") {
            this.error = resp.reason;
            return;
        }
        this.verificationCode = resp.code;
        this.polling = true;
        const outcome = await resp.reAuthenticated;
        if (this.#emailLink === link) this.destroy();
        return this.#settle(outcome);
    }

    #settle(outcome: ReAuthOutcome): ReAuthSuccess | undefined {
        switch (outcome.kind) {
            case "success":
                return outcome;
            case "failed":
                this.step = "choose_provider";
                this.error = outcome.reason;
                return;
            case "cancelled":
                return;
        }
    }
}
