<script lang="ts">
    import Button from "../Button.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ServiceContainer } from "../../services/serviceContainer";

    export let api: ServiceContainer;
    export let error: string | undefined = undefined;
    export let validUsername: string | undefined = undefined;

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
        {api}
        bind:validUsername={validUsername}
        bind:checking={checkingUsername}
        bind:error={error} />
</form>

{#if error}
    <h4 in:fade class="error">{$_(error)}</h4>
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
    .error {
        @include font(bold, normal, fs-100);
        color: var(--error);
    }

    .enter-username {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }
    .username-wrapper {
        width: 80%;
        @include size-below(xs) {
            width: 100%;
        }
    }
    .actions {
        margin-top: auto;
    }
</style>
