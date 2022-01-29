<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import Link from "../../Link.svelte";
    import Input from "../../Input.svelte";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import Footer from "./Footer.svelte";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { fade } from "svelte/transition";
    import "intl-tel-input/build/css/intlTelInput.css";
    import "intl-tel-input/build/js/utils";
    import intlTelInput, { Plugin } from "intl-tel-input";
    import { phoneNumberToString } from "../../../domain/user/user.utils";
    import type { PhoneNumber } from "../../../domain/user/user";

    const dispatch = createEventDispatcher();

    export let error: string | undefined = undefined;

    function cancel() {
        dispatch("cancel");
    }

    let phoneElement: HTMLInputElement;
    let phoneNumberStr: string = "";
    let countryCode = 44;
    let valid = false;
    let busy = false;
    let awaitingCode = false;
    let confirmed = false;
    let phoneNumber: PhoneNumber | undefined;
    let codeValue: string = "";

    let iti: Plugin;

    onMount(() => {
        iti = intlTelInput(phoneElement, {
            initialCountry: "gb",
            preferredCountries: [],
        });

        phoneElement.addEventListener("countrychange", () => {
            countryCode = parseInt(iti.getSelectedCountryData().dialCode, 10);
            valid = iti.isValidNumber();
        });

        phoneElement.addEventListener("input", () => {
            valid = iti.isValidNumber();
        });
    });

    onDestroy(() => iti?.destroy());

    function submitPhoneNumber() {
        if (valid) {
            phoneNumber = { countryCode, number: phoneNumberStr };
            dispatch("submitPhoneNumber", phoneNumber);
            busy = true;
            window.setTimeout(() => {
                busy = false;
                awaitingCode = true;
            }, 2000);
        }
    }

    function submitCode() {
        busy = true;
        window.setTimeout(() => {
            busy = false;
            confirmed = true;
        }, 2000);
    }

    function resendCode() {
        busy = true;
        window.setTimeout(() => {
            busy = false;
        }, 2000);
    }

    function changePhoneNumber() {
        awaitingCode = false;
    }
</script>

<div class="body">
    {#if busy}
        <Loading size={"large"} />
    {:else if confirmed}
        <Congratulations />
    {:else if awaitingCode && phoneNumber !== undefined}
        <h3 class="title">
            {$_("register.pleaseEnterCode")}
        </h3>

        <p class="enter-code">
            <span>
                {$_("register.enterCodeSentTo")}
            </span>
            <span class="change-phone-number">{phoneNumberToString(phoneNumber)}</span>
            <span>
                <Link underline={"always"} on:click={changePhoneNumber}>({$_("change")})</Link>
            </span>
        </p>

        <form class="code-wrapper" on:submit|preventDefault={submitCode}>
            <Input
                invalid={error !== undefined}
                align="center"
                fontSize="large"
                autofocus={true}
                bind:value={codeValue}
                minlength={6}
                maxlength={6}
                placeholder={$_("register.enterCode")} />
        </form>

        {#if error}
            <h4 in:fade class="error">{$_(error)}</h4>
        {/if}
    {:else}
        <h3 class="title">
            {$_("register.enterPhone")}
        </h3>
        <form class="phone-number" on:submit|preventDefault={submitPhoneNumber}>
            <div class="number">
                <input
                    autofocus={true}
                    minlength={3}
                    maxlength={25}
                    class="textbox"
                    bind:value={phoneNumberStr}
                    bind:this={phoneElement}
                    type="tel" />
            </div>
        </form>
        {#if error}
            <h4 in:fade class="error">{$_(error)}</h4>
        {/if}
    {/if}
</div>
<Footer>
    {#if confirmed}
        <Button small={true} on:click={cancel}>{$_("close")}</Button>
    {:else if awaitingCode}
        <Button disabled={!valid || busy} on:click={submitCode}
            >{$_("register.validateCode")}</Button>
        <Button disabled={busy} secondary={true} on:click={resendCode}
            >{$_("register.resendCode")}</Button>
        <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
    {:else}
        <Button disabled={!valid || busy} loading={busy} on:click={submitPhoneNumber}>
            {$_("register.requestCode")}
        </Button>
        <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
    {/if}
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;
        height: 200px;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .error {
        @include font(bold, normal, fs-100);
        color: var(--error);
        margin-bottom: $sp4;
    }

    .phone-number {
        display: flex;
        .number {
            flex: 4;
            margin-bottom: $sp5;
            text-align: center;

            @include size-below(xs) {
                margin-bottom: $sp4;
            }
        }

        @include size-below(xs) {
            flex-wrap: wrap;
            .number {
                flex-basis: 100%;
            }
        }
    }

    .textbox {
        display: block;
        width: 100%;
        height: 40px;
        line-height: 24px;
        @include font(book, normal, fs-100);
        color: var(--input-txt);
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        outline: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: $sp2;
    }

    .title {
        @include font(bold, normal, fs-120);
        margin: $sp4 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }

    .enter-code {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
        text-align: center;
    }

    .change-phone-number {
        @include font(bold, normal, fs-100);
    }

    .code-wrapper {
        max-width: 200px;
        margin: auto;
    }
</style>
