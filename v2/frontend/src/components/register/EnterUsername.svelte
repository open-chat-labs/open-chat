<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";
    export let error: string | undefined = undefined;

    let username: string = "";

    function submitUsername() {
        dispatch("submitUsername", { username: username });
    }

    $: valid = username.length >= 3;
</script>

<p class="enter-username">{$_("register.enterUsername")}</p>

<Input
    invalid={error !== undefined}
    autofocus={true}
    bind:value={username}
    minlength={3}
    maxlength={25}
    placeholder={$_("register.enterUsername")} />

{#if error}
    <h4 in:fade class="error">{$_(error)}</h4>
{/if}

<div class="actions">
    <Button disabled={!valid} on:click={submitUsername}>Create user</Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";

    .error {
        @include font(bold, normal, fs-140);
        color: var(--error);
        margin-bottom: $sp4;
    }

    .enter-username {
        @include font(light, normal, fs-100);
        margin-bottom: $sp5;
    }
</style>
