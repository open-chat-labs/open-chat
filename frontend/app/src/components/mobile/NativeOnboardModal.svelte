<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import { anonUserStore, identityStateStore, OpenChat, type CreatedUser } from "openchat-client";
    import { getContext } from "svelte";
    import { locale } from "svelte-i18n";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Select from "../Select.svelte";
    import Translatable from "../Translatable.svelte";
    import OnBoardOptionLogo from "@components/home/profile/OnBoardOptionLogo.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlus.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import LinkVariant from "svelte-material-icons/LinkVariant.svelte";
    import Button from "../Button.svelte";
    import SignUp from "../onboard/SignUp.svelte";
    import { AccountLinkingErrorCode } from "openchat-shared";
    import { AndroidWebAuthnErrorCode } from "tauri-plugin-oc-api";

    const ALC_LENGTH = 6;

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    type Step = "choose-auth" | "new-user" | "one-time-password";
    let step: Step = $state("choose-auth");
    let accountLinkingCode = $state("");
    let alcInput: HTMLInputElement | undefined = $state(undefined);
    let linkingInProgress = $state(false);
    let error: string | undefined = $state(undefined);
    let signUpError: string | undefined = $state(undefined);
    let selectedLocale = $state(($locale as string).substring(0, 2));

    $effect(() => {
        setLocale(selectedLocale);
    });

    function cancel() {
        if ($anonUserStore && $identityStateStore.kind === "logging_in") {
            client.updateIdentityState({ kind: "anon" });
        }
        onClose();
    }

    function signIn() {
        client.signInWithAndroidWebAuthn().catch(async (e) => {
            if ("AUTH_FAILED" === e) {
                error = "native.auth.error";
                console.error("Auth error: ", e);
            } else {
                // Passkey either not found, or user cancelled auth request
                step = "one-time-password";
            }
        });
    }

    function newUser() {
        step = "new-user";
    }

    function linkAccount() {
        if (!linkingInProgress && accountLinkingCode.length === ALC_LENGTH) {
            linkingInProgress = true;
            error = undefined;
            client.linkAccountsWithAndroidWebAuthn(accountLinkingCode).catch((err) => {
                console.error(err);
                linkingInProgress = false;
                if (err && "object" === typeof err && "code" in err) {
                    switch (err.code) {
                        case AccountLinkingErrorCode.AlreadyRegistered:
                        case AccountLinkingErrorCode.LinkingCodeNotFound:
                        case AccountLinkingErrorCode.MaxLinkedIdentitiesLimitReached:
                        case AndroidWebAuthnErrorCode.NoProviders:
                        case AndroidWebAuthnErrorCode.CreatePasskeyFail:
                            error = err.code;
                            break;
                        default:
                            error = "default";
                    }
                } else {
                    error = "default";
                }
            });
        } else {
            error = "codeInvalid";
        }
    }

    function onCreatedUser(user: CreatedUser) {
        client.onRegisteredUser(user);
        onClose();
    }

    function logout(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        client.logout();
    }
</script>

