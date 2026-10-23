// Linking another way to sign in to the account, in every tree, as the old LinkAccounts did it: sign
// in with the new method (the initiator), confirm with the one this session signed in with (the
// approver), then link the two. The views run the sign-ins (a passkey, a wallet, an emailed link …)
// and hand them here.

import {
    AuthProvider,
    InMemoryAuthClientStorage,
    linkIdentitiesResult,
    type LinkedAuthenticationPrincipal,
    type OpenChat,
    type ResourceKey,
    type WebAuthnKey,
} from "@client";
import { AuthClient } from "@icp-sdk/auth/client";
import { DelegationChain, DelegationIdentity, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import { i18nKey } from "@src/i18n/i18n";

/** A sign-in made for linking: its session key and the delegation to it. */
export type LinkingIdentity = {
    key: ECDSAKeyIdentity;
    delegation: DelegationChain;
    provider: AuthProvider;
    // a new passkey's, which the identity canister records with it
    webAuthnKey?: WebAuthnKey;
};

export type LinkStage =
    | { kind: "initiator" }
    | { kind: "approver"; initiator: LinkingIdentity }
    | { kind: "ready_to_link"; initiator: LinkingIdentity; approver: LinkingIdentity };

export type LinkOutcome =
    | { kind: "linked"; initiator: LinkingIdentity }
    | { kind: "failed"; reason: ResourceKey };

/** The principal a sign-in for linking signs in as. */
export function linkingPrincipal(identity: Pick<LinkingIdentity, "key" | "delegation">): string {
    return DelegationIdentity.fromDelegation(identity.key, identity.delegation)
        .getPrincipal()
        .toString();
}

type LinkingClient = Pick<
    OpenChat,
    "AuthPrincipal" | "getAuthenticationPrincipals" | "linkIdentities"
>;

/**
 * Whether a confirming sign-in (its principal) is this session's: the session's auth principal, or
 * the linked identity marked as the one it signed in with. A passkey's confirming sign-in is the
 * linked passkey's principal, which a session that signed up with it doesn't have as its auth
 * principal. The current passkey is only found best effort, so when no identity is marked, any of
 * the account's own is accepted, as signing in again (reAuthenticate) accepts it.
 */
export function confirmsAsSession(
    principal: string,
    authPrincipal: string,
    linked: LinkedAuthenticationPrincipal[],
): boolean {
    if (principal === authPrincipal) return true;
    const current = linked.filter((p) => p.isCurrentIdentity);
    return (current.length > 0 ? current : linked).some((p) => p.principal === principal);
}

/**
 * The account's linked identity a sign-in for linking became: a passkey by its credential (the
 * identity canister gives it a principal of its own), anything else by its principal.
 */
export function linkedAs(
    linked: LinkedAuthenticationPrincipal[],
    identity: LinkingIdentity,
): LinkedAuthenticationPrincipal | undefined {
    const credentialId = identity.webAuthnKey?.credentialId;
    if (credentialId !== undefined) {
        return linked.find(
            (p) =>
                p.webAuthnKey !== undefined &&
                sameBytes(new Uint8Array(p.webAuthnKey.credentialId), credentialId),
        );
    }
    const principal = linkingPrincipal(identity);
    return linked.find((p) => p.principal === principal);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

export class IdentityLinking {
    #client: LinkingClient;

    stage = $state<LinkStage>({ kind: "initiator" });
    // why the last step didn't go through
    error = $state<ResourceKey>();
    linking = $state(false);

    constructor(client: LinkingClient) {
        this.#client = client;
    }

    /**
     * A sign-in for the current step: the new method, then the user's own confirming it. The
     * confirming one has to be the sign-in this session is, or it's refused here. Never rejects:
     * a confirming sign-in it can't check is refused, and `error` says so.
     */
    async signedIn(identity: LinkingIdentity): Promise<void> {
        this.error = undefined;
        const stage = this.stage;
        switch (stage.kind) {
            case "initiator":
                this.stage = { kind: "approver", initiator: identity };
                return;
            case "approver": {
                let own: boolean;
                try {
                    own = await this.#isSessionsOwn(identity);
                } catch (err) {
                    console.warn("Unable to check the confirming sign-in", err);
                    if (this.stage === stage) {
                        this.error = i18nKey("identity.failure.loginApprover");
                    }
                    return;
                }
                if (!own) {
                    if (this.stage === stage) {
                        this.error = i18nKey("identity.failure.principalMismatch");
                    }
                    return;
                }
                // started over meanwhile
                if (this.stage !== stage) return;
                this.stage = {
                    kind: "ready_to_link",
                    initiator: stage.initiator,
                    approver: identity,
                };
                return;
            }
            case "ready_to_link":
                return;
        }
    }

    /** A sign-in for the current step that didn't go through. */
    failed(reason: ResourceKey): void {
        this.error = reason;
    }

    /**
     * Links the two sign-ins. Only once the confirming one has been found to be this session's
     * (signedIn): the stage isn't ready to link before that, so linkIdentities is never called.
     */
    async link(): Promise<LinkOutcome> {
        if (this.stage.kind !== "ready_to_link" || this.linking) {
            return { kind: "failed", reason: i18nKey("identity.failure.link") };
        }
        const { initiator, approver } = this.stage;
        this.error = undefined;
        this.linking = true;
        try {
            const result = linkIdentitiesResult(
                await this.#client.linkIdentities(
                    initiator.key,
                    initiator.delegation,
                    initiator.provider === AuthProvider.II,
                    initiator.webAuthnKey,
                    approver.key,
                    approver.delegation,
                ),
            );
            if (result.kind === "linked") return { kind: "linked", initiator };
            if (result.startOver) return this.#startOver(result.reason);
            this.error = result.reason;
            return { kind: "failed", reason: result.reason };
        } catch (err) {
            console.warn("Unable to link the sign-in methods", err);
            return this.#startOver(i18nKey("identity.failure.link"));
        } finally {
            this.linking = false;
        }
    }

    /** Back to signing in with the new method. */
    reset(): void {
        this.stage = { kind: "initiator" };
        this.error = undefined;
    }

    // this session's sign-in (confirmsAsSession); the account's identities only when needed
    async #isSessionsOwn(identity: LinkingIdentity): Promise<boolean> {
        const principal = linkingPrincipal(identity);
        const authPrincipal = this.#client.AuthPrincipal;
        if (principal === authPrincipal) return true;
        const linked = await this.#client.getAuthenticationPrincipals();
        return confirmsAsSession(principal, authPrincipal, linked);
    }

    #startOver(reason: ResourceKey): LinkOutcome {
        this.stage = { kind: "initiator" };
        this.error = reason;
        return { kind: "failed", reason };
    }
}

