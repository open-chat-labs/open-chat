<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { AuthProvider, Poller, type OpenChat } from "openchat-client";
    import InternetIdentityLogo from "../landingpages/InternetIdentityLogo.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import SendIcon from "svelte-material-icons/Send.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { configKeys } from "../../utils/config";
    import { ECDSAKeyIdentity } from "@dfinity/identity";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let state: "options" | "logging-in" = "options";
    let mode: "signin" | "signup" = "signin";
    let email = "";
    let showMore = false;
    let sessionKey: ECDSAKeyIdentity | undefined = undefined;
    let emailSignInPoller: Poller | undefined = undefined;
    let error: string | undefined = undefined;

    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: options = buildOptions($selectedAuthProviderStore, mode);
    $: emailInvalid = !isEmailValid(email);
    $: showAllOptions = $selectedAuthProviderStore === undefined || showMore || mode === "signup";
    $: loggingInWithEmail =
        state === "logging-in" && $selectedAuthProviderStore === AuthProvider.EMAIL;

    onDestroy(() => {
        if ($anonUser && $identityState.kind === "logging_in") {
            identityState.set({ kind: "anon" });
        }

        emailSignInPoller?.stop();
    });

    $: {
        if ($identityState.kind === "anon" && state === "logging-in") {
            dispatch("close");
        }
        if ($identityState.kind === "logged_in") {
            dispatch("close");
        }
    }

    function cancel() {
        if ($anonUser && $identityState.kind === "logging_in") {
            identityState.set({ kind: "anon" });
        }
        dispatch("close");
    }

    function buildOptions(
        selected: AuthProvider | undefined,
        mode: "signin" | "signup",
    ): AuthProvider[] {
        let options = [];
        const supportsII = "PublicKeyCredential" in window;

        options.push(AuthProvider.EMAIL);

        if (supportsII) {
            options.push(AuthProvider.II);

            if (mode === "signin") {
                options.push(AuthProvider.NFID);
            }
        }

        if (selected !== undefined) {
            let i = options.findIndex((p) => p === selected);

            if (i >= 0) {
                if (selected === AuthProvider.EMAIL) {
                    email = localStorage.getItem(configKeys.selectedAuthEmail) ?? "";
                }

                options.splice(i, 1);
                options.splice(0, 0, selected);
            }
        }

        return options;
    }

    function isEmailValid(email: string): boolean {
        return email.length > 0;
    }

    function login(provider: AuthProvider) {
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);
        state = "logging-in";
        error = undefined;

        if (provider === AuthProvider.EMAIL) {
            if (sessionKey !== undefined) {
                generateMagicLink(sessionKey);
            } else {
                ECDSAKeyIdentity.generate().then((sk) => {
                    sessionKey = sk;
                    generateMagicLink(sk);
                });
            }
        } else {
            client.login();
        }
    }

    function generateMagicLink(sessionKey: ECDSAKeyIdentity) {
        client.generateMagicLink(email, sessionKey).then((response) => {
            if (response.kind === "success") {
                startPoller(email, sessionKey, response.userKey, response.expiration);
            } else if (response.kind === "email_invalid") {
                error = "loginDialog.invalidEmail";
            } else if (response.kind === "failed_to_send_email") {
                console.log("generateMagicLink failed_to_send_email", response.error);
                error = "loginDialog.failedToSendEmail";
            } else if (response.kind === "blocked") {
                error = "loginDialog.unexpectedError";
            }
        });
    }

    function startPoller(
        email: string,
        sessionKey: ECDSAKeyIdentity,
        userKey: Uint8Array,
        expiration: bigint,
    ) {
        emailSignInPoller = new Poller(async () => {
            client
                .getSignInWithEmailDelegation(email, userKey, sessionKey, expiration)
                .then((response) => {
                    if (response.kind === "error") {
                        console.log("Failed to getSignInWithEmailDelegation", response.error);
                        error = "loginDialog.unexpectedError";
                    }
                });
        }, 1000);
    }

    function cancelLink() {
        emailSignInPoller?.stop();
        emailSignInPoller == undefined;
        state = "options";
    }

    function providerName(provider: AuthProvider): string {
        return provider === AuthProvider.NFID ? "NFID (Legacy)" : provider;
    }

    function toggleMode() {
        mode = mode === "signin" ? "signup" : "signin";
    }
