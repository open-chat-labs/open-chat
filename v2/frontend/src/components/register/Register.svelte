<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import Toast from "../Toast.svelte";
    import ModalPage from "../ModalPage.svelte";
    import EnterPhoneNumber from "./EnterPhoneNumber.svelte";
    import Complete from "./Complete.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import EnterCode from "./EnterCode.svelte";
    import type { RegisterState } from "../../fsm/register.controller";
    import { createEventDispatcher } from "svelte";
    import ChoosePath from "./ChoosePath.svelte";
    import ConfirmTransfer from "./ConfirmTransfer.svelte";
    import { E8S_PER_ICP } from "../../domain/user/user";

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
        state.kind === "awaiting_cycles_transfer_confirmation" ||
        state.kind === "awaiting_icp_transfer_confirmation" ||
        state.kind === "awaiting_code";
</script>

<ModalPage {bgClass} minHeight="380px">
    {#if state.kind === "verifying" || state.kind === "awaiting_canister"}
        <div class="spinner" />
    {:else if state.kind === "awaiting_completion"}
        <Complete on:complete />
    {:else}
        {#if canGoBack}
            <div class="back" title={$_("register.goBack")} on:click={() => dispatch("reset")}>
                <ArrowLeft size={"1.2em"} color={"var(--modalPage-txt"} />
            </div>
        {/if}
        <h4 class="subtitle">{$_("register.registerUser")}</h4>
        <div class="logo">
            <Logo />
        </div>
        {#if state.kind === "choose_registration_path"}
            <ChoosePath on:choosePhoneVerification on:chooseTransfer />
        {:else if state.kind === "awaiting_cycles_transfer_confirmation"}
            <ConfirmTransfer
                {error}
                on:transferConfirmed={() => dispatch("cyclesTransferConfirmed")}
                amount={state.amount}
                adviceKey={"register.confirmCyclesTransferText"}
                receiver={"process.env.USER_INDEX_CANISTER"} />
        {:else if state.kind === "awaiting_icp_transfer_confirmation"}
            <ConfirmTransfer
                {error}
                on:transferConfirmed={() => dispatch("icpTransferConfirmed")}
                adviceKey={"register.confirmICPTransferText"}
                receiver={state.receiver}
                amount={Number(state.amount) / E8S_PER_ICP}>
                <a
                    class="how-to"
                    href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                    target="_blank">
                    {$_("howToBuyICP")}
                </a>
            </ConfirmTransfer>
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
        {:else if state.kind === "awaiting_username"}
            <EnterUsername {username} {error} on:submitUsername />
        {/if}
    {/if}
</ModalPage>

<a
    class="logout"
    role="button"
    href="/#"
    on:click|preventDefault|stopPropagation={() => dispatch("logout")}>
    {$_("logout")}
</a>

<Toast />

<style type="text/scss">
    .logo {
        margin-bottom: $sp4;
    }
    .spinner {
        margin-top: auto;
        margin-bottom: auto;
        width: 100%;
        @include loading-spinner(5em, 2.5em, false, var(--button-bg));
    }

    .how-to {
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
        margin-bottom: $sp4;
    }

    .logout {
        @include font(light, normal, fs-90);
        cursor: pointer;
        position: absolute;
        top: $sp3;
        right: $sp3;
        color: #fff;
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        &:hover {
            text-decoration-thickness: 2px;
        }
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
</style>
