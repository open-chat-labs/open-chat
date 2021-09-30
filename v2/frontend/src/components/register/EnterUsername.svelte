<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";
    export let error: string | undefined = undefined;
    export let username: string = "";

    function submitUsername() {
        if (valid) {
<<<<<<< Updated upstream
            dispatch("submitUsername", { username: username });
=======
            dispatch("submitUsername", { username: username.trim() });
>>>>>>> Stashed changes
        }
    }

    $: valid = username.length >= 3;
</script>

<p class="enter-username">{$_("register.enterUsername")}</p>

<form class="username-wrapper" on:submit|preventDefault={submitUsername}>
    <Input
        invalid={error !== undefined}
        autofocus={true}
        bind:value={username}
        minlength={3}
        maxlength={25}
        countdown={true}
        placeholder={$_("register.enterUsername")} />
</form>

{#if error}
    <h4 in:fade class="error">{$_(error)}</h4>
{/if}

<div class="actions">
    <Button disabled={!valid} on:click={submitUsername}>{$_("register.createUser")}</Button>
</div>

<style type="text/scss">
    .error {
        @include font(bold, normal, fs-140);
        color: var(--error);
        margin-bottom: $sp4;
    }

    .enter-username {
        @include font(light, normal, fs-100);
        margin-bottom: $sp5;
    }
    .username-wrapper {
        width: 80%;
        @include size-below(xs) {
            width: 100%;
        }
    }
</style>
