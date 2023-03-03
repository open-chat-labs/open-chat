<script lang="ts">
    import { locale } from "svelte-i18n";
    import { setLocale, supportedLanguages } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Toast from "../Toast.svelte";
    import ChallengeComponent from "./Challenge.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { writable, Writable } from "svelte/store";
    import type { Challenge, ChallengeAttempt, CreatedUser, OpenChat } from "openchat-client";
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import ModalContent from "../ModalContent.svelte";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    type Spinning = { kind: "spinning" };
    type AwaitingUsername = { kind: "awaiting_username" };
    type AwaitingChallengeAttempt = { kind: "awaiting_challenge_attempt" };

    type RegisterState = Spinning | AwaitingUsername | AwaitingChallengeAttempt;

    let state: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    let error: Writable<string | undefined> = writable(undefined);
    let username: Writable<string | undefined> = writable(undefined);
    let challenge: Writable<Challenge | undefined> = writable(undefined);
    let challengeAttempt: ChallengeAttempt | undefined = undefined;
    let createdUser: CreatedUser | undefined = undefined;
    let closed: boolean = false;

    onMount(() => {
        createChallenge();
    });

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        username.set(ev.detail.username);

        if (challengeAttempt !== undefined) {
            // The user already has an untried challenge attempt so call register_user
            registerUser(ev.detail.username, challengeAttempt);
        } else if ($challenge === undefined) {
            // The challenge isn't ready yet so wait...
            state.set({ kind: "spinning" });
        } else {
            // The challenge is ready so goto the "challenge" panel.
            state.set({ kind: "awaiting_challenge_attempt" });
        }
    }

    function registerUser(username: string, challengeAttempt: ChallengeAttempt): void {
        state.set({ kind: "spinning" });
        client.registerUser(username, challengeAttempt).then((resp) => {
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
            } else if (resp === "challenge_failed") {
                error.set("register.challengeAttemptFailed");
                createChallenge();
            } else if (resp === "internal_error") {
                error.set("unexpectedError");
            } else if (resp === "success") {
                error.set(undefined);
                loadUser();
            }
        });
    }

    function createChallenge(): void {
        state.set({ kind: "spinning" });
        challenge.set(undefined);
        challengeAttempt = undefined;
        client.createChallenge().then((challengeResponse) => {
            if (challengeResponse.kind === "challenge") {
                challenge.set(challengeResponse);
                if ($username !== undefined) {
                    // The user has submitted a username so goto the "challenge" panel.
                    state.set({ kind: "awaiting_challenge_attempt" });
                } else {
                    // The user has not submitted a username so goto the "username" panel.
                    state.set({ kind: "awaiting_username" });
                }
            } else {
                // Creating a new challenge has failed.
                // Goto the "username" panel and show the error message.
                error.set("register.challengeThrottled");
                state.set({ kind: "awaiting_username" });
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

    function confirmChallenge(ev: CustomEvent<ChallengeAttempt>) {
        challengeAttempt = ev.detail;
        challenge.set(undefined);
        if ($username !== undefined) {
            // The username has been entered so try to register the user.
            registerUser($username, challengeAttempt);
        } else {
            // The username has not been set so goto the "username" panel.
            state.set({ kind: "awaiting_username" });
        }
    }

    function cancelChallenge() {
        challengeAttempt = undefined;
        state.set({ kind: "awaiting_username" });
    }

    let selectedLocale = ($locale as string).substring(0, 2);
    $: {
        setLocale(selectedLocale);
    }
</script>

<ModalContent hideFooter hideHeader fill on:close>
    <div class="body" slot="body">
        {#if closed}
            <div class="closed">
                <div class="subtitle">
                    <div class="logo" />
                    <h4>{$_("register.closedTitle")}</h4>
                </div>
                <h4>{$_("register.closed")}</h4>
                <Button on:click={() => (window.location.href = "/home")}>{$_("home")}</Button>
            </div>
        {:else if $state.kind === "spinning"}
            <div class="spinner" />
        {:else if $state.kind === "awaiting_challenge_attempt"}
            <ChallengeComponent
                challenge={$challenge}
                error={$error}
                on:confirm={confirmChallenge}
                on:cancel={cancelChallenge} />
        {:else}
            <div class="subtitle">
                <div class="logo" />
                <h4>{$_("register.registerUser")}</h4>
            </div>
            <EnterUsername
                {client}
                originalUsername={$username}
                error={$error}
                on:submitUsername={submitUsername} />
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
        margin-bottom: $sp5;

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

    .body {
        padding: $sp5 $sp6;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        text-align: center;
        align-items: center;
        min-height: 250px;
        color: var(--txt);
    }
</style>
