<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import Toast from "../Toast.svelte";
    import ModalPage from "../ModalPage.svelte";
    import Complete from "./Complete.svelte";
    import Challenge from "./Challenge.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import type { RegisterController } from "../../fsm/register.controller";
    import type { IdentityController } from "../../fsm/identity.controller";
    import type { ChallengeAttempt } from "../../domain/user/user";

    export let controller: RegisterController;
    export let identityController: IdentityController;

    $: state = controller.state;
    $: username = controller.username;
    $: error = controller.error;
    $: challenge = controller.challenge;

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        controller.submitUsername(ev.detail.username);
    }

    function confirmChallenge(ev: CustomEvent<ChallengeAttempt>) {
        controller.submitChallengeAttempt(ev.detail);
    }

    function cancelChallenge() {
        controller.cancelChallengeAttempt();
    }

    function complete() {
        controller.complete();
    }

    let bgClass: "underwater" | "sunset" = "underwater";
    $: {
        switch ($state.kind) {
            case "awaiting_completion":
                bgClass = "sunset";
                break;
            default:
                bgClass = "underwater";
        }
    }
</script>

<ModalPage {bgClass} minHeight="380px">
    {#if $state.kind === "spinning"}
        <div class="spinner" />
    {:else if $state.kind === "awaiting_completion"}
        <Complete on:complete={complete} />
    {:else if $state.kind === "awaiting_challenge_attempt"}
        <Challenge
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
            api={controller.api()}
            originalUsername={$username}
            error={$error}
            on:submitUsername={submitUsername} />
    {/if}
</ModalPage>

<a
    class="logout"
    role="button"
    href="/#"
    on:click|preventDefault|stopPropagation={() => identityController.logout()}>
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
        @include loading-spinner(5em, 2.5em, false, var(--button-bg));
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
