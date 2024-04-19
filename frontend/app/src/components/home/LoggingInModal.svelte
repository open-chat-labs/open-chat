<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext, onDestroy } from "svelte";
    import { AuthProvider, type OpenChat } from "openchat-client";
    import InternetIdentityLogo from "../landingpages/InternetIdentityLogo.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { Pincode, PincodeInput } from "svelte-pincode";
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import SendIcon from "svelte-material-icons/Send.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Input from "../Input.svelte";
    import { configKeys } from "../../utils/config";
    import { ECDSAKeyIdentity } from "@dfinity/identity";

    type Option = {
        provider: AuthProvider;
        visible: boolean;
    };

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let state: "idle" | "confirming" | "logging-in" | "error" = "idle";
    let email = "";
    let verificationCode: string[] = [];
    let errorMessage: string | undefined = undefined;
    let busy = false;

    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: options = buildOptions($selectedAuthProviderStore);
    $: visibleOptions = options.filter((o) => o.visible);
    $: emailInvalid = !isEmailValid(email);
    $: codeInvalid = !isCodeValid(verificationCode);

    $: console.log("Email", email, emailInvalid);

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

    function buildOptions(selected: AuthProvider | undefined): Option[] {
        let options = [];
        const supportsII = "PublicKeyCredential" in window;

        if (supportsII) {
            options.push({
                provider: AuthProvider.II,
                visible: true,
            });
        }

        options.push({
            provider: AuthProvider.EMAIL,
            visible: true,
        });

        options.push({
            provider: AuthProvider.NFID,
            visible: false,
        });

        if (selected !== undefined) {
            let i = options.findIndex((o) => o.provider === selected);

            if (i >= 0) {
                for (const o of options) {
                    o.visible = false;
                }

                if (selected === AuthProvider.EMAIL) {
                    email = localStorage.getItem(configKeys.selectedAuthEmail) ?? "";
                }

                options.splice(i, 1);
                options.splice(0, 0, { provider: selected, visible: true });
            }
        }

        return options;
    }

    function showMore() {
        for (const o of options) {
            o.visible = true;
        }

        options = [...options];
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

        selectedAuthProviderStore.set(provider);
        state = "logging-in";

        if (provider === AuthProvider.EMAIL) {
            client
                .generateEmailVerificationCode(email)
                .then((response) => {
                    if (response.kind === "success") {
                        localStorage.setItem(configKeys.selectedAuthEmail, email);
                        state = "confirming";
                        errorMessage = undefined;
                    } else {
                        switch (response.kind) {
                            case "email_invalid":
                                errorMessage = "invalidEmail";
                                break;
                            case "blocked":
                                errorMessage = "codeBlocked";
                                break;
                            case "failed_to_send_email":
                                errorMessage = "failedToSendEmail";
                                break;
                        }

                        state = "error";
                    }
                })
                .catch(() => {
                    state = "idle";
                });
        } else {
            client.login();
        }
    }

    function clearCode() {
        verificationCode = ["", "", "", "", "", ""];
    }

    function submitCode() {
        if (codeInvalid) {
            return;
        }

        busy = true;

        const code = verificationCode.join("");

        ECDSAKeyIdentity.generate().then((sessionKey) => {
            client
                .signInWithEmailVerificationCode(email, code, sessionKey)
                .then((response) => {
                    if (response.kind === "incorrect_code") {
                        errorMessage = "incorrectCode";
                    } else if (response.kind === "not_found") {
                        errorMessage = "codeBlocked";
                    }
                })
                .finally(() => (busy = false));
        });
    }

    function resetDialog() {
        clearCode();
        state = "idle";
    }

    function providerName(provider: AuthProvider): string {
        return provider === AuthProvider.NFID ? "NFID" : provider;
    }
</script>

