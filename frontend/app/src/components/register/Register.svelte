<script lang="ts">
    import { locale } from "svelte-i18n";
    import { setLocale, supportedLanguages } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Toast from "../Toast.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { writable, Writable } from "svelte/store";
    import type { CreatedUser, OpenChat } from "openchat-client";
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Legend from "../Legend.svelte";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    type Spinning = { kind: "spinning" };
    type AwaitingUsername = { kind: "awaiting_username" };

    type RegisterState = Spinning | AwaitingUsername;

    let state: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    let error: Writable<string | undefined> = writable(undefined);
    let username: Writable<string | undefined> = writable(undefined);
    let createdUser: CreatedUser | undefined = undefined;
    let closed: boolean = false;

    let validUsername: string | undefined = undefined;
    let checkingUsername: boolean;

    function submitUsername() {
        if (validUsername !== undefined) {
            username.set(validUsername);
            registerUser(validUsername);
        }
    }

    function registerUser(username: string): void {
        state.set({ kind: "spinning" });
        client.registerUser(username).then((resp) => {
            state.set({ kind: "awaiting_username" });
            if (resp === "username_taken") {
                error.set("register.usernameTaken");
            } else if (resp === "username_too_short") {
                error.set("register.usernameTooShort");
            } else if (resp === "username_too_long") {
                error.set("register.usernameTooLong");
            } else if (resp === "username_invalid") {
                error.set("register.usernameInvalid");
            } else if (resp === "user_limit_reached") {
                error.set("register.userLimitReached");
            } else if (resp === "internal_error") {
                error.set("unexpectedError");
            } else if (resp === "success") {
                error.set(undefined);
                loadUser();
            }
        });
    }

    function loadUser(): void {
        state.set({ kind: "spinning" });
        client.getCurrentUser().then((resp) => {
            if (resp.kind === "created_user") {
                createdUser = resp;
                dispatch("createdUser", createdUser);
            }
        });
    }

    let selectedLocale = ($locale as string).substring(0, 2);
    $: {
        setLocale(selectedLocale);
    }

    $: busy = $state.kind === "spinning";

    function showGuidelines() {
        dispatch("showGuidelines");
    }
</script>

<ModalContent compactFooter on:close>
    <div class="header" slot="header">
        {#if closed}
            <div class="subtitle">
                <div class="logo" />
                <h4>{$_("register.closedTitle")}</h4>
            </div>
        {:else}
            <div class="subtitle">
                <div class="logo" />
                <h4>{$_("register.enterUsername")}</h4>
            </div>
        {/if}
    </div>
    <div class="body" slot="body">
        {#if closed}
            <div class="closed">
                <h4>{$_("register.closed")}</h4>
            </div>
        {:else}
            <Legend label={$_("username")} rules={$_("usernameRules")} />
            <form class="username-wrapper" on:submit|preventDefault={submitUsername}>
                <UsernameInput
                    {client}
                    disabled={busy}
                    bind:originalUsername={$username}
                    bind:validUsername
                    bind:checking={checkingUsername}
                    bind:error={$error} />
            </form>

            {#if $error}
                <ErrorMessage>{$_($error)}</ErrorMessage>
            {/if}
            <div on:click={showGuidelines} class="smallprint">
                {$_("register.disclaimer")}
            </div>
        {/if}
    </div>
    <div class="footer" slot="footer">
        {#if closed}
            <Button on:click={() => (window.location.href = "/home")}>{$_("home")}</Button>
        {:else}
            <Button
                loading={checkingUsername || busy}
                disabled={validUsername === undefined || busy}
                on:click={submitUsername}>
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

<style type="text/scss">
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
    .spinner {
        margin-top: auto;
        margin-bottom: auto;
        width: 100%;
        @include loading-spinner(5em, 2.5em, var(--button-bg));
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
        &:hover {
            text-decoration-thickness: 2px;
        }
    }

    .subtitle {
        display: flex;
        align-items: center;
        gap: $sp4;
        @include font(bold, normal, fs-160);

        .logo {
            background-image: url("../assets/spinner.svg");
            width: toRem(30);
            height: toRem(30);
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

        &:hover {
            text-decoration: underline;
        }
    }
</style>
