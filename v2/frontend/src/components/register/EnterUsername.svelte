<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";
    import type { RegistrationState } from "../../domain/user/user";
    export let error: string | undefined = undefined;
    export let username: string = "";
    export let regState: RegistrationState;

    function submitUsername() {
        if (valid) {
            dispatch("submitUsername", { username: username.trim() });
        }
    }

    $: valid = username.length >= 3;
</script>

{#if regState.kind === "phone_registration"}
    <h3 class="title">
        {$_("register.codeAccepted")}
    </h3>
{:else if regState.kind === "currency_registration"}
    <h3 class="title">
        {#if regState.fee.kind === "cycles_registration_fee"}
            {$_("register.cyclesTransferred", { values: { fee: regState.fee.amount.toString() } })}
        {:else}
            {$_("register.icpTransferred", {
                values: { fee: (Number(regState.fee.amount) / 100_000_000).toString() },
            })}
        {/if}
    </h3>
{/if}

<p class="enter-username">{$_("register.usernameRules")}</p>

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
        @include font(bold, normal, fs-100);
        color: var(--error);
        margin-bottom: $sp4;
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
    .title {
        @include font(bold, normal, fs-160);
        margin: $sp4 0 0 0;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