</script>

<ModalContent hideFooter={!loggingInWithEmail} on:close={cancel} closeIcon>
    <div class="header login" slot="header">
        <div class="logo-img">
            <FancyLoader loop={state === "logging-in" && error === undefined} />
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
            <div class="options">
                {#each options as provider, i}
                    {#if showAllOptions || i === 0}
                        <div class="option">
                            {#if provider === AuthProvider.EMAIL}
                                <div class="email">
                                    <div class="email-icon icon">
                                        <EmailIcon size={"1.5em"} color={"var(--txt-light)"} />
                                    </div>
                                    <div class="email-txt">
                                        <Input
                                            bind:value={email}
                                            minlength={10}
                                            maxlength={200}
                                            on:enter={() => login(provider)}
                                            placeholder={i18nKey(
                                                mode === "signin"
                                                    ? "loginDialog.signinEmailPlaceholder"
                                                    : "loginDialog.signupEmailPlaceholder",
                                            )} />
                                    </div>
                                    <Button
                                        disabled={emailInvalid}
                                        tiny
                                        on:click={() => login(provider)}>
                                        <div class="center">
                                            <SendIcon size={"1.5em"} />
                                        </div>
                                    </Button>
                                </div>
                            {:else}
                                <div class="other">
                                    <div class="icon center">
                                        {#if provider === AuthProvider.II}
                                            <InternetIdentityLogo />
                                        {:else if provider === AuthProvider.NFID}
                                            <img class="nfid-img" src="/assets/nfid.svg" alt="" />
                                        {/if}
                                    </div>
                                    <Button fill on:click={() => login(provider)}>
                                        <Translatable
                                            resourceKey={i18nKey(
                                                mode === "signin"
                                                    ? "loginDialog.signinWith"
                                                    : "loginDialog.signupWith",
                                                { provider: providerName(provider) },
                                            )} />
                                    </Button>
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}

                {#if !showAllOptions}
                    <div class="more">
                        <a role="button" tabindex="0" on:click={() => (showMore = true)}>
                            <Translatable resourceKey={i18nKey("loginDialog.showMore")} />
                        </a>
                    </div>
                {/if}

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
            </div>
        {:else if loggingInWithEmail}
            <p>
                <Translatable
                    resourceKey={i18nKey(
                        emailSignInPoller === undefined
                            ? "loginDialog.generatingLink"
                            : "loginDialog.checkEmail",
                    )} />
            </p>
            {#if error !== undefined}
                <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
            {/if}
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

    :global(.login .email .input-wrapper) {
        margin-bottom: 0;
    }

    :global(.login .other button) {
        border-radius: 0 $sp2 $sp2 0;
    }

    :global(.login .email button) {
        height: $height;
        width: 50px;
        padding: 0 $sp3 !important;
        border-radius: 0 $sp2 $sp2 0;
    }

    :global(.login .email .input-wrapper input) {
        border-radius: 0;
        box-shadow: none;
        border-right: 1px solid var(--bd);
        height: $height;
    }

    :global(.login .email [data-lastpass-icon-root]) {
        display: none;
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

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    a:hover {
        text-decoration: underline;
    }

    .options {
        display: flex;
        gap: $sp4;
        flex-direction: column;
        align-items: center;
        margin-bottom: $sp3;
        width: 100%;

        .option {
            width: 100%;
            max-width: 440px;
            display: flex;
            align-items: center;
            gap: 12px;

            .email {
                flex: 1;
                display: flex;
                justify-content: space-between;
                align-items: center;

                .email-txt {
                    flex: auto;
                }
            }

            .other {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex: auto;
            }
        }

        .icon {
            flex: 0 0 60px;
            width: 60px;
            height: $height;
            border-radius: $sp2 0 0 $sp2;
            border-right: 1px solid var(--bd);
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: var(--input-bg);

            .nfid-img {
                width: 40px;
            }
        }

        .change-mode {
            margin-top: $sp4;
        }
    }
</style>
