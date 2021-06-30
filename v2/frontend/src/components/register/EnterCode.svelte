<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";

    export let error: string | undefined = undefined;

    let codeValue: string = "";

    function submitCode() {
        dispatch("submitCode", { code: codeValue });
    }

    function resendCode() {
        dispatch("resendCode");
    }

    $: valid = codeValue.length !== 6;
</script>

<p class="enter-code">{$_("register.pleaseEnterCode")}</p>

<div class="code-wrapper">
    <Input
        invalid={error !== undefined}
        align="center"
        fontSize="large"
        autofocus={true}
        bind:value={codeValue}
        minlength={6}
        maxlength={6}
        placeholder={$_("register.enterCode")} />
</div>

{#if error}
    <h4 in:fade class="error">{$_(error)}</h4>
{/if}

<div class="actions">
    <Button disabled={!valid} on:click={submitCode}>{$_("register.validateCode")}</Button>
    <Button secondary={true} on:click={resendCode}>{$_("register.resendCode")}</Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";

    .error {
        @include font(bold, normal, fs-140);
        color: var(--error);
        margin-bottom: $sp4;
    }

    .enter-code {
        @include font(light, normal, fs-100);
        margin-bottom: $sp5;
    }

    .code-wrapper {
        max-width: 200px;
    }
</style>
