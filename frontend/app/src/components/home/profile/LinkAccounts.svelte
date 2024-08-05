<script lang="ts">
    import InternetIdentityLogo from "../../landingpages/InternetIdentityLogo.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import LinkVariant from "svelte-material-icons/LinkVariant.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { iconSize } from "../../../stores/iconSize";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import {
        AuthProvider,
        InMemoryAuthClientStorage,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import ChooseSignInOption from "./ChooseSignInOption.svelte";
    import { configKeys } from "../../../utils/config";
    import { AuthClient } from "@dfinity/auth-client";
    import AlertBox from "../../AlertBox.svelte";
    import { DelegationChain, ECDSAKeyIdentity } from "@dfinity/identity";
    // import { ECDSAKeyIdentity } from "@dfinity/identity";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let explanations: ResourceKey[];
    export let error: string | undefined;

    type IdentityDetail = {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
    };

    type ApproverIdentity = { kind: "approver"; initiator: IdentityDetail };
    type InitiatorIdentity = { kind: "initiator" };
    type ReadyToLink = {
        kind: "ready_to_link";
        approver: IdentityDetail;
        initiator: IdentityDetail;
    };
    type LinkStage = ApproverIdentity | InitiatorIdentity | ReadyToLink;

    let failed = false;
    let step: "explain" | "linking" = "explain";
    let substep: LinkStage = { kind: "initiator" };
    let emailInvalid = false;
    let email = "";
    let approverStep: "choose_provider" | "choose_eth_wallet" | "choose_sol_wallet" =
        "choose_provider";

    $: selectedAuthProviderStore = client.selectedAuthProviderStore;

    function linkIdentity() {
        step = "linking";
    }

    // This is where we login in with the provider that we are currently signed in with (which can be any provider type)
    async function loginApprover(ev: CustomEvent<AuthProvider>) {
        if (substep.kind !== "approver") return;

        const { initiator } = substep;

        const provider = ev.detail;
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);
        error = undefined;

        if (provider === AuthProvider.EMAIL) {
            // ECDSAKeyIdentity.generate().then((sk) => generateMagicLink(sk));
            console.log("TODO Logging in with email");
        } else if (provider === AuthProvider.ETH) {
            approverStep = "choose_eth_wallet";
        } else if (provider === AuthProvider.SOL) {
            approverStep = "choose_sol_wallet";
        } else {
            // This is the II / NFID case
            const identity = await ECDSAKeyIdentity.generate();
            const storage = new InMemoryAuthClientStorage();
            const authClient = AuthClient.create({
                storage,
                identity: identity,
            });
            authClient.then((c) => {
                c.login({
                    ...client.getAuthClientOptions(provider),
                    onSuccess: async () => {
                        const delegation = await storage.get("delegation");
                        if (delegation) {
                            const principal = c.getIdentity().getPrincipal().toString();
                            if (principal !== client.AuthPrincipal) {
                                error = "Principal mismatch";
                            } else {
                                substep = {
                                    kind: "ready_to_link",
                                    initiator,
                                    approver: {
                                        key: identity,
                                        delegation: DelegationChain.fromJSON(delegation),
                                    },
                                };
                            }
                        }
                    },
                    onError: (err) => {
                        error = "we weren't able to sign into II at all";
                        console.warn("Login error from auth client: ", err);
                    },
                });
            });
        }
    }

    // This is where we login in with the Internet Identity that we want to link to our existing OC account aka the Initiator
    async function loginInitiator() {
        if (substep.kind !== "initiator") return;

        const identity = await ECDSAKeyIdentity.generate();
        const storage = new InMemoryAuthClientStorage();
        const authClient = AuthClient.create({
            storage,
            identity: identity,
        });
        authClient.then((c) => {
            c.login({
                ...client.getAuthClientOptions(AuthProvider.II),
                onSuccess: async () => {
                    const delegation = await storage.get("delegation");
                    if (delegation) {
                        substep = {
                            kind: "approver",
                            initiator: {
                                key: identity,
                                delegation: DelegationChain.fromJSON(delegation),
                            },
                        };
                    }
                },
                onError: (err) => {
                    error = "we weren't able to sign into II at all";
                    console.warn("Login error from auth client: ", err);
                },
            });
        });
    }

    function walletConnected(
        ev: CustomEvent<{ kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain }>,
    ) {
        if (substep.kind !== "approver") return;
        substep = {
            kind: "ready_to_link",
            initiator: substep.initiator,
            approver: {
                key: ev.detail.key,
                delegation: ev.detail.delegation,
            },
        };
    }

    // Link the two identities that we have built together
    function linkIdentities() {
        if (substep.kind !== "ready_to_link") return;

        const { initiator, approver } = substep;

        client
            .linkIdentities(initiator.key, initiator.delegation, approver.key, approver.delegation)
            .then((resp) => {
                console.log("Response from linkIdentities: ", resp);
                if (resp === "already_registered" || resp === "success") {
                    dispatch("proceed");
                } else {
                    error = "identity.failed";
                }
            });
    }