{#snippet getIcon(icon: string)}
    {#if icon === "Login"}
        <Login size="1.5em" />
    {:else if icon === "AccountPlus"}
        <AccountPlus size="1.5em" />
    {:else if icon === "LinkVariant"}
        <LinkVariant size="1.5em" />
    {:else}
        <!-- Fallback or error handling -->
        ?
    {/if}
{/snippet}

{#snippet button(
    primary: boolean,
    label: string,
    icon: string,
    onClick: () => void,
    loading?: boolean,
)}
    <div class="button">
        <OnBoardOptionLogo>
            {@render getIcon(icon)}
        </OnBoardOptionLogo>
        <Button fill secondary={!primary} {loading} {onClick}>
            <Translatable resourceKey={i18nKey(label)} />
        </Button>
    </div>
{/snippet}

<ModalContent fill hideFooter onClose={cancel}>
    {#snippet header()}
        <div class="header">
            <div class="logo-img">
                <FancyLoader loop={false} />
            </div>
            <div class="title">
                {#if step === "one-time-password"}
                    <Translatable resourceKey={i18nKey("native.auth.linkAccount.title")} />
                {:else}
                    <Translatable resourceKey={i18nKey("register.welcome")} />
                {/if}
                {#if step !== "one-time-password"}
                    <div class="strapline">
                        <Translatable resourceKey={i18nKey("loginDialog.strapline")} />
                    </div>
                {/if}
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if error || signUpError}
                <div class="error">
                    <Translatable
                        resourceKey={i18nKey(`native.auth.errors.${error ?? "default"}`)} />
                </div>
            {/if}
            {#if step === "choose-auth"}
                <div class="buttons">
                    {@render button(true, "native.auth.createAccount", "AccountPlus", newUser)}
                    {@render button(false, "native.auth.existingAccount", "Login", signIn)}
                </div>
            {:else if step === "new-user"}
                <SignUp {onCreatedUser} bind:error={signUpError} />
            {:else if step === "one-time-password"}
                <div class="alc-container">
                    <div class="title">
                        <Translatable resourceKey={i18nKey("native.auth.linkAccount.info")} />
                    </div>
                    <input
                        class="alc-input"
                        bind:value={accountLinkingCode}
                        bind:this={alcInput}
                        type="text"
                        maxlength="6"
                        pattern="[a-zA-Z0-9]{6}" />
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="alc" onclick={() => alcInput?.focus()}>
                        {#each [...Array(6).keys()] as key}
                            <div class="char {key === accountLinkingCode.length ? 'current' : ''}">
                                <span class="value">{accountLinkingCode[key] || ""}</span>
                            </div>
                        {/each}
                    </div>
                    {@render button(
                        true,
                        "native.auth.linkAccount.cta",
                        "LinkVariant",
                        linkAccount,
                        linkingInProgress,
                    )}
                    <div class="note">
                        <Translatable resourceKey={i18nKey("native.auth.linkAccount.note")} />
                    </div>
                </div>
            {/if}
        </div>
    {/snippet}
</ModalContent>

<div class="lang">
    <Select bind:value={selectedLocale}>
        {#each supportedLanguages as lang}
            <option value={lang.code}>{lang.name}</option>
        {/each}
    </Select>
</div>

<a class="logout" role="button" href="/" onclick={logout}>
    <Translatable resourceKey={i18nKey("logout")} />
</a>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: $sp4;
        padding-bottom: $sp6;
    }
    .header {
        display: flex;
        gap: $sp3;
        @include font(bold, normal, fs-130, 29);
        @include mobile() {
            @include font(bold, normal, fs-120, 29);
        }
        align-items: center;

        .logo-img {
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
            flex-direction: column;
            gap: $sp2;
        }
    }

    .lang {
        position: absolute;
        left: $sp3;
        top: $sp6;
    }

    .logout {
        @include font(light, normal, fs-90);
        cursor: pointer;
        position: absolute;
        top: $sp6;
        right: $sp3;
        color: #fff;
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
    }

    .button {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex: auto;
    }

    .buttons {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        max-width: 440px;
        width: 100%;
    }

    .alc-container {
        .alc {
            display: flex;
            padding: $sp6 0;
            gap: $sp4;
            justify-content: center;

            .char {
                display: flex;
                flex: 1;
                height: 5rem;
                justify-content: end;
                flex-direction: column;
                align-items: center;
                @include font(light, normal, fs-220);
                position: relative;
                overflow: hidden;

                &:after {
                    content: "";
                    display: block;
                    width: 100%;
                    height: 0.25rem;
                    border-radius: $sp2;
                    background-color: var(--primary);
                }
            }
        }

        .title {
            text-align: center;
        }

        .note {
            @include font(light, normal, fs-90);
            color: var(--txt-light);
            text-align: center;
            margin-top: $sp3;
        }

        .alc-input {
            height: 0;
            padding: 0;
            border: none;
            position: absolute;
            left: -2000px;
            &:focus + .alc > .char.current {
                &:before {
                    content: "";
                    display: block;
                    width: 1rem;
                    height: 1rem;
                    background-color: var(--primary);
                    position: absolute;
                    top: -0.75rem;
                    left: 50%;
                    transform: translateX(-50%) rotate(45deg);
                }
            }
        }
    }

    .error {
        @include font(book, normal, fs-90);
        background-color: var(--error);
        color: white;
        padding: $sp2 $sp4;
        width: 100%;
        margin-bottom: $sp4;
        border-radius: $sp2;
        padding: $sp3;
        text-align: center;
    }
</style>
