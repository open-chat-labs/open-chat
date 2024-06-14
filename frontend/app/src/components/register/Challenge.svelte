<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Input from "../Input.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import type { Challenge } from "openchat-client";

    const dispatch = createEventDispatcher();

    export let error: string | undefined = undefined;
    export let challenge: Challenge | undefined = undefined;

    let chars = "";

    function confirm() {
        if (challenge !== undefined && valid) {
            dispatch("confirm", {
                key: challenge.key,
                chars,
            });
        }
    }

    function cancel() {
        dispatch("cancel");
    }

    $: valid = chars.length == 5;
</script>

<p class="attempt_challenge">{$_("register.attemptChallenge")}</p>

<div class="captcha">
    {#if challenge !== undefined}
        <img alt="captcha" src={`data:image/png;base64, ${challenge.pngBase64}`} />
    {/if}
</div>

<form class="chars-wrapper" on:submit|preventDefault={confirm}>
    <Input
        invalid={error !== undefined}
        autofocus={true}
        bind:value={chars}
        minlength={5}
        maxlength={5} />
</form>

{#if error}
    <h4 in:fade class="error">{$_(error)}</h4>
{/if}

<div class="actions">
    <ButtonGroup align={"fill"}>
        <Button disabled={!valid} on:click={confirm}>{$_("register.confirm")}</Button>
        <Button secondary={true} on:click={cancel}>{$_("cancel")}</Button>
    </ButtonGroup>
</div>

<style lang="scss">
    .captcha {
        display: flex;
        justify-content: center;
        margin-bottom: $sp4;
        height: 120px;
    }
    .error {
        @include font(bold, normal, fs-100);
        color: var(--error);
        margin-bottom: $sp4;
    }
    .attempt_challenge {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }
    .chars-wrapper {
        width: 80%;
        @include size-below(xs) {
            width: 100%;
        }
    }
    .actions {
        margin-top: auto;
    }
</style>
