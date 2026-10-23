<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
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
        iconSize,
        selectedAuthProviderStore,
        type LinkedAuthenticationPrincipal,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { configKeys } from "@shared";
    import {
        IdentityLinking,
        linkingPrincipal,
        signInWithAuthClient,
    } from "@src/logic/auth/identityLinking.svelte";
    import { getContext, onMount } from "svelte";
    import ArrowRightBoldOutline from "svelte-material-icons/ArrowRightBoldOutline.svelte";
    import LinkVariantPlus from "svelte-material-icons/LinkVariantPlus.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        EmailPollerError,
        EmailPollerSuccess,
        EmailSigninHandler,
    } from "../../../utils/signin";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import InternetIdentityLogo from "../../icons/InternetIdentityLogo.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import EmailSigninFeedback from "@shared_components/home/EmailSigninFeedback.svelte";
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

    type ProviderStep =
        | "choose_provider"
        | "choose_eth_wallet"
        | "choose_sol_wallet"
        | "signing_in_with_email";

    // a step the view runs (an emailed link, a wallet) that went wrong; the flow says the rest
    let localError: string | undefined = $state();
    const emailSigninHandler = new EmailSigninHandler(client, "account_linking", false);
    let step: "explain" | "linking" = $state("explain");
    const flow = new IdentityLinking(client);
    let substep = $derived(flow.stage);
    let error = $derived(localError ?? flow.error?.key);
    let emailInvalid = $state(false);
    let email = $state("");
    let providerStep: ProviderStep = $state("choose_provider");
    let linking = $derived(flow.linking);
    const loggingInInitiator = false;
    let verificationCode: string | undefined = $state(undefined);
    let accounts: LinkedAuthenticationPrincipal[] = $state([]);

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
            localError = "identity.failure.pollingError";
        }

        if (ev instanceof EmailPollerSuccess) {
            authComplete(AuthProvider.EMAIL, ev.detail);
        }
    }

    function initiateLinking() {
        step = "linking";
    }

    // This is called both for the initiator and the approver: the sign-in goes to the linking
    // flow (app/src/logic/auth), which refuses an approver that isn't this session's
    async function loginProvider(provider: AuthProvider) {
        if (substep.kind === "ready_to_link") return;

        const generalError = `identity.failure.login_${substep.kind}`;

        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        localError = undefined;

        if (provider === AuthProvider.PASSKEY) {
            try {
                const [key, delegation, webAuthnKey] =
                    substep.kind === "initiator"
                        ? await client.signUpWithWebAuthn(false)
                        : await client.reSignInWithCurrentWebAuthnIdentity();
                await flow.signedIn({
                    key,
                    delegation,
                    webAuthnKey,
                    provider: AuthProvider.PASSKEY,
                });
            } catch (err) {
                console.warn(`Unable to sign in with a passkey (${substep.kind})`, err);
                localError = generalError;
            }
        } else if (provider === AuthProvider.EMAIL) {
            providerStep = "signing_in_with_email";
            emailSigninHandler.generateMagicLink(email).then((resp) => {
                if (resp.kind === "success") {
                    verificationCode = resp.code;
                } else if (resp.kind === "email_invalid") {
                    localError = "loginDialog.invalidEmail";
                } else if (resp.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", resp.error);
                    localError = "loginDialog.failedToSendEmail";
                } else {
                    localError = generalError;
                }
            });
        } else if (provider === AuthProvider.ETH) {
            providerStep = "choose_eth_wallet";
        } else if (provider === AuthProvider.SOL) {
            providerStep = "choose_sol_wallet";
        } else if (provider === AuthProvider.II || provider === AuthProvider.NFID) {
            const initiating = substep.kind === "initiator";
            const identity = await signInWithAuthClient(client, provider);
            if (identity === undefined) {
                localError = generalError;
            } else {
                if (initiating) iiPrincipal = linkingPrincipal(identity);
                await flow.signedIn(identity);
            }
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
        // it says itself why a sign-in it can't check is refused (flow.error); it never rejects
        void flow.signedIn({ key: detail.key, delegation: detail.delegation, provider });
    }

    // Link the two identities that we have built together
    async function linkIdentities() {
        const outcome = await flow.link();
        if (outcome.kind === "linked") onProceed?.();
    }

    function reset() {
        emailSigninHandler.stopPolling();
        providerStep = "choose_provider";
        localError = undefined;
        step = "explain";
        flow.reset();
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
        <StatusCard background={ColourVars.surface2} title={"Link identity"} mode={"warning"}>
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
