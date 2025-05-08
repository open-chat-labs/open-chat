<script lang="ts">
    import { AuthProvider, type OpenChat, app } from "openchat-client";
    import { getContext } from "svelte";
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import SendIcon from "svelte-material-icons/Send.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import Translatable from "../../Translatable.svelte";
    import SignInOption from "./SignInOption.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        mode?: "signin" | "signup";
        restrictTo?: Set<string>;
        emailInvalid: boolean;
        email: string;
        currentProvider?: AuthProvider | undefined;
        showMore?: boolean;
        onLogin: (provider: AuthProvider) => void;
    }

    let {
        mode = "signin",
        restrictTo = new Set(),
        emailInvalid = $bindable(),
        email = $bindable(),
        currentProvider = undefined,
        showMore = $bindable(false),
        onLogin,
    }: Props = $props();

    function buildOptions(
        selected: AuthProvider | undefined,
        mode: "signin" | "signup",
        restrictTo: Set<string>,
    ): AuthProvider[] {
        let options = [];
        const supportsII = "PublicKeyCredential" in window;

        options.push(AuthProvider.EMAIL);
        options.push(AuthProvider.PASSKEY);

        if (supportsII) {
            options.push(AuthProvider.II);
            options.push(AuthProvider.ETH);
            options.push(AuthProvider.SOL);

            if (mode === "signin") {
                options.push(AuthProvider.NFID);
            }
        } else if (client.isNativeAndroid()) {
            options.push(AuthProvider.II);
        }

        if (restrictTo.size > 0) {
            options = options.filter((o) => {
                return (
                    restrictTo.has(o) ||
                    (o === AuthProvider.II && restrictTo.has("II")) ||
                    (o === AuthProvider.EMAIL && restrictTo.has("EMAIL")) ||
                    (o === AuthProvider.PASSKEY && restrictTo.has("PASSKEY")) ||
                    (o === AuthProvider.ETH && restrictTo.has("ETH")) ||
                    (o === AuthProvider.SOL && restrictTo.has("SOL")) ||
                    (o === AuthProvider.NFID && restrictTo.has("NFID"))
                );
            });
        }

        if (selected !== undefined) {
            let i = options.findIndex((p) => p === selected);

            if (i >= 0) {
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

    let options = $derived(
        buildOptions(currentProvider ?? app.selectedAuthProvider, mode, restrictTo),
    );
    let showAllOptions = $derived(
        (currentProvider ?? app.selectedAuthProvider) === undefined ||
            showMore ||
            mode === "signup",
    );
    $effect(() => {
        const invalid = !isEmailValid(email);
        if (emailInvalid !== invalid) {
            emailInvalid = invalid;
        }
    });
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
                                onEnter={() => onLogin(provider)}
                                placeholder={i18nKey(
                                    mode === "signin"
                                        ? "loginDialog.signinEmailPlaceholder"
                                        : "loginDialog.signupEmailPlaceholder",
                                )} />
                        </div>
                        <Button disabled={emailInvalid} tiny onClick={() => onLogin(provider)}>
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
                        onClick={() => onLogin(provider)} />
                {/if}
            </div>
        {/if}
    {/each}

    {#if !showAllOptions && options.length > 1}
        <div class="more">
            <a role="button" tabindex="0" onclick={() => (showMore = true)}>
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
