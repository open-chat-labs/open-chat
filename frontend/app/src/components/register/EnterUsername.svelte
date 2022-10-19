<script lang="ts">
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";

    export let client: OpenChat;
    export let error: string | undefined = undefined;
    export let originalUsername: string | undefined = undefined;

    let validUsername: string | undefined = undefined;
    let checkingUsername: boolean;

    const dispatch = createEventDispatcher();

    function submitUsername() {
        if (validUsername !== undefined) {
            dispatch("submitUsername", { username: validUsername });
        }
    }
</script>

<p class="enter-username">{$_("register.usernameRules")}</p>

<form class="username-wrapper" on:submit|preventDefault={submitUsername}>
    <UsernameInput
        {client}
        {originalUsername}
        bind:validUsername
        bind:checking={checkingUsername}
        bind:error />
</form>

{#if error}
    <ErrorMessage>{$_(error)}</ErrorMessage>
{/if}

<div class="actions">
    <Button
        loading={checkingUsername}
        disabled={validUsername === undefined}
        on:click={submitUsername}>
        {$_("register.createUser")}
    </Button>
</div>

<style type="text/scss">
    .enter-username {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }
    .username-wrapper {
        width: 80%;
        @include mobile() {
            width: 100%;
        }
    }
    .actions {
        margin-top: auto;
    }
</style>
