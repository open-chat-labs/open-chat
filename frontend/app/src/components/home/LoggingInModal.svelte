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

    function isEmailValid(_email: string): boolean {
        return true;
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
                        state = "error";
                        errorMessage = "codeExpired";
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
                        <div class="icon center">
                            {#if option.provider === AuthProvider.II}
                                <InternetIdentityLogo />
                            {:else if option.provider === AuthProvider.EMAIL}
                                <EmailIcon size={"1.7em"} color={"var(--txt)"} />
                            {:else if option.provider === AuthProvider.NFID}
                                <img class="nfid-img" src="/assets/nfid.svg" alt="" />
                            {/if}
                        </div>

                        {#if option.provider === AuthProvider.EMAIL}
                            <div class="email">
                                <Input
                                    bind:value={email}
                                    invalid={emailInvalid}
                                    minlength={10}
                                    maxlength={50}
                                    placeholder={i18nKey("loginDialog.emailPlaceholder")} />
                            </div>
                            <Button tiny on:click={() => login(option.provider)}>
                                <div class="center">
                                    <SendIcon size={"1.5em"} viewBox="0 -1 24 24" />
                                </div>
                            </Button>
                        {:else}
                            <Button fill on:click={() => login(option.provider)}>
                                {providerName(option.provider)}
                            </Button>
                        {/if}
                    </div>
                    {#if i < visibleOptions.length - 1}
                        {#if visibleOptions.length < options.length}
                            <div class="or">
                                <div class="line" />
                                <div>or</div>
                                <div class="line" />
                            </div>
                        {:else}
                            <div class="hr" />
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
    <div class="footer" slot="footer">
        <ButtonGroup>
            {#if state === "confirming"}
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
    :global(.login .email .input-wrapper) {
        margin-bottom: 0;
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
    }

    .code {
        text-align: center;
    }

    .options {
        display: flex;
        gap: $sp3;
        flex-direction: column;
        align-items: center;
        margin-bottom: $sp4;

        .option {
            width: 100%;
            max-width: 440px;
            display: flex;
            // border: var(--bw) solid var(--bd);
            // border-radius: var(--button-rd);
            align-items: center;
            // padding: 6px 12px;
            gap: 12px;

            .email {
                flex: 1;
            }
        }

        .icon {
            width: 40px;

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

        .hr {
            border-top: var(--bw) solid var(--bd);
            height: 1px;
            width: 70%;
            margin: 5px 0;
        }

        .more {
            margin-top: $sp3;
        }
    }
</style>
