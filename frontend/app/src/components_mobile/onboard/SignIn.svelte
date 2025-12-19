<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { configKeys } from "@src/utils/config";
    import { EmailSigninHandler } from "@src/utils/signin";
    import {
        AuthProvider,
        identityStateStore,
        OpenChat,
        selectedAuthProviderStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import EmailSigninFeedback from "../home/EmailSigninFeedback.svelte";
    import ChooseSignInOption from "../home/profile/ChooseSignInOption.svelte";
    import Translatable from "../Translatable.svelte";

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
    let emailSigninHandler = new EmailSigninHandler(client, "registration", true);
    // let restrictTo = $derived(new Set($querystringStore.getAll("auth")));
    const restrictTo = new Set(["II", "PASSKEY"]);
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
        if (
            $identityStateStore.kind === "logged_in" ||
            $identityStateStore.kind === "challenging"
        ) {
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
            emailSigninHandler.generateMagicLink(email).then((resp) => {
                if (resp.kind === "success") {
                    verificationCode = resp.code;
                } else if (resp.kind === "email_invalid") {
                    error = "loginDialog.invalidEmail";
                } else if (resp.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", resp.error);
                    error = "loginDialog.failedToSendEmail";
                } else {
                    error = "loginDialog.unexpectedError";
                }
            });
        } else if (provider === AuthProvider.PASSKEY) {
            if (client.isNativeAndroid()) {
                client.signInWithAndroidWebAuthn();
            } else {
                client.signInWithWebAuthn();
            }
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
        emailSigninHandler.stopPolling();
        loginState = "options";
    }
</script>

{#if loginState === "options"}
    <ChooseSignInOption onLogin={login} mode={"signin"} {restrictTo} bind:emailInvalid bind:email />
{:else if loggingInWithEmail}
    <EmailSigninFeedback
        code={verificationCode}
        polling={$emailSigninHandler}
        onCopy={(code) => emailSigninHandler.copyCode(code)} />
    {#if error !== undefined}
        <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
    {/if}
{:else if loggingInWithEth}
    {#await import("../home/SignInWithEth.svelte")}
        <div class="loading">...</div>
    {:then { default: SignInWithEth }}
        <SignInWithEth />
    {/await}
{:else if loggingInWithSol}
    {#await import("../home/SignInWithSol.svelte")}
        <div class="loading">...</div>
    {:then { default: SignInWithSol }}
        <SignInWithSol />
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
