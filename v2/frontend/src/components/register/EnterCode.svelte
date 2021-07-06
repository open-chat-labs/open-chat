<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";
    import { phoneNumberToString } from "../../domain/user";
    import type { PhoneNumber } from "../../domain/user";
    import Link from "../Link.svelte";

    export let phoneNumber: PhoneNumber;
    export let error: string | undefined = undefined;

    let codeValue: string = "";

    function submitCode() {
        dispatch("submitCode", { code: codeValue });
    }

    function resendCode() {
        dispatch("resendCode");
    }

    function changePhoneNumber() {
        dispatch("changePhoneNumber");
    }

    $: valid = codeValue.length === 6;
</script>

<p class="enter-code">
    <span>
        {$_("register.enterCodeSentTo")}
    </span>
    <span class="phone-number">{phoneNumberToString(phoneNumber)}</span>
    <span>
        <Link underline={true} on:click={changePhoneNumber}>({$_("change")})</Link>
    </span>
</p>

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
    .actions {
        display: flex;
        gap: 10px;
    }

    .error {
        @include font(bold, normal, fs-140);
        color: var(--error);
        margin-bottom: $sp4;
    }

    .enter-code {
        @include font(light, normal, fs-100);
        margin-bottom: $sp5;
    }

    .phone-number {
        @include font(bold, normal, fs-100);
    }

    .code-wrapper {
        max-width: 200px;
    }

    a {
        text-decoration: underline;
        text-decoration-color: var(--link-underline);
        text-underline-offset: $sp2;
        cursor: pointer;
        &:hover {
            text-decoration-thickness: 2px;
        }
    }
</style>
