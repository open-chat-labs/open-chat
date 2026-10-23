<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { Body } from "component-lib";
    import {
        AuthProvider,
        selectedAuthProviderStore,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import { ReAuthentication, type ReAuthSuccess } from "@src/logic/auth/reAuthentication.svelte";
    import { copyEmailCode } from "../../../utils/signin";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import EmailSigninFeedback from "@shared_components/home/EmailSigninFeedback.svelte";
    import ChooseSignInOption from "./ChooseSignInOption.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        autoSelect?: boolean;
        message: ResourceKey;
        onSuccess: (args: {
            key: ECDSAKeyIdentity;
            delegation: DelegationChain;
            provider: AuthProvider;
            signInProofJwt: string | undefined;
        }) => void;
    }

    let { message, onSuccess, autoSelect = false }: Props = $props();

    const reAuth = new ReAuthentication(client);
    let emailInvalid = $state(false);
    let email = $state("");

    onMount(() => {
        if (autoSelect) {
            login($selectedAuthProviderStore);
        }
        return () => reAuth.destroy();
    });

    function succeeded(success: ReAuthSuccess | undefined) {
        if (success !== undefined) onSuccess(success);
    }

    // This is where we login in with the provider that we are currently signed in with (which can be any provider type)
    async function login(provider: AuthProvider) {
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }
        succeeded(await reAuth.login(provider, email));
    }

    async function walletConnected(
        provider: AuthProvider,
        key: ECDSAKeyIdentity,
        delegation: DelegationChain,
    ) {
        succeeded(await reAuth.walletConnected(provider, key, delegation));
    }
</script>

<div class="body">
    {#if reAuth.step === "choose_provider"}
        <div class="info">
            <Body colour={"validationError"}>
                <Translatable resourceKey={message} />
            </Body>
        </div>
        <ChooseSignInOption mode={"signin"} bind:emailInvalid bind:email onLogin={login} />
    {:else if reAuth.step === "choose_eth_wallet"}
        <div class="eth-options">
            {#await import("../SignInWithEth.svelte")}
                <div class="loading">...</div>
            {:then { default: SignInWithEth }}
                <SignInWithEth
                    assumeIdentity={false}
                    onConnected={(ev) => walletConnected(AuthProvider.ETH, ev.key, ev.delegation)} />
            {/await}
        </div>
    {:else if reAuth.step === "choose_sol_wallet"}
        <div class="sol-options">
            {#await import("../SignInWithSol.svelte")}
                <div class="loading">...</div>
            {:then { default: SignInWithSol }}
                <SignInWithSol
                    assumeIdentity={false}
                    onConnected={(ev) => walletConnected(AuthProvider.SOL, ev.key, ev.delegation)} />
            {/await}
        </div>
    {:else if reAuth.step === "signing_in_with_email"}
        <EmailSigninFeedback
            code={reAuth.verificationCode}
            polling={reAuth.polling}
            onCopy={copyEmailCode} />
    {/if}
    {#if reAuth.error !== undefined}
        <p class="info">
            <ErrorMessage>
                <Translatable resourceKey={reAuth.error} />
            </ErrorMessage>
        </p>
    {/if}
</div>

<style lang="scss">
    .body {
        width: 100%;
    }

    .info {
        margin-bottom: $sp4;
    }

    .eth-options,
    .sol-options {
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