</script>

<ModalContent fadeDelay={0} fadeDuration={0}>
    <div slot="header" class="header">
        <LinkVariant size={$iconSize} color={"var(--txt)"} />
        <div class="title">
            <Translatable resourceKey={i18nKey("identity.linkIdentity")} />
        </div>
    </div>
    <div slot="body">
        {#if failed}
            <p class="info">
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey("identity.failed")} />
                </ErrorMessage>
            </p>
        {/if}
        {#if step === "explain"}
            <AlertBox>
                {#each explanations as explanation}
                    <p class="info">
                        <Translatable resourceKey={explanation} />
                    </p>
                {/each}
            </AlertBox>
        {:else if step === "linking"}
            {#if substep.kind === "approver"}
                {#if approverStep === "choose_provider"}
                    <div class="info center">
                        <Translatable resourceKey={i18nKey("identity.signInCurrent")} />
                    </div>
                    <ChooseSignInOption
                        mode={"signin"}
                        bind:emailInvalid
                        bind:email
                        on:login={loginApprover} />
                {:else if approverStep === "choose_eth_wallet"}
                    <div class="eth-options">
                        {#await import("../SigninWithEth.svelte")}
                            <div class="loading">...</div>
                        {:then { default: SigninWithEth }}
                            <SigninWithEth assumeIdentity={false} on:connected={walletConnected} />
                        {/await}
                    </div>
                {:else if approverStep === "choose_sol_wallet"}
                    <div class="sol-options">
                        {#await import("../SigninWithSol.svelte")}
                            <div class="loading">...</div>
                        {:then { default: SigninWithSol }}
                            <SigninWithSol assumeIdentity={false} on:connected={walletConnected} />
                        {/await}
                    </div>
                {/if}
            {:else if substep.kind === "initiator"}
                <div class="info">
                    <Translatable resourceKey={i18nKey("identity.signInNext")} />
                </div>
                <Button on:click={loginInitiator}>
                    <span class="link-ii-logo">
                        <InternetIdentityLogo />
                    </span>
                    <Translatable resourceKey={i18nKey("loginDialog.signin")} /></Button>
            {:else if substep.kind === "ready_to_link"}
                <div class="info">
                    <Translatable resourceKey={i18nKey("identity.linkTwoIdentities")} />
                </div>
                <Button on:click={linkIdentities}>
                    <Translatable resourceKey={i18nKey("identity.link")} /></Button>
            {/if}
        {/if}
    </div>

    <div slot="footer">
        <ButtonGroup>
            <Button secondary on:click={() => dispatch("close")}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            {#if step === "explain"}
                <Button secondary on:click={linkIdentity}>
                    <span class="link-ii-logo">
                        <InternetIdentityLogo />
                    </span>
                    <Translatable resourceKey={i18nKey("identity.link")} /></Button>
                <Button on:click={() => dispatch("proceed")}
                    ><Translatable resourceKey={i18nKey("identity.proceed")} /></Button>
            {:else if step === "linking"}
                <Button secondary on:click={() => (step = "explain")}
                    ><Translatable resourceKey={i18nKey("identity.back")} /></Button>
            {/if}
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
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
