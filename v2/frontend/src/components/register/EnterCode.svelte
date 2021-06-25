<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";

    export let invalid = false;

    let codeValue: string = "";

    function submitCode() {
        dispatch("submitCode", { code: parseInt(codeValue, 10) });
    }

    $: codeNumber = parseInt(codeValue.replace(/\D/g, ""), 10);
    $: valid = !isNaN(codeNumber);
</script>

{#if invalid}
    <p class="enter-code">{$_("register.codeInvalid")}</p>
{:else}
    <p class="enter-code">{$_("register.pleaseEnterCode")}</p>
{/if}

<div class="code-wrapper">
    <Input
        {invalid}
        align="center"
        fontSize="large"
        autofocus={true}
        bind:value={codeValue}
        minlength={6}
        maxlength={6}
        placeholder={$_("register.enterCode")} />
</div>

<div class="actions">
    <Button disabled={!valid} on:click={submitCode}>{$_("register.validateCode")}</Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";

    .enter-code {
        margin-bottom: $sp5;
    }

    .code-wrapper {
        max-width: 200px;
    }
</style>
