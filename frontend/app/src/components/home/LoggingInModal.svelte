<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        AuthProvider,
        type OpenChat,
        anonUser,
        identityState,
        selectedAuthProviderStore,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import { configKeys } from "../../utils/config";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { querystring } from "../../routes";
    import ChooseSignInOption from "./profile/ChooseSignInOption.svelte";
    import { EmailPollerError, EmailSigninHandler } from "../../utils/signin";
    import EmailSigninFeedback from "./EmailSigninFeedback.svelte";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let loginState = $state<"options" | "logging-in">("options");
    let mode: "signin" | "signup" = $state("signin");
    let email = $state("");
    let error: string | undefined = $state(undefined);
    let verificationCode: string | undefined = $state(undefined);
    let emailInvalid = $state(false);

    let emailSigninHandler = new EmailSigninHandler(client, "registration", true);

    let restrictTo = $derived(new Set($querystring.getAll("auth")));
    let loggingInWithEmail = $derived(
        loginState === "logging-in" && $selectedAuthProviderStore === AuthProvider.EMAIL,
    );
    let loggingInWithEth = $derived(
        loginState === "logging-in" && $selectedAuthProviderStore === AuthProvider.ETH,
    );
    let loggingInWithSol = $derived(
        loginState === "logging-in" && $selectedAuthProviderStore === AuthProvider.SOL,
    );
    let spinning = $derived(
        loginState === "logging-in" &&
            error === undefined &&
            $selectedAuthProviderStore !== AuthProvider.ETH &&
            $selectedAuthProviderStore !== AuthProvider.SOL,
    );

    onMount(() => {
        emailSigninHandler.addEventListener("email_signin_event", emailEvent);
        client.gaTrack("opened_signin_modal", "registration");
        return () => {
            if ($anonUser && $identityState.kind === "logging_in") {
                client.updateIdentityState({ kind: "anon" });
            }
            emailSigninHandler.removeEventListener("email_signin_event", emailEvent);
            emailSigninHandler.destroy();
        };
    });

    function emailEvent(ev: Event): void {
        if (ev instanceof EmailPollerError) {
            error = "loginDialog.unexpectedError";
        }
    }

    $effect(() => {
        if ($identityState.kind === "anon" && loginState === "logging-in") {
            onClose();
        }
        if ($identityState.kind === "logged_in" || $identityState.kind === "challenging") {
            onClose();
        }
    });

    function cancel() {
        if ($anonUser && $identityState.kind === "logging_in") {
            client.updateIdentityState({ kind: "anon" });
        }
        onClose();
    }

    function login(ev: CustomEvent<AuthProvider>) {
        const provider = ev.detail;
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        if (mode === "signin") {
            client.gaTrack("initiated_signin", "registration", provider);
        } else if (mode === "signup") {
            client.gaTrack("initiated_signup", "registration", provider);
        }

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
            if (mode === "signin") {
                client.signInWithWebAuthn();
            } else {
                client.signUpWithWebAuthn(true);
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

    function toggleMode() {
        if (mode === "signin") {
            client.gaTrack("signup_link_clicked", "registration");
        } else if (mode === "signup") {
            client.gaTrack("signin_link_clicked", "registration");
        }
        mode = mode === "signin" ? "signup" : "signin";
    }
</script>

<ModalContent hideFooter={!loggingInWithEmail} onClose={cancel} closeIcon>
    {#snippet header()}
        <div class="header login">
            <div class="logo-img">
                <FancyLoader loop={spinning} />
            </div>
            <div class="title">
                <div>
                    <Translatable
                        resourceKey={i18nKey(
                            mode === "signin" ? "loginDialog.title" : "loginDialog.signupTitle",
                        )} />
                </div>
                <div class="strapline">
                    <Translatable resourceKey={i18nKey("loginDialog.strapline")} />
                </div>
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="login">
            {#if loginState === "options"}
                <ChooseSignInOption
                    on:login={login}
                    {mode}
                    {restrictTo}
                    bind:emailInvalid
                    bind:email />

                <div class="change-mode">
                    <Translatable
                        resourceKey={i18nKey(
                            mode === "signin" ? "loginDialog.noAccount" : "loginDialog.haveAccount",
                        )} />
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_missing_attribute -->
                    <a role="button" tabindex="0" onclick={toggleMode}>
                        <Translatable
                            resourceKey={i18nKey(
                                mode === "signin" ? "loginDialog.signup" : "loginDialog.signin",
                            )} />
                    </a>
                </div>
            {:else if loggingInWithEmail}
                <EmailSigninFeedback
                    code={verificationCode}
                    polling={$emailSigninHandler}
                    on:copy={(ev) => emailSigninHandler.copyCode(ev.detail)} />
                {#if error !== undefined}
                    <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
                {/if}
            {:else if loggingInWithEth}
                {#await import("./SigninWithEth.svelte")}
                    <div class="loading">...</div>
                {:then { default: SigninWithEth }}
                    <SigninWithEth />
                {/await}
            {:else if loggingInWithSol}
                {#await import("./SigninWithSol.svelte")}
                    <div class="loading">...</div>
                {:then { default: SigninWithSol }}
                    <SigninWithSol />
                {/await}
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="footer login-modal">
            <ButtonGroup>
                <Button on:click={cancelLink}
                    ><Translatable
                        resourceKey={i18nKey(
                            error === undefined ? "cancel" : "loginDialog.back",
                        )} /></Button>
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    $height: 45px;

    :global(.login-modal.footer .refresh-code) {
        min-width: 50px;
        width: 50px;
        padding: 0;
    }

    :global(.login .error) {
        margin-bottom: 0;
    }

    :global(.login button.tiny) {
        padding: $sp2 $sp4;
        min-height: 45px;
        min-width: auto;
    }

    .header {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: $sp3;

        .logo-img {
            margin-top: $sp3;
            height: 56px;
            width: 56px;

            @include mobile() {
                height: 40px;
                width: 40px;
            }
        }

        .strapline {
            @include font(light, normal, fs-80);
            color: var(--txt-light);
        }

        .title {
            display: flex;
            align-items: center;
            flex-direction: column;
            gap: $sp2;
        }
    }

    .login {
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    a:hover {
        text-decoration: underline;
    }

    .change-mode {
        margin-top: $sp4;
    }
</style>
