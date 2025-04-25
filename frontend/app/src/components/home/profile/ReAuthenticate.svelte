<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import {
        AuthProvider,
        InMemoryAuthClientStorage,
        type OpenChat,
        type ResourceKey,
        selectedAuthProviderStore,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ChooseSignInOption from "./ChooseSignInOption.svelte";
    import { configKeys } from "../../../utils/config";
    import { AuthClient } from "@dfinity/auth-client";
    import { DelegationChain, ECDSAKeyIdentity, DelegationIdentity } from "@dfinity/identity";
    import {
        EmailPollerError,
        EmailPollerSuccess,
        EmailSigninHandler,
    } from "../../../utils/signin";
    import EmailSigninFeedback from "../EmailSigninFeedback.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        message: ResourceKey;
        onSuccess: (args: {
            key: ECDSAKeyIdentity;
            delegation: DelegationChain;
            provider: AuthProvider;
        }) => void;
    }

    let { message, onSuccess }: Props = $props();

    let error: string | undefined = $state();
    let emailSigninHandler = new EmailSigninHandler(client, "account_linking", false);
    let emailInvalid = $state(false);
    let email = $state("");
    let authStep:
        | "choose_provider"
        | "choose_eth_wallet"
        | "choose_sol_wallet"
        | "signing_in_with_email" = $state("choose_provider");
    let verificationCode: string | undefined = $state(undefined);

    onMount(() => {
        emailSigninHandler.addEventListener("email_signin_event", emailEvent);
        return () => {
            emailSigninHandler.removeEventListener("email_signin_event", emailEvent);
            emailSigninHandler.destroy();
        };
    });

    function emailEvent(ev: Event): void {
        if (ev instanceof EmailPollerError) {
            error = "identity.failure.pollingError";
        }

        if (ev instanceof EmailPollerSuccess) {
            authComplete(AuthProvider.EMAIL, ev.detail);
        }
    }

    // This is where we login in with the provider that we are currently signed in with (which can be any provider type)
    async function login(provider: AuthProvider) {
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);
        error = undefined;

        if (provider === AuthProvider.PASSKEY) {
            const [key, delegation] = await client.reSignInWithCurrentWebAuthnIdentity();
            onSuccess({
                key,
                delegation,
                provider,
            });
        } else if (provider === AuthProvider.EMAIL) {
            authStep = "signing_in_with_email";
            emailSigninHandler.generateMagicLink(email).then((resp) => {
                if (resp.kind === "success") {
                    verificationCode = resp.code;
                } else if (resp.kind === "email_invalid") {
                    error = "loginDialog.invalidEmail";
                } else if (resp.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", resp.error);
                    error = "loginDialog.failedToSendEmail";
                } else {
                    error = "identity.failure.loginApprover";
                }
            });
        } else if (provider === AuthProvider.ETH) {
            authStep = "choose_eth_wallet";
        } else if (provider === AuthProvider.SOL) {
            authStep = "choose_sol_wallet";
        } else {
            // This is the II / NFID case
            const identity = await ECDSAKeyIdentity.generate();
            const storage = new InMemoryAuthClientStorage();
            const authClient = AuthClient.create({
                storage,
                identity: identity,
            });
            authClient
                .then((c) => {
                    c.login({
                        ...client.getAuthClientOptions(provider),
                        onSuccess: async () => {
                            const delegation = await storage.get("delegation");
                            if (delegation) {
                                const principal = c.getIdentity().getPrincipal().toString();
                                if (principal !== client.AuthPrincipal) {
                                    error = "identity.failure.principalMismatch";
                                } else {
                                    onSuccess({
                                        key: identity,
                                        delegation: DelegationChain.fromJSON(delegation),
                                        provider,
                                    });
                                }
                            }
                        },
                        onError: (err) => {
                            console.log("Failed to log into approver: ", err);
                            error = "identity.failure.loginApprover";
                        },
                    });
                })
                .catch((err) => {
                    console.log("Failed to log into approver: ", err);
                    error = "identity.failure.loginApprover";
                });
        }
    }

    function authComplete(
        provider: AuthProvider.ETH | AuthProvider.SOL | AuthProvider.EMAIL,
        detail: { kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain },
    ) {
        const identity = DelegationIdentity.fromDelegation(detail.key, detail.delegation);
        const principal = identity.getPrincipal().toString();
        if (principal !== client.AuthPrincipal) {
            authStep = "choose_provider";
            error = "identity.failure.principalMismatch";
        } else {
            onSuccess({
                key: detail.key,
                delegation: detail.delegation,
                provider,
            });
        }
    }
</script>

<div class="body">
    {#if authStep === "choose_provider"}
        <div class="info center">
            <Translatable resourceKey={message} />
        </div>
        <ChooseSignInOption mode={"signin"} bind:emailInvalid bind:email onLogin={login} />
    {:else if authStep === "choose_eth_wallet"}
        <div class="eth-options">
            {#await import("../SigninWithEth.svelte")}
                <div class="loading">...</div>
            {:then { default: SigninWithEth }}
                <SigninWithEth
                    assumeIdentity={false}
                    onConnected={(ev) => authComplete(AuthProvider.ETH, ev)} />
            {/await}
        </div>
    {:else if authStep === "choose_sol_wallet"}
        <div class="sol-options">
            {#await import("../SigninWithSol.svelte")}
                <div class="loading">...</div>
            {:then { default: SigninWithSol }}
                <SigninWithSol
                    assumeIdentity={false}
                    onConnected={(ev) => authComplete(AuthProvider.SOL, ev)} />
            {/await}
        </div>
    {:else if authStep === "signing_in_with_email"}
        <EmailSigninFeedback
            code={verificationCode}
            polling={$emailSigninHandler}
            onCopy={(code) => emailSigninHandler.copyCode(code)} />
    {/if}
    {#if error !== undefined}
        <p class="info">
            <ErrorMessage>
                <Translatable resourceKey={i18nKey(error)} />
            </ErrorMessage>
        </p>
    {/if}
</div>

<style lang="scss">
    .body {
        width: 100%;

        @include not-mobile() {
            min-width: 350px;
        }
    }

    .info {
        margin-bottom: $sp4;

        &.center {
            text-align: center;
        }
    }

    .eth-options,
    .sol-options {
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
