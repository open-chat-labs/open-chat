<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";
    export let invalid = false;

    let username: string = "";

    function submitUsername() {
        dispatch("submitUsername", { username: username });
    }

    $: valid = username.length >= 3;
</script>

{#if invalid}
    <p class="enter-username">{$_("register.usernameInvalid")}</p>
{:else}
    <p class="enter-username">{$_("register.enterUsername")}</p>
{/if}

<Input
    {invalid}
    autofocus={true}
    bind:value={username}
    minlength={3}
    maxlength={25}
    placeholder={$_("register.enterUsername")} />
<div class="actions">
    <Button disabled={!valid} on:click={submitUsername}>Create user</Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";

    .enter-username {
        margin-bottom: $sp5;
    }
</style>
