<script lang="ts">
    import { locale } from "svelte-i18n";
    import { setLocale, supportedLanguages } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Toast from "../Toast.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { writable, type Writable } from "svelte/store";
    import type { CreatedUser, OpenChat } from "openchat-client";
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Legend from "../Legend.svelte";
    import GuidelinesContent from "../landingpages/GuidelinesContent.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import DisplayNameInput from "../DisplayNameInput.svelte";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    type Spinning = { kind: "spinning" };
    type AwaitingUsername = { kind: "awaiting_username" };

    type RegisterState = Spinning | AwaitingUsername;

    let state: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    let error: Writable<string | undefined> = writable(undefined);
    let usernameStore: Writable<string | undefined> = writable(undefined);
    let displayNameStore: Writable<string | undefined> = writable(undefined);
    let createdUser: CreatedUser | undefined = undefined;
    let closed: boolean = false;
    let showGuidelines = false;
    let username = "";
    let usernameValid = false;
    let displayName: string | undefined = undefined;
    let displayNameValid = false;
    let checkingUsername: boolean;
    let badCode = false;

    function clearCodeAndRegister() {
        client.clearReferralCode();
        register();
    }

    function clearCodeAndLogout() {
        client.clearReferralCode();
        client.logout();
    }

    function register() {
        if (usernameValid && displayNameValid) {
            usernameStore.set(username);
            displayNameStore.set(displayName);
            // TODO: Ask user for a display name
            registerUser(username, displayName);
        }
    }

    function registerUser(username: string, displayName: string | undefined): void {
        state.set({ kind: "spinning" });
        client.registerUser(username, displayName).then((resp) => {
            badCode = false;
            state.set({ kind: "awaiting_username" });
            if (resp.kind === "username_taken") {
                error.set("register.usernameTaken");
            } else if (resp.kind === "username_too_short") {
                error.set("register.usernameTooShort");
            } else if (resp.kind === "username_too_long") {
                error.set("register.usernameTooLong");
            } else if (resp.kind === "username_invalid") {
                error.set("register.usernameInvalid");
            } else if (resp.kind === "display_name_too_short") {
                error.set("register.displayNameTooShort");
            } else if (resp.kind === "display_name_too_long") {
                error.set("register.displayNameTooLong");
            } else if (resp.kind === "display_name_invalid") {
                error.set("register.displayNameInvalid");
            } else if (resp.kind === "user_limit_reached") {
                error.set("register.userLimitReached");
            } else if (resp.kind === "internal_error") {
                error.set("unexpectedError");
            } else if (resp.kind === "referral_code_invalid") {
                error.set("register.referralCodeInvalid");
                badCode = true;
            } else if (resp.kind === "referral_code_already_claimed") {
                error.set("register.referralCodeAlreadyClaimed");
                badCode = true;
            } else if (resp.kind === "referral_code_expired") {
                error.set("register.referralCodeExpired");
                badCode = true;
            } else if (resp.kind === "success") {
                error.set(undefined);
                createdUser = {
                    kind: "created_user",
                    username,
                    displayName,
                    cryptoAccount: resp.icpAccount,
                    userId: resp.userId,
                    canisterUpgradeStatus: "not_required",
                    referrals: [],
                    isPlatformModerator: false,
                    suspensionDetails: undefined,
                    isSuspectedBot: false,
                    diamondStatus: { kind: "inactive" },
                    moderationFlagsEnabled: 0,
                };
                dispatch("createdUser", createdUser);
            }
        });
    }

    let selectedLocale = ($locale as string).substring(0, 2);
    $: {
        setLocale(selectedLocale);
    }

    $: busy = $state.kind === "spinning";
</script>

