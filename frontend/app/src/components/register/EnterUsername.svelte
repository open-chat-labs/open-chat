<script lang="ts">
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import Legend from "../Legend.svelte";

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

<Legend label={$_("username")} rules={$_("usernameRules")} />
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

<style lang="scss">
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
