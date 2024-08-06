<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { AuthProvider, Poller, type OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import { configKeys } from "../../utils/config";
    import { ECDSAKeyIdentity } from "@dfinity/identity";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { toastStore } from "../../stores/toast";
    import { querystring } from "../../routes";
    import ChooseSignInOption from "./profile/ChooseSignInOption.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let state: "options" | "logging-in" = "options";
    let mode: "signin" | "signup" = "signin";
    let email = "";
    let emailSignInPoller: Poller | undefined = undefined;
    let error: string | undefined = undefined;
    let verificationCode: string | undefined = undefined;
    let emailInvalid = false;

    $: restrictTo = new Set($querystring.getAll("auth"));
    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: loggingInWithEmail =
        state === "logging-in" && $selectedAuthProviderStore === AuthProvider.EMAIL;
    $: loggingInWithEth = state === "logging-in" && $selectedAuthProviderStore === AuthProvider.ETH;
    $: loggingInWithSol = state === "logging-in" && $selectedAuthProviderStore === AuthProvider.SOL;
    $: spinning =
        state === "logging-in" &&
        error === undefined &&
        $selectedAuthProviderStore !== AuthProvider.ETH &&
        $selectedAuthProviderStore !== AuthProvider.SOL;

    onMount(() => {
        client.gaTrack("opened_signin_modal", "registration");
        return () => {
            if ($anonUser && $identityState.kind === "logging_in") {
                client.updateIdentityState({ kind: "anon" });
            }

            emailSignInPoller?.stop();
        };
    });

    $: {
        if ($identityState.kind === "anon" && state === "logging-in") {
            dispatch("close");
        }
        if ($identityState.kind === "logged_in" || $identityState.kind === "challenging") {
            dispatch("close");
        }
    }

    function cancel() {
        if ($anonUser && $identityState.kind === "logging_in") {
            client.updateIdentityState({ kind: "anon" });
        }
        dispatch("close");
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
        state = "logging-in";
        error = undefined;

        if (provider === AuthProvider.EMAIL) {
            ECDSAKeyIdentity.generate().then((sk) => generateMagicLink(sk));
        } else if (provider === AuthProvider.ETH) {
            console.log("Logging in with ETH");
        } else if (provider === AuthProvider.SOL) {
            console.log("Logging in with SOL");
        } else {
            client.login();
        }
    }

    function generateMagicLink(sessionKey: ECDSAKeyIdentity) {
        verificationCode = undefined;

        client
            .generateMagicLink(email, sessionKey)
            .then((response) => {
                if (response.kind === "success") {
                    verificationCode = response.code;
                    client.gaTrack("generated_magic_signin_link", "registration");
                    startPoller(email, sessionKey, response.userKey, response.expiration);
                } else if (response.kind === "email_invalid") {
                    error = "loginDialog.invalidEmail";
                } else if (response.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", response.error);
                    error = "loginDialog.failedToSendEmail";
                } else if (response.kind === "blocked") {
                    error = "loginDialog.unexpectedError";
                }
            })
            .catch((err) => {
                console.warn("generateMagicLink error", err);
                error = "loginDialog.unexpectedError";
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
                        .getSignInWithEmailDelegation(email, userKey, sessionKey, expiration, true)
                        .then((response) => {
                            if (response.kind === "success") {
                                client.gaTrack("received_email_signin_delegation", "registration");
                                emailSignInPoller?.stop();
                                emailSignInPoller == undefined;
                            } else if (response.kind === "failure") {
                                console.debug("getSignInWithEmailDelegation error");
                                error = "loginDialog.unexpectedError";
                            }
                        })
                        .catch((err) => {
                            console.warn("getSignInWithEmailDelegation error", err);
                            error = "loginDialog.unexpectedError";
                        });
                }
            },
            1000,
            1000,
        );
    }

    function cancelLink() {
        client.gaTrack("email_signin_cancelled", "registration");
        emailSignInPoller?.stop();
        emailSignInPoller == undefined;
        state = "options";
    }

    function toggleMode() {
        if (mode === "signin") {
            client.gaTrack("signup_link_clicked", "registration");
        } else if (mode === "signup") {
            client.gaTrack("signin_link_clicked", "registration");
        }
        mode = mode === "signin" ? "signup" : "signin";
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
</script>

<ModalContent hideFooter={!loggingInWithEmail} on:close={cancel} closeIcon>
    <div class="header login" slot="header">
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
    <div class="login" slot="body">
        {#if state === "options"}
            <ChooseSignInOption on:login={login} {mode} {restrictTo} bind:emailInvalid bind:email />

            <div class="change-mode">
                <Translatable
                    resourceKey={i18nKey(
                        mode === "signin" ? "loginDialog.noAccount" : "loginDialog.haveAccount",
                    )} />
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-missing-attribute -->
                <a role="button" tabindex="0" on:click={toggleMode}>
                    <Translatable
                        resourceKey={i18nKey(
                            mode === "signin" ? "loginDialog.signup" : "loginDialog.signin",
                        )} />
                </a>
            </div>
        {:else if loggingInWithEmail}
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
    <div class="footer login-modal" slot="footer">
        <ButtonGroup>
            <Button on:click={cancelLink}
                ><Translatable
                    resourceKey={i18nKey(
                        error === undefined ? "cancel" : "loginDialog.back",
                    )} /></Button>
        </ButtonGroup>
    </div>
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
