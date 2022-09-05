<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import Toast from "../Toast.svelte";
    import ModalPage from "../ModalPage.svelte";
    import Complete from "./Complete.svelte";
    import ChallengeComponent from "./Challenge.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import type { ChallengeAttempt, CreatedUser, Challenge } from "../../domain/user/user";
    import { createEventDispatcher, onMount } from "svelte";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import { writable, Writable } from "svelte/store";

    const dispatch = createEventDispatcher();

    type Spinning = { kind: "spinning" };
    type AwaitingUsername = { kind: "awaiting_username" };
    type AwaitingChallengeAttempt = { kind: "awaiting_challenge_attempt" };

    type RegisterState = Spinning | AwaitingUsername | AwaitingChallengeAttempt;

    export let api: ServiceContainer;
    export let referredBy: string | undefined;

    let state: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    let error: Writable<string | undefined> = writable(undefined);
    let username: Writable<string | undefined> = writable(undefined);
    let challenge: Writable<Challenge | undefined> = writable(undefined);
    let challengeAttempt: ChallengeAttempt | undefined = undefined;
    let createdUser: CreatedUser | undefined = undefined;

    onMount(() => {
        createChallenge();
    });

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        username.set(ev.detail.username);

        if (challengeAttempt !== undefined) {
            // The user already has an untried challenge attempt so call register_user
            registerUser(ev.detail.username, challengeAttempt, referredBy);
        } else if ($challenge === undefined) {
            // The challenge isn't ready yet so wait...
            state.set({ kind: "spinning" });
        } else {
            // The challenge is ready so goto the "challenge" panel.
            state.set({ kind: "awaiting_challenge_attempt" });
        }
    }

    function registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): void {
        state.set({ kind: "spinning" });
        api.registerUser(username, challengeAttempt, referredBy).then((resp) => {
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
        api.createChallenge().then((challengeResponse) => {
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
        api.getCurrentUser().then((resp) => {
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
            registerUser($username, challengeAttempt, referredBy);
        } else {
            // The username has not been set so goto the "username" panel.
            state.set({ kind: "awaiting_username" });
        }
    }

    function cancelChallenge() {
        challengeAttempt = undefined;
        state.set({ kind: "awaiting_username" });
    }
</script>

<ModalPage minHeight="380px">
    {#if $state.kind === "spinning"}
        <div class="spinner" />
    {:else if $state.kind === "awaiting_challenge_attempt"}
        <ChallengeComponent
            challenge={$challenge}
            error={$error}
            on:confirm={confirmChallenge}
            on:cancel={cancelChallenge} />
    {:else}
        <h4 class="subtitle">{$_("register.registerUser")}</h4>
        <div class="logo">
            <Logo />
        </div>
        <EnterUsername
            {api}
            originalUsername={$username}
            error={$error}
            on:submitUsername={submitUsername} />
    {/if}
</ModalPage>

<a
    class="logout"
    role="button"
    href="/#"
    on:click|preventDefault|stopPropagation={() => dispatch("logout")}>
    {$_("logout")}
</a>

<Toast />

<style type="text/scss">
    .logo {
        margin-bottom: $sp4;
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
        @include font(bold, normal, fs-140);
        margin-bottom: $sp4;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
