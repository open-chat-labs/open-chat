<script lang="ts">
    import Button from "../Button.svelte";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { _ } from "svelte-i18n";
    import "intl-tel-input/build/css/intlTelInput.css";
    import "intl-tel-input/build/js/utils";
    import intlTelInput, { Plugin } from "intl-tel-input";

    const dispatch = createEventDispatcher();
    export let error: string | undefined = undefined;

    let phoneElement: HTMLInputElement;
    let phoneNumberStr: string = "";
    let countryCode = 1;
    let valid = false;

    let iti: Plugin;

    onMount(() => {
        iti = intlTelInput(phoneElement, {
            preferredCountries: ["us", "gb", "cn"],
            separateDialCode: true,
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
            dispatch("submitPhoneNumber", { countryCode, number: phoneNumberStr });
        }
    }
</script>

<p class="enter-phone">{$_("register.enterPhone")}</p>

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

<div class="actions">
    <Button disabled={!valid} on:click={submitPhoneNumber}>
        {$_("register.requestCode")}
    </Button>
</div>

<style type="text/scss">
    .error {
        @include font(bold, normal, fs-140);
        color: var(--error);
        margin-bottom: $sp4;
    }

    .phone-number {
        display: flex;
        .country {
            flex: 2;
            margin-right: $sp3;

            &.rtl {
                margin-right: 0;
                margin-left: $sp3;
            }
        }
        .number {
            flex: 4;
            margin-bottom: $sp4;

            @include size-below(xs) {
                margin-bottom: $sp3;
            }
        }

        @include size-below(xs) {
            flex-wrap: wrap;
            .country {
                flex-basis: 100%;
                margin-right: 0;
            }
            .number {
                flex-basis: 100%;
            }
        }
    }

    .enter-phone {
        @include font(light, normal, fs-100);
        margin-bottom: $sp5;
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
</style>
