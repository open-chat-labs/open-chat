<script lang="ts">
    import SendIcon from "svelte-material-icons/Send.svelte";
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import { AuthProvider } from "openchat-client";
    import { createEventDispatcher } from "svelte";
    import { configKeys } from "../../../utils/config";
    import Input from "../../Input.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import SignInOption from "./SignInOption.svelte";
    import { selectedAuthProviderStore } from "openchat-client";

    const dispatch = createEventDispatcher();

    export let mode: "signin" | "signup" = "signin";
    export let restrictTo: Set<string> = new Set();
    export let emailInvalid: boolean;
    export let email: string;
    export let currentProvider: AuthProvider | undefined = undefined;
    export let showMore = false;

    $: options = buildOptions(currentProvider ?? $selectedAuthProviderStore, mode, restrictTo);
    $: showAllOptions =
        (currentProvider ?? $selectedAuthProviderStore) === undefined ||
        showMore ||
        mode === "signup";
    $: {
        emailInvalid = !isEmailValid(email);
    }

    function buildOptions(
        selected: AuthProvider | undefined,
        mode: "signin" | "signup",
        restrictTo: Set<string>,
    ): AuthProvider[] {
        let options = [];
        const supportsII = "PublicKeyCredential" in window;

        options.push(AuthProvider.EMAIL);
        options.push(AuthProvider.WEBAUTHN);

        if (supportsII) {
            options.push(AuthProvider.II);
            options.push(AuthProvider.ETH);
            options.push(AuthProvider.SOL);

            if (mode === "signin") {
                options.push(AuthProvider.NFID);
            }
        }

        if (restrictTo.size > 0) {
            options = options.filter((o) => {
                return (
                    (o === AuthProvider.II && restrictTo.has("II")) ||
                    (o === AuthProvider.EMAIL && restrictTo.has("EMAIL")) ||
                    (o === AuthProvider.ETH && restrictTo.has("ETH")) ||
                    (o === AuthProvider.SOL && restrictTo.has("SOL")) ||
                    (o === AuthProvider.NFID && restrictTo.has("NFID"))
                );
            });
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

    function providerName(provider: AuthProvider): string {
        return provider === AuthProvider.NFID ? "NFID (Legacy)" : provider;
    }

    function isEmailValid(email: string): boolean {
        return email.length > 0;
    }

    function login(provider: AuthProvider) {
        dispatch("login", provider);
    }
</script>

<div class="sign-in-options">
    {#each options as provider, i}
        {#if showAllOptions || i === 0}
            <div
                class={`option ${
                    showAllOptions && options.length > 1 && i === 0 ? "separate" : ""
                }`}>
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
                        <Button disabled={emailInvalid} tiny on:click={() => login(provider)}>
                            <div class="center">
                                <SendIcon size={"1.5em"} />
                            </div>
                        </Button>
                    </div>
                {:else}
                    <SignInOption
                        {provider}
                        name={i18nKey(
                            mode === "signin" ? "loginDialog.signinWith" : "loginDialog.signupWith",
                            { provider: providerName(provider) },
                        )}
                        on:click={() => login(provider)} />
                {/if}
            </div>
        {/if}
    {/each}

    {#if !showAllOptions && options.length > 1}
        <div class="more">
            <a role="button" tabindex="0" on:click={() => (showMore = true)}>
                <Translatable resourceKey={i18nKey("loginDialog.showMore")} />
            </a>
        </div>
    {/if}
</div>

<style lang="scss">
    $height: 45px;

    :global(.sign-in-options .email .input-wrapper) {
        margin-bottom: 0;
    }

    :global(.sign-in-options .email button) {
        height: $height;
        width: 50px;
        padding: 0 $sp3 !important;
        border-radius: 0 $sp2 $sp2 0;
    }

    :global(.sign-in-options .email .input-wrapper input) {
        border-radius: 0;
        box-shadow: none;
        border-right: 1px solid var(--bd);
        height: $height;
    }

    :global(.sign-in-options .email [data-lastpass-icon-root]) {
        display: none;
    }

    :global(.sign-in-options button.tiny) {
        padding: $sp2 $sp4;
        min-height: 45px;
        min-width: auto;
    }

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    a:hover {
        text-decoration: underline;
    }

    .sign-in-options {
        display: flex;
        gap: 12px;
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

            &.separate {
                margin-bottom: $sp2;
                border-bottom: 1px solid var(--bd);
                padding-bottom: $sp4;
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

            .eth-img,
            .sol-img {
                width: 30px;
            }
        }
    }
</style>
