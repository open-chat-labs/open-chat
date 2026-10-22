<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { configKeys } from "@shared";
    import { copyEmailCode } from "@src/utils/signin";
    import {
        AuthProvider,
        identityStateStore,
        OpenChat,
        querystringStore,
        selectedAuthProviderStore,
    } from "@client";
    import { getContext } from "svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import EmailSigninFeedback from "@shared_components/home/EmailSigninFeedback.svelte";
    import ChooseSignInOption from "../home/profile/ChooseSignInOption.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        error: string | undefined;
        spinning: boolean;
    }

    let { error = $bindable(), onClose, spinning = $bindable() }: Props = $props();
    void spinning;

    let loginState = $state<"options" | "logging-in">("options");
    let emailInvalid = $state(false);
    let email = $state(localStorage.getItem(configKeys.selectedAuthEmail) ?? "");
    let verificationCode: string | undefined = $state(undefined);
    // the emailed link being waited on (still waited on after this closes, as before)
    let emailLink: AbortController | undefined = undefined;
    let polling = $state(false);
    let restrictTo = $derived(new Set($querystringStore.getAll("auth")));
    let loggingInWithEmail = $derived(
        loginState === "logging-in" && $selectedAuthProviderStore === AuthProvider.EMAIL,
    );
    let loggingInWithEth = $derived(
        loginState === "logging-in" && $selectedAuthProviderStore === AuthProvider.ETH,
    );
    let loggingInWithSol = $derived(
        loginState === "logging-in" && $selectedAuthProviderStore === AuthProvider.SOL,
    );

    $effect(() => {
        spinning =
            loginState === "logging-in" &&
            error === undefined &&
            $selectedAuthProviderStore !== AuthProvider.ETH &&
            $selectedAuthProviderStore !== AuthProvider.SOL;
    });

    $effect(() => {
        if ($identityStateStore.kind === "anon" && loginState === "logging-in") {
            onClose();
        }
        if ($identityStateStore.kind === "logged_in") {
            onClose();
        }
    });

    function login(provider: AuthProvider) {
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        client.gaTrack("initiated_signin", "registration", provider);

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);
        loginState = "logging-in";
        error = undefined;

        if (provider === AuthProvider.EMAIL) {
            verificationCode = undefined;
            emailLink?.abort();
            const link = new AbortController();
            emailLink = link;
            // signed in by the link, the identity store closes this
            client.requestEmailSignIn(email, link.signal).then((resp) => {
                if (resp.kind === "sent") {
                    verificationCode = resp.code;
                    polling = true;
                    resp.signedIn.then(() => {
                        if (emailLink === link) polling = false;
                    });
                } else if (resp.kind === "failed") {
                    error = resp.reason.key;
                }
            });
        } else if (provider === AuthProvider.PASSKEY) {
            // a cancelled prompt or a passkey we don't recognise goes back to the options; signed
            // in, the identity store closes this
            client.signIn({ kind: "passkey" }).then((outcome) => {
                if (outcome.kind === "cancelled" || outcome.kind === "failed") {
                    loginState = "options";
                }
            });
        } else if (provider === AuthProvider.ETH) {
            console.log("Logging in with ETH");
        } else if (provider === AuthProvider.SOL) {
            console.log("Logging in with SOL");
        } else {
            client.login();
        }
    }

    function cancelLink() {
        client.gaTrack("email_signin_cancelled", "registration");
        emailLink?.abort();
        emailLink = undefined;
        polling = false;
        loginState = "options";
    }
</script>

{#if loginState === "options"}
    <ChooseSignInOption onLogin={login} mode={"signin"} {restrictTo} bind:emailInvalid bind:email />
{:else if loggingInWithEmail}
    <EmailSigninFeedback
        code={verificationCode}
        {polling}
        onCopy={copyEmailCode} />
    {#if error !== undefined}
        <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
    {/if}
{:else if loggingInWithEth}
    {#await import("../home/SigninWithEth.svelte")}
        <div class="loading">...</div>
    {:then { default: SigninWithEth }}
        <SigninWithEth />
    {/await}
{:else if loggingInWithSol}
    {#await import("../home/SigninWithSol.svelte")}
        <div class="loading">...</div>
    {:then { default: SigninWithSol }}
        <SigninWithSol />
    {/await}
{/if}

{#if loggingInWithEmail}
    <div class="footer">
        <ButtonGroup>
            <Button onClick={cancelLink}
                ><Translatable
                    resourceKey={i18nKey(
                        error === undefined ? "cancel" : "loginDialog.back",
                    )} /></Button>
        </ButtonGroup>
    </div>
{/if}

<style lang="scss">
    .footer {
        align-self: flex-end;
    }
</style>
