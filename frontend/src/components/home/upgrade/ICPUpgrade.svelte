<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import Footer from "./Footer.svelte";
    import { ONE_GB, storageInGb, storageStore, updateStorageLimit } from "../../../stores/storage";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import type { CreatedUser } from "../../../domain/user/user";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import { Cryptocurrency, cryptoLookup, E8S_PER_TOKEN } from "../../../domain/crypto";
    import { rollbar } from "utils/logging";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";

    const dispatch = createEventDispatcher();
    const icpDecimals = 2;
    const icpPrice: number = 0.1; // storage price in ICP per 1/10th of a GB

    export let api: ServiceContainer;
    export let user: CreatedUser;

    let error: string | undefined = undefined;
    let range: HTMLInputElement;
    let confirming = false;
    let confirmed = false;
    let refreshing = false;
    let accountBalance = 0;

    const symbol = "ICP";
    const token: Cryptocurrency = "icp";

    $: icpBalance = accountBalance / E8S_PER_TOKEN; //balance in the user's account expressed as ICP
    $: min = Math.ceil(($storageStore.byteLimit / ONE_GB) * 10); //the min bound expressed as number of 1/10 GB units
    $: newLimit = min;
    $: toPay = (newLimit - min) * icpPrice;
    $: insufficientFunds = toPay - icpBalance > 0.0001; //we need to account for the fact that js cannot do maths
    $: howToBuyUrl = cryptoLookup[token].howToBuyUrl;

    onMount(refreshBalance);

    function refreshBalance() {
        refreshing = true;
        error = undefined;
        api.refreshAccountBalance("icp", user.cryptoAccount)
            .then((resp) => {
                accountBalance = Number(resp.e8s);
                error = undefined;
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
    }

    function cancel() {
        dispatch("cancel");
    }

    function changeLimit(e: Event) {
        const num = Number(range.value);
        if (num < min) {
            (e.target as HTMLInputElement).value = min.toString();
            newLimit = min;
            e.preventDefault();
            return false;
        }
        newLimit = num;
    }

    function confirm() {
        confirming = true;
        error = undefined;

        const newLimitBytes = Math.floor((newLimit * ONE_GB) / 10);

        api.upgradeStorage(newLimitBytes)
            .then((resp) => {
                console.log("Notify: ", resp);
                if (resp.kind === "success" || resp.kind === "success_no_change") {
                    refreshBalance();
                    updateStorageLimit(newLimitBytes);
                    error = undefined;
                    confirmed = true;
                } else {
                    error = "register.unableToConfirmFee";
                    rollbar.error("Unable to upgrade storage", resp);
                }
            })
            .catch((err) => {
                error = "register.unableToConfirmFee";
                rollbar.error("Unable to upgrade storage", err);
            })
            .finally(() => (confirming = false));
    }
</script>

<div class="body" class:confirming class:is-confirmed={confirmed}>
    {#if confirming}
        <Loading size={"large"} />
    {:else if confirmed}
        <Congratulations />
    {:else}
        <AccountInfo {user} />

        <p class="choose">
            {$_("chooseAStorageLevel")}
        </p>

        <div class="slider">
            <div class="range">
                <input
                    class="range-input"
                    bind:this={range}
                    type="range"
                    min={0}
                    max={10}
                    value={newLimit}
                    on:input={changeLimit} />
            </div>
        </div>

        <div class="new-limit">
            {$_("newLimit", {
                values: { limit: `${newLimit / 10}GB` },
            })}
        </div>

        <p class="para">
            {$_("currentLimit", {
                values: {
                    balance: icpBalance.toFixed(icpDecimals),
                    limit: $storageInGb.gbLimit.toFixed(1),
                },
            })}
        </p>

        <p class="para">
            {#if toPay === 0}
                {$_("noChangeToStorage")}
            {:else if insufficientFunds}
                {$_("insufficientFunds", {
                    values: { amount: toPay.toFixed(icpDecimals) },
                })}
            {:else}
                {$_("pleaseDeposit", {
                    values: { amount: toPay.toFixed(icpDecimals), limit: `${newLimit / 10}GB` },
                })}
            {/if}
        </p>

        {#if error}
            <ErrorMessage>{$_(error)}</ErrorMessage>
        {/if}
    {/if}
</div>
<Footer align={$mobileWidth ? "center" : "end"}>
    {#if confirmed}
        <Button small={true} on:click={cancel}>{$_("close")}</Button>
    {:else}
        {#if !$mobileWidth}
            <a class="how-to" href={howToBuyUrl} target="_blank">
                {$_("howToBuyToken", { values: { token: symbol } })}
            </a>
        {/if}
        {#if insufficientFunds}
            <Button disabled={refreshing} loading={refreshing} on:click={refreshBalance} tiny={true}
                >{$_("refresh")}</Button>
        {:else}
            <Button
                disabled={confirming || toPay === 0}
                loading={confirming}
                on:click={confirm}
                tiny={true}>{$_("register.confirm")}</Button>
        {/if}
        <Button disabled={confirming} tiny={true} secondary={true} on:click={cancel}
            >{$_("cancel")}</Button>
    {/if}
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;
        min-height: 390px;
        transition: height 200ms ease-in-out;

        &.is-confirmed {
            height: 240px;
        }

        &.confirming {
            height: 390px;
        }
    }
    .slider {
        display: flex;
        width: 100%;
        @include font(light, normal, fs-60);

        .range {
            flex: auto;
        }

        .range-input {
            width: 100%;
        }
    }

    .new-limit {
        @include font(light, normal, fs-70);
        margin-bottom: $sp3;
    }

    .choose {
        @include font(light, italic, fs-70);
    }

    .para {
        margin-bottom: $sp3;
    }

    .how-to {
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
        position: absolute;
        left: $sp4;
        bottom: $sp4;
    }
</style>
