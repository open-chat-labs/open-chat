<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";
    import EnterPhoneNumber from "./EnterPhoneNumber.svelte";
    import Complete from "./Complete.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import EnterCode from "./EnterCode.svelte";
    import { registerState as state } from "../../stores/registerState";
    let bgClass: "underwater" | "sunset" = "underwater";

    $: error = $state.error?.message;

    $: {
        switch ($state.kind) {
            case "awaiting_completion":
                bgClass = "sunset";
                break;
            default:
                bgClass = "underwater";
        }
    }
</script>

<ModalPage {bgClass} minHeight="380px">
    {#if $state.kind === "awaiting_completion"}
        <Complete on:complete />
    {:else}
        <h4 class="subtitle">{$_("register.tellUsWho")}</h4>
        <Logo />
        <h1 class="title">
            {#if $state.kind === "awaiting_canister"}
                {$_("register.preparingUser")}
            {:else}
                {$_("register.registerAs")}
            {/if}
        </h1>

        {#if $state.kind === "awaiting_phone_number"}
            <EnterPhoneNumber {error} on:submitPhoneNumber />
        {:else if $state.kind === "awaiting_code"}
            <EnterCode
                phoneNumber={$state.phoneNumber}
                {error}
                on:submitCode
                on:resendCode
                on:changePhoneNumber />
        {:else if $state.kind === "verifying"}
            <div class="spinner" />
        {:else if $state.kind === "awaiting_username"}
            <EnterUsername {error} on:submitUsername />
        {/if}
    {/if}
</ModalPage>

<style type="text/scss">
    .spinner {
        height: 150px;
        width: 100%;
        @include loading-spinner(3em, 1.5em, false, var(--button-bg));
    }

    .subtitle {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp5;
        text-shadow: var(--modalPage-txt-sh);
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