{#if showGuidelines}
    <Overlay on:close={() => (showGuidelines = false)} dismissible>
        <ModalContent large on:close={() => (showGuidelines = false)} closeIcon>
            <span class="header" slot="header">
                <h1>OpenChat guidelines</h1>
            </span>
            <span class="guidelines-modal" slot="body">
                <GuidelinesContent modal />
            </span>
        </ModalContent>
    </Overlay>
{/if}

<ModalContent compactFooter on:close>
    <div class="header" slot="header">
        <div class="subtitle">
            <div class="logo" />
            {#if closed}
                <h4>{$_("register.closedTitle")}</h4>
            {:else if badCode}
                <h4>{$_("register.invalidCode")}</h4>
            {:else}
                <h4>{$_("register.title")}</h4>
            {/if}
        </div>
    </div>
    <div class="body" slot="body">
        {#if closed}
            <div class="closed">
                <h4>{$_("register.closed")}</h4>
            </div>
        {:else if badCode}
            <div class="bad-code">
                <img class="shirt" src="/assets/miami/miami_shirt.png" alt="Miami shirt" />
                <div class="message">
                    <h4 class="invalid">{$_("register.referralCodeInvalid")}</h4>
                    <p>{$_("register.doYouWantToProceed")}</p>
                </div>
            </div>
        {:else}
            <form class="username-wrapper" on:submit|preventDefault={register}>
                <Legend label={$_("username")} rules={$_("usernameRules")} />
                <UsernameInput
                    {client}
                    disabled={busy}
                    originalUsername={$usernameStore ?? ""}
                    bind:username
                    bind:usernameValid
                    bind:checking={checkingUsername}
                    bind:error={$error} />

                <Legend label={$_("displayName")} rules={$_("displayNameRules")} />
                <DisplayNameInput
                    {client}
                    originalDisplayName={$displayNameStore}
                    disabled={busy}
                    bind:displayName
                    bind:displayNameValid />
            </form>

            {#if $error}
                <ErrorMessage>{$_($error)}</ErrorMessage>
            {/if}
            <div on:click={() => (showGuidelines = true)} class="smallprint">
                {$_("register.disclaimer")}
            </div>
        {/if}
    </div>
    <div class="footer" slot="footer">
        {#if closed}
            <Button on:click={() => (window.location.href = "/home")}>{$_("home")}</Button>
        {:else if badCode}
            <ButtonGroup>
                <Button secondary on:click={clearCodeAndLogout}>{$_("cancel")}</Button>
                <Button
                    loading={checkingUsername || busy}
                    disabled={!usernameValid || !displayNameValid || busy}
                    on:click={clearCodeAndRegister}>{$_("register.proceed")}</Button>
            </ButtonGroup>
        {:else}
            <Button
                loading={checkingUsername || busy}
                disabled={!usernameValid || !displayNameValid || busy}
                on:click={register}>
                {$_("register.createUser")}
            </Button>
        {/if}
    </div>
</ModalContent>

<a
    class="logout"
    role="button"
    href="/"
    on:click|preventDefault|stopPropagation={() => dispatch("logout")}>
    {$_("logout")}
</a>

<div class="lang">
    <Select bind:value={selectedLocale}>
        {#each supportedLanguages as lang}
            <option value={lang.code}>{lang.name}</option>
        {/each}
    </Select>
</div>

<Toast />

<style lang="scss">
    :global(.guidelines-modal .card .header:not(.open) .arrow path) {
        fill: var(--txt);
    }
    :global(.lang select.select) {
        @include font(light, normal, fs-90);
        background-color: transparent;
        padding: 0;
        min-width: 80px;
        height: auto;
        border: none;
        border-bottom: 1px solid var(--accent);
        color: #fff;

        option {
            @include font(light, normal, fs-90);
        }
    }
    .header,
    .body {
        color: var(--txt);
    }
    .lang {
        position: absolute;
        left: $sp3;
        top: $sp3;
    }
    .logout {
        @include font(light, normal, fs-90);
        cursor: pointer;
        position: absolute;
        top: $sp3;
        right: $sp3;
        color: #fff;
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        @media (hover: hover) {
            &:hover {
                text-decoration-thickness: 2px;
            }
        }
    }

    .subtitle {
        display: flex;
        align-items: center;
        gap: $sp4;
        @include font(bold, normal, fs-120);

        .logo {
            background-image: url("/assets/spinner.svg");
            width: toRem(30);
            height: toRem(30);
        }
    }

    .bad-code {
        display: flex;
        gap: $sp5;
        .shirt {
            height: 200px;
        }
        .invalid {
            margin-bottom: $sp4;
        }
    }

    .closed {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: $sp5;
        flex: auto;
    }

    .username-wrapper {
        margin-bottom: $sp6;
        width: 80%;
        @include mobile() {
            width: 100%;
        }
    }

    .smallprint {
        @include font(light, normal, fs-60);
        color: var(--primary);
        cursor: pointer;
        text-decoration: none;

        @media (hover: hover) {
            &:hover {
                text-decoration: underline;
            }
        }
    }
</style>
