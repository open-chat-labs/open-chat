<script lang="ts">
    import { AuthClient } from "@dfinity/auth-client";
    import { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { Principal } from "@icp-sdk/core/principal";
    import {
        Body,
        Button,
        ColourVars,
        Column,
        CommonButton,
        Container,
        Row,
        StatusCard,
        Subtitle,
    } from "component-lib";
    import {
        AuthProvider,
        InMemoryAuthClientStorage,
        iconSize,
        selectedAuthProviderStore,
        type AuthenticationPrincipal,
        type OpenChat,
        type ResourceKey,
        type WebAuthnKey,
    } from "openchat-client";
    import { ErrorCode } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import ArrowRightBoldOutline from "svelte-material-icons/ArrowRightBoldOutline.svelte";
    import LinkVariantPlus from "svelte-material-icons/LinkVariantPlus.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { configKeys } from "../../../utils/config";
    import {
        EmailPollerError,
        EmailPollerSuccess,
        EmailSigninHandler,
    } from "../../../utils/signin";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import InternetIdentityLogo from "../../icons/InternetIdentityLogo.svelte";
    import Translatable from "../../Translatable.svelte";
    import EmailSigninFeedback from "../EmailSigninFeedback.svelte";
    import ChooseSignInOption from "./ChooseSignInOption.svelte";
    import SignInOption from "./SignInOption.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        explanations: ResourceKey[];
        iiPrincipal: string | undefined;
        linkInternetIdentity?: boolean;
        onProceed?: () => void;
        onClose?: () => void;
    }

    let {
        explanations,
        iiPrincipal = $bindable(),
        linkInternetIdentity = true,
        onProceed,
        onClose,
    }: Props = $props();

    iiPrincipal;

    type IdentityDetail = {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
        provider: AuthProvider;
        webAuthnKey?: WebAuthnKey;
    };

    type ApproverIdentity = { kind: "approver"; initiator: IdentityDetail };
    type InitiatorIdentity = { kind: "initiator" };
    type ReadyToLink = {
        kind: "ready_to_link";
        approver: IdentityDetail;
        initiator: IdentityDetail;
    };
    type LinkStage = ApproverIdentity | InitiatorIdentity | ReadyToLink;

    type ProviderStep =
        | "choose_provider"
        | "choose_eth_wallet"
        | "choose_sol_wallet"
        | "signing_in_with_email";

    let error: string | undefined = $state();
    let emailSigninHandler = new EmailSigninHandler(client, "account_linking", false);
    let step: "explain" | "linking" = $state("explain");
    let substep = $state<LinkStage>({ kind: "initiator" });
    let emailInvalid = $state(false);
    let email = $state("");
    let providerStep: ProviderStep = $state("choose_provider");
    let linking = $state(false);
    let loggingInInitiator = false;
    let verificationCode: string | undefined = $state(undefined);
    let accounts: (AuthenticationPrincipal & { provider: AuthProvider })[] = $state([]);

    let currentIdentity = $derived(accounts.find((a) => a.isCurrentIdentity));
    let currentProvider = $derived(currentIdentity?.provider ?? $selectedAuthProviderStore);
    let restrictTo = $derived(
        substep.kind === "approver" && currentProvider !== undefined
            ? new Set<string>([currentProvider])
            : new Set<string>([AuthProvider.PASSKEY, AuthProvider.II, AuthProvider.EMAIL]),
    );

    onMount(() => {
        client.getAuthenticationPrincipals().then((a) => (accounts = a));
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

    function initiateLinking() {
        step = "linking";
    }

    // This is called both for the initiator and the approver
    async function loginProvider(provider: AuthProvider) {
        if (substep.kind === "ready_to_link") return;

        const generalError = `identity.failure.login_${substep.kind}`;

        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        error = undefined;

        if (provider === AuthProvider.PASSKEY) {
            if (substep.kind === "initiator") {
                const [identity, delegation, webAuthnKey] = await client.signUpWithWebAuthn(false);
                substep = {
                    kind: "approver",
                    initiator: {
                        key: identity,
                        delegation,
                        webAuthnKey,
                        provider: AuthProvider.PASSKEY,
                    },
                };
            } else {
                const initiator = substep.initiator;
                const [identity, delegation, webAuthnKey] =
                    await client.reSignInWithCurrentWebAuthnIdentity();
                substep = {
                    kind: "ready_to_link",
                    initiator,
                    approver: {
                        key: identity,
                        delegation,
                        webAuthnKey,
                        provider: AuthProvider.PASSKEY,
                    },
                };
            }
        } else if (provider === AuthProvider.EMAIL) {
            providerStep = "signing_in_with_email";
            emailSigninHandler.generateMagicLink(email).then((resp) => {
                if (resp.kind === "success") {
                    verificationCode = resp.code;
                } else if (resp.kind === "email_invalid") {
                    error = "loginDialog.invalidEmail";
                } else if (resp.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", resp.error);
                    error = "loginDialog.failedToSendEmail";
                } else {
                    error = generalError;
                }
            });
        } else if (provider === AuthProvider.ETH) {
            providerStep = "choose_eth_wallet";
        } else if (provider === AuthProvider.SOL) {
            providerStep = "choose_sol_wallet";
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
                                if (
                                    substep.kind === "approver" &&
                                    principal !== client.AuthPrincipal
                                ) {
                                    error = "identity.failure.principalMismatch";
                                } else {
                                    if (substep.kind === "initiator") {
                                        iiPrincipal = principal;
                                        substep = {
                                            kind: "approver",
                                            initiator: {
                                                key: identity,
                                                delegation: DelegationChain.fromJSON(delegation),
                                                provider: AuthProvider.II,
                                            },
                                        };
                                    } else if (substep.kind === "approver") {
                                        substep = {
                                            kind: "ready_to_link",
                                            initiator: substep.initiator,
                                            approver: {
                                                key: identity,
                                                delegation: DelegationChain.fromJSON(delegation),
                                                provider,
                                            },
                                        };
                                    }
                                }
                            }
                        },
                        onError: (err) => {
                            console.log(`Failed to log into ${substep.kind}: `, err);
                            error = generalError;
                        },
                    });
                })
                .catch((err) => {
                    console.log(`Failed to log into ${substep.kind}: `, err);
                    error = generalError;
                });
        }
    }

    // This is where we login in with the Internet Identity that we want to link to our existing OC account aka the Initiator
    async function loginInternetIdentity() {
        return loginProvider(AuthProvider.II);
    }

    function authComplete(
        provider: AuthProvider.ETH | AuthProvider.SOL | AuthProvider.EMAIL,
        detail: { kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain },
    ) {
        providerStep = "choose_provider";
        if (substep.kind === "approver") {
            substep = {
                kind: "ready_to_link",
                initiator: substep.initiator,
                approver: {
                    key: detail.key,
                    delegation: detail.delegation,
                    provider,
                },
            };
        } else if (substep.kind === "initiator") {
            substep = {
                kind: "approver",
                initiator: {
                    key: detail.key,
                    delegation: detail.delegation,
                    provider,
                },
            };
        }
    }

    // Link the two identities that we have built together
    function linkIdentities() {
        if (substep.kind !== "ready_to_link" || currentIdentity === undefined) return;

        const { initiator, approver } = substep;

        const approverPrincipal = Principal.selfAuthenticating(
            new Uint8Array(approver.delegation.publicKey),
        ).toString();

        if (currentIdentity.principal !== approverPrincipal) {
            console.log("Principal mismatch: ", currentIdentity.principal, approverPrincipal);
            error = "identity.failure.principalMismatch";
            substep = { kind: "initiator" };
            return;
        }

        error = undefined;
        linking = true;
        client
            .linkIdentities(
                initiator.key,
                initiator.delegation,
                initiator.provider === AuthProvider.II,
                initiator.webAuthnKey,
                approver.key,
                approver.delegation,
            )
            .then((resp) => {
                if (typeof resp === "object") {
                    if (resp.kind === "success") {
                        onProceed?.();
                    } else if (resp.code === ErrorCode.PrincipalAlreadyUsed) {
                        console.log("Identity already linked to another OpenChat account: ", resp);
                        error = "identity.failure.alreadyLinked";
                        substep = { kind: "initiator" };
                    } else {
                        console.log("Failed to link identities: ", resp);
                        error = "identity.failure.link";
                        substep = { kind: "initiator" };
                    }
                } else {
                    // This branch will be removed once the Identity canister is fully
                    // migrated over to returning the standardised error codes
                    if (resp === "success") {
                        onProceed?.();
                    } else if (resp === "already_linked_to_principal") {
                        console.log("Identity already linked by you: ", resp);
                        error = "identity.failure.alreadyLinked";
                    } else if (resp === "already_registered") {
                        console.log("Identity already linked by someone else: ", resp);
                        error = "identity.failure.alreadyLinked";
                        substep = { kind: "initiator" };
                    } else {
                        console.log("Failed to link identities: ", resp);
                        error = "identity.failure.link";
                        substep = { kind: "initiator" };
                    }
                }
            })
            .finally(() => (linking = false));
    }

    function reset() {
        emailSigninHandler.stopPolling();
        providerStep = "choose_provider";
        error = undefined;
        step = "explain";
        substep = { kind: "initiator" };
    }
