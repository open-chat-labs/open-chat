<script lang="ts">
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import InternetIdentityLogo from "../../landingpages/InternetIdentityLogo.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import LinkVariant from "svelte-material-icons/LinkVariant.svelte";
    import ArrowRightBoldOutline from "svelte-material-icons/ArrowRightBoldOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { iconSize } from "../../../stores/iconSize";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import {
        AuthProvider,
        InMemoryAuthClientStorage,
        Poller,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ChooseSignInOption from "./ChooseSignInOption.svelte";
    import { configKeys } from "../../../utils/config";
    import { AuthClient } from "@dfinity/auth-client";
    import AlertBox from "../../AlertBox.svelte";
    import { DelegationChain, ECDSAKeyIdentity } from "@dfinity/identity";
    import SignInOption from "./SignInOption.svelte";
    import { toastStore } from "../../../stores/toast";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let explanations: ResourceKey[];
    export let error: string | undefined;
    export let iiPrincipal: string | undefined;

    type IdentityDetail = {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
        provider: AuthProvider;
    };

    type ApproverIdentity = { kind: "approver"; initiator: IdentityDetail };
    type InitiatorIdentity = { kind: "initiator" };
    type ReadyToLink = {
        kind: "ready_to_link";
        approver: IdentityDetail;
        initiator: IdentityDetail;
    };
    type LinkStage = ApproverIdentity | InitiatorIdentity | ReadyToLink;

    let step: "explain" | "linking" = "explain";
    let substep: LinkStage = { kind: "initiator" };
    let emailInvalid = false;
    let email = "";
    let approverStep:
        | "choose_provider"
        | "choose_eth_wallet"
        | "choose_sol_wallet"
        | "signing_in_with_email" = "choose_provider";
    let linking = false;
    let loggingInInitiator = false;
    let emailSignInPoller: Poller | undefined = undefined;
    let verificationCode: string | undefined = undefined;

    $: selectedAuthProviderStore = client.selectedAuthProviderStore;

    $: console.log("Approver step: ", approverStep);

    onMount(() => {
        return () => emailSignInPoller?.stop();
    });

    function initiateLinking() {
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
            approverStep = "signing_in_with_email";
            ECDSAKeyIdentity.generate().then((sk) => generateMagicLink(sk));
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
            authClient
                .then((c) => {
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
                                            provider,
                                        },
                                    };
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

    // This is where we login in with the Internet Identity that we want to link to our existing OC account aka the Initiator
    async function loginInitiator() {
        if (substep.kind !== "initiator") return;

        error = undefined;
        loggingInInitiator = true;

        const identity = await ECDSAKeyIdentity.generate();
        const storage = new InMemoryAuthClientStorage();
        const authClient = AuthClient.create({
            storage,
            identity: identity,
        });
        authClient
            .then((c) => {
                c.login({
                    ...client.getAuthClientOptions(AuthProvider.II),
                    onSuccess: async () => {
                        iiPrincipal = c.getIdentity().getPrincipal().toString();
                        const delegation = await storage.get("delegation");
                        if (delegation) {
                            substep = {
                                kind: "approver",
                                initiator: {
                                    key: identity,
                                    delegation: DelegationChain.fromJSON(delegation),
                                    provider: AuthProvider.II,
                                },
                            };
                        }
                        loggingInInitiator = false;
                    },
                    onError: (err) => {
                        error = "identity.failure.loginInitiator";
                        console.warn("Failed to log into initiator: ", err);
                        loggingInInitiator = false;
                    },
                });
            })
            .catch((err) => {
                console.log("Failed to log into initiator: ", err);
                error = "identity.failure.loginInitiator";
                loggingInInitiator = false;
            });
    }

    function generateMagicLink(sessionKey: ECDSAKeyIdentity) {
        verificationCode = undefined;
        client
            .generateMagicLink(email, sessionKey)
            .then((response) => {
                if (response.kind === "success") {
                    verificationCode = response.code;
                    startPoller(email, sessionKey, response.userKey, response.expiration);
                } else if (response.kind === "email_invalid") {
                    error = "loginDialog.invalidEmail";
                } else if (response.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", response.error);
                    error = "loginDialog.failedToSendEmail";
                } else if (response.kind === "blocked") {
                    error = "identity.failure.loginApprover";
                }
            })
            .catch((err) => {
                console.warn("generateMagicLink error", err);
                error = "identity.failure.loginApprover";
            });
    }

    function startPoller(
        email: string,
        sessionKey: ECDSAKeyIdentity,
        userKey: Uint8Array,
        expiration: bigint,
    ) {
        emailSignInPoller = new Poller(
            async () => {
                if (emailSignInPoller !== undefined) {
                    client
                        .getSignInWithEmailDelegation(email, userKey, sessionKey, expiration, false)
                        .then((response) => {
                            if (response.kind === "success" && substep.kind === "approver") {
                                client.gaTrack("received_email_signin_delegation", "registration");
                                emailSignInPoller?.stop();
                                emailSignInPoller == undefined;
                                substep = {
                                    kind: "ready_to_link",
                                    initiator: substep.initiator,
                                    approver: {
                                        key: response.key,
                                        delegation: response.delegation,
                                        provider: AuthProvider.EMAIL,
                                    },
                                };
                            } else if (response.kind === "error") {
                                console.debug("getSignInWithEmailDelegation error");
                            }
                        })
                        .catch((err) => {
                            console.warn("getSignInWithEmailDelegation error", err);
                        });
                }
            },
            1000,
            1000,
        );
    }

    function copyCode() {
        if (verificationCode === undefined) return;

        navigator.clipboard.writeText(verificationCode).then(
            () => {
                toastStore.showSuccessToast(i18nKey("loginDialog.codeCopiedToClipboard"));
            },
            () => {
                toastStore.showFailureToast(i18nKey("loginDialog.failedToCopyCodeToClipboard"));
            },
        );
    }

    function walletConnected(
        provider: AuthProvider.ETH | AuthProvider.SOL,
        ev: CustomEvent<{ kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain }>,
    ) {
        if (substep.kind !== "approver") return;
        substep = {
            kind: "ready_to_link",
            initiator: substep.initiator,
            approver: {
                key: ev.detail.key,
                delegation: ev.detail.delegation,
                provider,
            },
        };
    }

    // Link the two identities that we have built together
    function linkIdentities() {
        if (substep.kind !== "ready_to_link") return;

        const { initiator, approver } = substep;

        error = undefined;
        linking = true;
        client
            .linkIdentities(initiator.key, initiator.delegation, approver.key, approver.delegation)
            .then((resp) => {
                if (resp === "success") {
                    dispatch("proceed");
                } else if (resp === "already_linked_to_principal") {
                    console.log("Identity already linked by you: ", resp);
                    dispatch("proceed");
                } else if (resp === "already_registered") {
                    console.log("Identity already linked by someone else: ", resp);
                    error = "identity.failure.alreadyLinked";
                    substep = { kind: "initiator" };
                } else if (resp === "principal_mismatch") {
                    console.log("Approval principal mismatch: ", resp);
                    error = "identity.failure.principalMismatch";
                    substep = { kind: "initiator" };
                } else {
                    console.log("Failed to link identities: ", resp);
                    error = "identity.failure.link";
                    substep = { kind: "initiator" };
                }
            })
            .finally(() => (linking = false));
    }

    function reset() {
        emailSignInPoller?.stop();
        emailSignInPoller = undefined;
        approverStep = "choose_provider";
        error = undefined;
        step = "explain";
        substep = { kind: "initiator" };
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
        {#if error !== undefined}
            <p class="info">
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey(error)} />
                </ErrorMessage>
            </p>
        {:else if step === "explain"}
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
                            <SigninWithEth
                                assumeIdentity={false}
                                on:connected={(ev) => walletConnected(AuthProvider.ETH, ev)} />
                        {/await}
                    </div>
                {:else if approverStep === "choose_sol_wallet"}
                    <div class="sol-options">
                        {#await import("../SigninWithSol.svelte")}
                            <div class="loading">...</div>
                        {:then { default: SigninWithSol }}
                            <SigninWithSol
                                assumeIdentity={false}
                                on:connected={(ev) => walletConnected(AuthProvider.SOL, ev)} />
                        {/await}
                    </div>
                {:else if approverStep === "signing_in_with_email"}
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                emailSignInPoller === undefined
                                    ? "loginDialog.generatingLink"
                                    : "loginDialog.checkEmail",
                            )} />

                        {#if emailSignInPoller !== undefined && verificationCode !== undefined}
                            <div class="code-wrapper">
                                <div class="code">
                                    {verificationCode}
                                </div>
                                <div class="copy" on:click={copyCode}>
                                    <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
                                </div>
                            </div>
                        {/if}
                    </p>
                    {#if error !== undefined}
                        <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
                    {/if}
                {/if}
            {:else if substep.kind === "initiator"}
                <div class="info">
                    <Translatable resourceKey={i18nKey("identity.signInNext")} />
                </div>
                <Button
                    loading={loggingInInitiator}
                    disabled={loggingInInitiator}
                    on:click={loginInitiator}>
                    <span class="link-ii-logo">
                        <InternetIdentityLogo />
                    </span>
                    <Translatable resourceKey={i18nKey("loginDialog.signin")} /></Button>
            {:else if substep.kind === "ready_to_link"}
                <div class="info">
                    <Translatable resourceKey={i18nKey("identity.linkTwoIdentities")} />
                </div>
                <div class="identities">
                    <SignInOption
                        hollow
                        provider={AuthProvider.II}
                        name={i18nKey(AuthProvider.II)} />
                    <ArrowRightBoldOutline size={$iconSize} color={"var(--icon-txt)"} />
                    <SignInOption
                        hollow
                        provider={substep.approver.provider}
                        name={i18nKey(substep.approver.provider)} />
                </div>
            {/if}
        {/if}
    </div>

    <div slot="footer">
        <ButtonGroup>
            <Button secondary on:click={() => dispatch("close")}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            {#if error !== undefined}
                <Button secondary on:click={reset}
                    ><Translatable resourceKey={i18nKey("identity.tryAgain")} /></Button>
            {:else if step === "explain"}
                <Button on:click={initiateLinking}>
                    <span class="link-ii-logo">
                        <InternetIdentityLogo />
                    </span>
                    <Translatable resourceKey={i18nKey("identity.link")} /></Button>
            {:else if step === "linking"}
                <Button secondary on:click={reset}
                    ><Translatable resourceKey={i18nKey("identity.back")} /></Button>
                {#if substep.kind === "ready_to_link"}
                    <Button loading={linking} disabled={linking} on:click={linkIdentities}>
                        <span class="link-ii-logo">
                            <InternetIdentityLogo />
                        </span>
                        <Translatable resourceKey={i18nKey("identity.link")} /></Button>
                {/if}
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

    .identities {
        display: flex;
        gap: $sp3;
        justify-content: space-between;
        align-items: center;
    }

    .code-wrapper {
        margin-top: $sp4;
        display: flex;
        gap: $sp3;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }

    .code {
        font-family: Menlo, Monaco, "Courier New", monospace;
        @include font-size(fs-160);
    }

    .copy {
        cursor: pointer;
        position: relative;
        top: 2px;
    }
</style>
