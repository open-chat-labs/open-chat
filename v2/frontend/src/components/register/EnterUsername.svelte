<script lang="ts">
    import Button from "../Button.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";

    let inp: HTMLInputElement;
    let username: string = "";
    onMount(() => inp.focus());

    function submitUsername() {
        dispatch("submitUsername", { username: username });
    }

    $: usernameInvalid = username.length < 3;
</script>

<p>Enter user name</p>
<input
    minlength={6}
    maxlength={6}
    placeholder="choose a username"
    bind:this={inp}
    class="reg-code"
    bind:value={username} />
<div class="actions">
    <Button disabled={usernameInvalid} on:click={submitUsername}
        >Create user</Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";
</style>