<ModalContent hideFooter={state !== "error" && state !== "confirming"} on:close={cancel} closeIcon>
    <div class="header" slot="header">
        <Translatable
            resourceKey={i18nKey(
                state === "confirming" ? "loginDialog.enterCode" : "loginDialog.title",
            )} />
    </div>
    <div class="login" slot="body">
        {#if state === "idle"}
            {#if $selectedAuthProviderStore === undefined}
                <div class="info">
                    <Translatable resourceKey={i18nKey("loginDialog.chooseAuth")} />
                </div>
            {/if}
            <div class="options">
                {#each visibleOptions as option, i}
                    <div class="option">
                        {#if option.provider === AuthProvider.EMAIL}
                            <div class="email">
                                <div class="email-icon icon">
                                    <EmailIcon size={"1.5em"} color={"var(--txt-light)"} />
                                </div>
                                <div class="email-txt">
                                    <Input
                                        bind:value={email}
                                        minlength={10}
                                        maxlength={200}
                                        on:enter={() => login(option.provider)}
                                        placeholder={i18nKey("loginDialog.emailPlaceholder")} />
                                </div>
                                <Button
                                    disabled={emailInvalid}
                                    tiny
                                    on:click={() => login(option.provider)}>
                                    <div class="center">
                                        <SendIcon size={"1.5em"} />
                                    </div>
                                </Button>
                            </div>
                        {:else}
                            <div class="other">
                                <div class="icon center">
                                    {#if option.provider === AuthProvider.II}
                                        <InternetIdentityLogo />
                                    {:else if option.provider === AuthProvider.NFID}
                                        <img class="nfid-img" src="/assets/nfid.svg" alt="" />
                                    {/if}
                                </div>
                                <Button fill on:click={() => login(option.provider)}>
                                    {providerName(option.provider)}
                                </Button>
                            </div>
                        {/if}
                    </div>
                    {#if i < visibleOptions.length - 1}
                        {#if visibleOptions.length < options.length}
                            <div class="or">
                                <div class="line" />
                                <div>or</div>
                                <div class="line" />
                            </div>
                        {/if}
                    {/if}
                {/each}

                {#if visibleOptions.length < options.length}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-missing-attribute -->
                    <a class="more" role="button" tabindex="0" on:click={showMore}>
                        <Translatable resourceKey={i18nKey("loginDialog.showMore")} />
                    </a>
                {/if}
            </div>
        {:else if state === "logging-in"}
            <div class="center">
                <div class="loader">
                    <FancyLoader />
                </div>
            </div>
        {:else}
            {#if state === "confirming"}
                <div class="info">
                    <Translatable resourceKey={i18nKey("loginDialog.enterCodeInfo")} />
                </div>
                <div class="code">
                    <Pincode bind:code={verificationCode}>
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                        <PincodeInput />
                    </Pincode>
                </div>
            {/if}

            {#if errorMessage !== undefined}
                <div class="center">
                    <ErrorMessage>
                        <Translatable resourceKey={i18nKey("loginDialog." + errorMessage)} />
                    </ErrorMessage>
                </div>
            {/if}
        {/if}
    </div>
    <div class="footer login-modal" slot="footer">
        <ButtonGroup>
            {#if state === "confirming"}
                <Button
                    cls="refresh-code"
                    disabled={emailInvalid}
                    hollow
                    tiny
                    on:click={() => login(AuthProvider.EMAIL)}>
                    <div class="center">
                        <Refresh size={"1.5em"} color={"var(--icon-txt)"} />
                    </div>
                </Button>
                <Button secondary on:click={clearCode} disabled={busy}>
                    <Translatable resourceKey={i18nKey("loginDialog.clearCode")} />
                </Button>
                <Button on:click={submitCode} disabled={codeInvalid || busy} loading={busy}>
                    <Translatable resourceKey={i18nKey("loginDialog.submitCode")} />
                </Button>
            {:else if state === "error"}
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
        text-align: center;
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

    .loader {
        width: 100px;
        margin-bottom: $sp4;
    }

    .code {
        text-align: center;
    }

    .options {
        display: flex;
        gap: $sp4;
        flex-direction: column;
        align-items: center;
        margin-bottom: $sp5;

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

        .or {
            display: flex;
            gap: $sp4;
            margin: 6px 0 2px 0;
            color: var(--txt-light);

            .line {
                border-top: var(--bw) solid var(--bd);
                position: relative;
                top: 13px;
                width: 120px;
            }
        }

        .more {
            margin-top: $sp3;
        }
    }

    .email {
    }
</style>