</script>

<Row crossAxisAlignment={"center"} gap={"md"}>
    <LinkVariantPlus size={$iconSize} color={ColourVars.textPrimary} />

    <Subtitle fontWeight={"bold"}>
        <Translatable resourceKey={i18nKey("identity.linkIdentity")} />
    </Subtitle>
</Row>

<Column padding={["lg", "zero"]}>
    {#if error !== undefined}
        <ErrorMessage>
            <Translatable resourceKey={i18nKey(error)} />
        </ErrorMessage>
    {:else if step === "explain"}
        <StatusCard background={ColourVars.background2} title={"Link identity"} mode={"warning"}>
            {#snippet body()}
                {#each explanations as explanation}
                    <Translatable resourceKey={explanation} />
                {/each}
            {/snippet}
        </StatusCard>
    {:else if step === "linking"}
        {#if substep.kind === "ready_to_link"}
            <Column gap={"lg"}>
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("identity.linkTwoIdentities")} />
                </Body>
                <Row mainAxisAlignment={"spaceBetween"} gap={"sm"} crossAxisAlignment={"center"}>
                    <SignInOption hollow name={i18nKey(substep.initiator.provider)} />
                    <ArrowRightBoldOutline size={$iconSize} color={ColourVars.textSecondary} />
                    <SignInOption hollow name={i18nKey(substep.approver.provider)} />
                </Row>
            </Column>
        {:else if substep.kind === "initiator" && linkInternetIdentity}
            <Column gap={"lg"}>
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("identity.signInNext")} />
                </Body>
                <Button
                    loading={loggingInInitiator}
                    disabled={loggingInInitiator}
                    onClick={loginInternetIdentity}>
                    {#snippet icon()}
                        <span class="link-ii-logo">
                            <InternetIdentityLogo />
                        </span>
                    {/snippet}
                    <Translatable resourceKey={i18nKey("loginDialog.signin")} />
                </Button>
            </Column>
        {:else if providerStep === "choose_provider"}
            <Column gap={"lg"}>
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey(`identity.signIn_${substep.kind}`)} />
                </Body>
                <ChooseSignInOption
                    mode={"signin"}
                    {restrictTo}
                    {currentProvider}
                    showMore={substep.kind === "initiator"}
                    bind:emailInvalid
                    bind:email
                    onLogin={loginProvider} />
            </Column>
        {:else if providerStep === "choose_eth_wallet"}
            <div class="eth-options">
                {#await import("../SignInWithEth.svelte")}
                    <div class="loading">...</div>
                {:then { default: SignInWithEth }}
                    <SignInWithEth
                        assumeIdentity={false}
                        onConnected={(ev) => authComplete(AuthProvider.ETH, ev)} />
                {/await}
            </div>
        {:else if providerStep === "choose_sol_wallet"}
            <div class="sol-options">
                {#await import("../SignInWithSol.svelte")}
                    <div class="loading">...</div>
                {:then { default: SignInWithSol }}
                    <SignInWithSol
                        assumeIdentity={false}
                        onConnected={(ev) => authComplete(AuthProvider.SOL, ev)} />
                {/await}
            </div>
        {:else if providerStep === "signing_in_with_email"}
            <EmailSigninFeedback
                code={verificationCode}
                polling={$emailSigninHandler}
                onCopy={(code) => emailSigninHandler.copyCode(code)} />
            {#if error !== undefined}
                <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
            {/if}
        {/if}
    {/if}
</Column>

<Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
    <CommonButton onClick={onClose} size={"small_text"}>
        <Translatable resourceKey={i18nKey("cancel")}></Translatable>
    </CommonButton>
    {#if error !== undefined}
        <CommonButton mode={"active"} onClick={reset} size={"small_text"}>
            <Translatable resourceKey={i18nKey("identity.tryAgain")}></Translatable>
        </CommonButton>
    {:else if step === "explain"}
        {#if linkInternetIdentity}
            <CommonButton mode={"active"} onClick={initiateLinking} size={"small_text"}>
                {#snippet icon()}
                    <span class="link-ii-logo">
                        <InternetIdentityLogo />
                    </span>
                {/snippet}
                <Translatable resourceKey={i18nKey("identity.link")}></Translatable>
            </CommonButton>
        {:else}
            <CommonButton mode={"active"} onClick={initiateLinking} size={"small_text"}>
                <Translatable resourceKey={i18nKey("identity.linkedAccounts.start")}></Translatable>
            </CommonButton>
        {/if}
    {:else if step === "linking"}
        <CommonButton onClick={reset} size={"small_text"}>
            <Translatable resourceKey={i18nKey("identity.back")}></Translatable>
        </CommonButton>
        {#if substep.kind === "ready_to_link"}
            <CommonButton
                mode={"active"}
                disabled={linking}
                loading={linking}
                onClick={linkIdentities}
                size={"small"}>
                {#snippet icon(color)}
                    <LinkVariantPlus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("identity.link")}></Translatable>
            </CommonButton>
        {/if}
    {/if}
</Container>

<style lang="scss">
    .eth-options,
    .sol-options {
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
