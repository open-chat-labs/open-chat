<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Link from "../../Link.svelte";
    import Input from "../../Input.svelte";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import Footer from "./Footer.svelte";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import "intl-tel-input/build/css/intlTelInput.css";
    import "intl-tel-input/build/js/utils";
    import intlTelInput, { Plugin } from "intl-tel-input";
    import { phoneNumberToString } from "../../../domain/user/user.utils";
    import type { CreatedUser, PhoneNumber } from "../../../domain/user/user";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import { rollbar } from "../../../utils/logging";
    import { updateStorageLimit } from "stores/storage";

    const dispatch = createEventDispatcher();
    export let api: ServiceContainer;
    export let user: CreatedUser;

    function cancel() {
        dispatch("cancel");
    }

    let error: string | undefined = undefined;
    let phoneElement: HTMLInputElement;
    let phoneNumberStr: string = "";
    let countryCode = 44;
    let valid = false;
    let busy = false;
    let awaitingCode = user.phoneStatus.kind === "unconfirmed";
    let confirmed = false;
    let phoneNumber: PhoneNumber | undefined;
    let codeValue: string = "";

    let iti: Plugin;

    $: codeValid = codeValue.length === 6;

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

        // if we have already submitted our phone number recently, skip straight to waiting for the code
        if (user.phoneStatus.kind === "unconfirmed" && user.phoneStatus.validUntil > Date.now()) {
            phoneNumber = user.phoneStatus.phoneNumber;
            awaitingCode = true;
        }
    });

    onDestroy(() => iti?.destroy());

    function submitPhoneNumber() {
        if (valid) {
            phoneNumber = { countryCode, number: phoneNumberStr };

            busy = true;
            api.submitPhoneNumber(phoneNumber)
                .then((resp) => {
                    if (resp === "already_registered") {
                        error = "register.phoneAlreadyRegistered";
                    } else if (resp === "already_registered_by_other") {
                        error = "register.phoneAlreadyRegisteredByAnother";
                    } else if (resp === "invalid_phone_number") {
                        error = "register.phoneInvalid";
                    } else if (resp === "user_not_found") {
                        error = "register.userNotFound";
                    } else if (resp === "success") {
                        error = undefined;
                        awaitingCode = true;
                    }
                })
                .catch((err) => {
                    rollbar.error("Error submitting phone number: ", err);
                })
                .finally(() => (busy = false));
        }
    }

    function submitCode() {
        busy = true;
        api.confirmPhoneNumber(codeValue)
            .then((resp) => {
                if (resp.kind === "already_claimed") {
                    error = "register.confirmAlreadyClaimed";
                } else if (resp.kind === "code_expired") {
                    error = "register.codeExpired";
                } else if (resp.kind === "code_incorrect") {
                    error = "register.codeIncorrect";
                } else if (resp.kind === "not_found") {
                    error = "register.codeNotFound";
                } else if (resp.kind === "success") {
                    error = undefined;
                    confirmed = true;
                    updateStorageLimit(resp.storageLimitBytes);
                }
            })
            .catch((err) => {
                rollbar.error("Error submitting sms code: ", err);
            })
            .finally(() => (busy = false));
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
                bind:value={codeValue}
                minlength={6}
                maxlength={6}
                placeholder={$_("register.enterCode")} />
        </form>

        {#if error}
            <ErrorMessage>{$_(error)}</ErrorMessage>
        {/if}
    {:else}
        <h3 class="title">
            {$_("register.enterPhone")}
        </h3>
        <form class="phone-number" on:submit|preventDefault={submitPhoneNumber}>
            <div class="number">
                <input
                    minlength={3}
                    maxlength={25}
                    class="textbox"
                    bind:value={phoneNumberStr}
                    bind:this={phoneElement}
                    type="tel" />
            </div>
        </form>
        {#if error}
            <ErrorMessage>{$_(error)}</ErrorMessage>
        {/if}
    {/if}
</div>
<Footer>
    {#if confirmed}
        <Button small={true} on:click={cancel}>{$_("close")}</Button>
    {:else if awaitingCode}
        <Button small={true} disabled={!codeValid || busy} on:click={submitCode}
            >{$_("register.validateCode")}</Button>
        <Button small={true} disabled={busy} secondary={true} on:click={resendCode}
            >{$_("register.resendCode")}</Button>
        <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
    {:else}
        <Button small={true} disabled={!valid || busy} loading={busy} on:click={submitPhoneNumber}>
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
        text-align: center;
    }

    .phone-number {
        display: flex;
        .number {
            flex: 4;
            margin-bottom: $sp5;

            @include mobile() {
                margin-bottom: $sp4;
            }
        }

        @include mobile() {
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
        text-shadow: var(--modalPage-txt-sh);
    }

    .enter-code {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }

    .change-phone-number {
        @include font(bold, normal, fs-100);
    }

    .code-wrapper {
        max-width: 200px;
        margin: auto;
    }
</style>