/**
 * Signs in with Internet Identity or NFID in their window, for linking: the sign-in, without the
 * app taking it. Undefined if it didn't go through.
 */
export async function signInWithAuthClient(
    client: Pick<OpenChat, "getAuthClientOptions">,
    provider: AuthProvider.II | AuthProvider.NFID,
): Promise<LinkingIdentity | undefined> {
    try {
        const key = await ECDSAKeyIdentity.generate();
        const storage = new InMemoryAuthClientStorage();
        const authClient = await AuthClient.create({ storage, identity: key });
        return await new Promise((resolve) => {
            authClient.login({
                ...client.getAuthClientOptions(provider),
                onSuccess: async () => {
                    try {
                        const delegation = await storage.get("delegation");
                        resolve(
                            delegation
                                ? {
                                      key,
                                      delegation: DelegationChain.fromJSON(delegation),
                                      provider,
                                  }
                                : undefined,
                        );
                    } catch (err) {
                        console.warn(`Unable to read the ${provider} sign-in`, err);
                        resolve(undefined);
                    }
                },
                onError: (err) => {
                    console.log(`Failed to sign in with ${provider}: `, err);
                    resolve(undefined);
                },
            });
        });
    } catch (err) {
        console.warn(`Unable to sign in with ${provider}`, err);
        return undefined;
    }
}
