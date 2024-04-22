<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { AuthProvider, type OpenChat } from "openchat-client";
    import InternetIdentityLogo from "../landingpages/InternetIdentityLogo.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { Pincode, PincodeInput } from "svelte-pincode";
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import SendIcon from "svelte-material-icons/Send.svelte";
    import { now500 } from "../../stores/time";
    import RefreshIcon from "svelte-material-icons/Refresh.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Input from "../Input.svelte";
    import { configKeys } from "../../utils/config";
    import { ECDSAKeyIdentity } from "@dfinity/identity";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let state: "options" | "logging-in" | "code-generation-failed" | "enter-code" = "options";
    let mode: "signin" | "signup" = "signin";
    let email = "";
    let verificationCode: string[] = [];
    let errorMessage: string | undefined = undefined;
    let busy = false;
    let blockedUntil: Date | undefined = undefined;
    let attemptsRemaining: number | undefined = undefined;

    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: options = buildOptions($selectedAuthProviderStore, mode);
    $: emailInvalid = !isEmailValid(email);
    $: codeInvalid = !isCodeValid(verificationCode);
    $: resetCodeReady = blockedUntil !== undefined ? $now500 >= Number(blockedUntil) : true;
    $: timeRemaining = resetCodeReady
        ? undefined
        : client.formatTimeRemaining($now500, Number(blockedUntil), true);

    onDestroy(() => {
        if ($anonUser && $identityState.kind === "logging_in") {
            identityState.set({ kind: "anon" });
        }
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

        if (supportsII) {
            options.push(AuthProvider.II);
        }

        options.push(AuthProvider.EMAIL);

        if (mode === "signin") {
            options.push(AuthProvider.NFID);
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

    function isCodeValid(code: string[]): boolean {
        return code.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function login(provider: AuthProvider) {
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        clearCode();

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);
        errorMessage = undefined;
        blockedUntil = undefined;
        attemptsRemaining = undefined;
        state = "logging-in";

        if (provider === AuthProvider.EMAIL) {
            client
                .generateEmailVerificationCode(email)
                .then((response) => {
                    if (response.kind === "success") {
                        state = "enter-code";
                        errorMessage = undefined;
                    } else {
                        switch (response.kind) {
                            case "email_invalid":
                                errorMessage = "invalidEmail";
                                localStorage.setItem(configKeys.selectedAuthEmail, "");
                                break;
                            case "blocked":
                                errorMessage = "codeBlocked";
                                blockedUntil = new Date(Number(response.until));
                                break;
                            case "failed_to_send_email":
                                errorMessage = "failedToSendEmail";
                                break;
                        }

                        state = "code-generation-failed";
                    }
                })
                .catch((e) => {
                    console.log("error generating code", e);
                    state = "options";
                });
        } else {
            client.login();
        }
    }

    function clearCode() {
        verificationCode = ["", "", "", "", "", ""];
    }

    function onPinComplete() {
        if (errorMessage !== undefined) {
            return;
        }

        submitCode();
    }

    function submitCode() {
        if (codeInvalid) {
            return;
        }

        busy = true;
        errorMessage = undefined;
        blockedUntil = undefined;
        attemptsRemaining = undefined;

        ECDSAKeyIdentity.generate().then((sessionKey) => {
            client
                .signInWithEmailVerificationCode(email, verificationCode.join(""), sessionKey)
                .then((response) => {
                    if (response.kind === "incorrect_code") {
                        if (response.blockedUntil !== undefined) {
                            errorMessage = "codeBlocked";
                            blockedUntil = new Date(Number(response.blockedUntil));
                            state = "code-generation-failed";
                        } else {
                            errorMessage = "incorrectCode";
                            attemptsRemaining = response.attemptsRemaining;
                        }
                    } else if (response.kind === "not_found") {
                        errorMessage = "notFound";
                        state = "code-generation-failed";
                    }
                })
                .finally(() => (busy = false));
        });
    }

    function resetDialog() {
        clearCode();
        state = "options";
    }

    function providerName(provider: AuthProvider): string {
        return provider === AuthProvider.NFID ? "NFID (Legacy)" : provider;
    }

    function toggleMode() {
        mode = mode === "signin" ? "signup" : "signin";
    }
</script>

<ModalContent
    hideFooter={state !== "enter-code" && state !== "code-generation-failed"}
    on:close={cancel}
    closeIcon>
    <div class="header login" slot="header">
        <div class="logo-img">
            <FancyLoader loop={state === "logging-in"} />
        </div>
        <div class="title">
            <div>
                <Translatable
                    resourceKey={i18nKey(
                        state === "enter-code"
                            ? "loginDialog.enterCode"
                            : mode === "signin"
                              ? "loginDialog.title"
                              : "loginDialog.signupTitle",
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
                {#each options as provider}
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
                {/each}

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
        {:else if state !== "logging-in"}
            {#if state === "enter-code"}
                <div class="info">
                    <Translatable resourceKey={i18nKey("loginDialog.enterCodeInfo")} />
                </div>
                <div class="code">
                    <Pincode on:complete={onPinComplete} bind:code={verificationCode}>
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                    </Pincode>
                </div>
            {/if}
            {#if errorMessage !== undefined && !(errorMessage === "codeBlocked" && resetCodeReady)}
                <div class="center">
                    <div>
                        <Translatable
                            resourceKey={i18nKey("loginDialog." + errorMessage, {
                                n: attemptsRemaining,
                            })} />
                        {#if errorMessage === "codeBlocked" && !resetCodeReady}
                            <pre>{timeRemaining}</pre>
                        {/if}
                    </div>
                </div>
            {/if}
            {#if state === "code-generation-failed" && resetCodeReady}
                <div>
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-missing-attribute -->
                    <a
                        class="send-code"
                        role="button"
                        tabindex="0"
                        on:click={() => login(AuthProvider.EMAIL)}>
                        <Translatable resourceKey={i18nKey("loginDialog.resetCodeReady")} />
                    </a>
                </div>
            {/if}
        {/if}
    </div>
    <div class="footer login-modal" slot="footer">
        <ButtonGroup>
            {#if state === "enter-code"}
                <Button
                    cls="refresh-code"
                    disabled={emailInvalid}
                    hollow
                    tiny
                    title={$_("loginDialog.refreshTitle")}
                    on:click={() => login(AuthProvider.EMAIL)}>
                    <div class="center">
                        <RefreshIcon size={"1.5em"} color={"var(--icon-txt)"} />
                    </div>
                </Button>
                <Button secondary on:click={clearCode} disabled={busy}>
                    <Translatable resourceKey={i18nKey("loginDialog.clearCode")} />
                </Button>
                <Button on:click={submitCode} disabled={codeInvalid || busy} loading={busy}>
                    <Translatable resourceKey={i18nKey("loginDialog.submitCode")} />
                </Button>
            {:else if state === "code-generation-failed"}
                <Button on:click={resetDialog}
                    ><Translatable resourceKey={i18nKey("loginDialog.back")} /></Button>
            {/if}
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

    :global([data-pincode]) {
        gap: $sp3;
        border: none !important;
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

    .code {
        text-align: center;
    }

    .send-code:hover {
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
