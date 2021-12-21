<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";
    import EnterPhoneNumber from "./EnterPhoneNumber.svelte";
    import Complete from "./Complete.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import EnterCode from "./EnterCode.svelte";
    import type { RegisterState } from "../../fsm/register.controller";
    import { createEventDispatcher } from "svelte";
    import Link from "../Link.svelte";
    import ChoosePath from "./ChoosePath.svelte";
    import ConfirmTransfer from "./ConfirmTransfer.svelte";
    import { iconSize } from "../../stores/iconSize";
    import HoverIcon from "../HoverIcon.svelte";

    const dispatch = createEventDispatcher();

    export let state: RegisterState;
    export let username: string = "";
    export let error: string | undefined = undefined;
    let bgClass: "underwater" | "sunset" = "underwater";
    $: {
        switch (state.kind) {
            case "awaiting_canister":
            case "awaiting_completion":
                bgClass = "sunset";
                break;
            default:
                bgClass = "underwater";
        }
    }

    $: canGoBack =
        state.kind === "awaiting_phone_number" ||
        state.kind === "awaiting_transfer_confirmation" ||
        state.kind === "awaiting_code";
</script>

<ModalPage {bgClass} minHeight="380px">
    {#if state.kind === "awaiting_completion"}
        <Complete on:complete />
    {:else}
        {#if canGoBack}
            <div class="back" title={$_("register.goBack")} on:click={() => dispatch("reset")}>
                <ArrowLeft size={"1.2em"} color={"var(--modalPage-txt"} />
            </div>
        {/if}
        <h4 class="subtitle">{$_("register.registerUser")}</h4>
        <Logo />
        {#if state.kind === "awaiting_canister"}
            <h3 class="title">
                {$_("register.preparingUser")}
            </h3>
        {:else if state.kind === "choose_registration_path"}
            <ChoosePath on:choosePhoneVerification on:chooseTransfer />
        {:else if state.kind === "awaiting_transfer_confirmation"}
            <ConfirmTransfer on:transferConfirmed amount={state.amount} />
        {/if}

        {#if state.kind === "awaiting_phone_number"}
            <EnterPhoneNumber {error} on:submitPhoneNumber />
        {:else if state.kind === "awaiting_code"}
            <EnterCode
                phoneNumber={state.phoneNumber}
                {error}
                on:submitCode
                on:resendCode
                on:changePhoneNumber />
        {:else if state.kind === "verifying"}
            <div class="spinner" />
        {:else if state.kind === "awaiting_canister"}
            <div class="spinner" />
        {:else if state.kind === "awaiting_username"}
            <EnterUsername {username} {error} on:submitUsername />
        {/if}
    {/if}
</ModalPage>

<div class="logout">
    <Link underline="always" on:click={() => dispatch("logout")}>
        {$_("logout")}
    </Link>
</div>

<style type="text/scss">
    .spinner {
        height: 150px;
        width: 100%;
        @include loading-spinner(3em, 1.5em, false, var(--button-bg));
    }

    .logout {
        @include font(light, normal, fs-90);
        position: absolute;
        top: $sp3;
        right: $sp3;
    }

    .subtitle {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp4;
        text-shadow: var(--modalPage-txt-sh);
    }

    .back {
        padding: 1px;
        border-radius: 50%;
        border: 1px solid var(--modalPage-txt);
        position: absolute;
        top: $sp4;
        left: $sp4;
        width: $sp5;
        height: $sp5;
        cursor: pointer;
    }

    .title {
        @include font(bold, normal, fs-160);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
