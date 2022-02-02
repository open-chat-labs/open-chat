<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import { createEventDispatcher } from "svelte";
    import Footer from "./Footer.svelte";
    import { ONE_GB, storageInGb, storageStore } from "../../../stores/storage";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import QR from "svelte-qr";
    import { toastStore } from "../../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { CreatedUser } from "../../../domain/user/user";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import { E8S_PER_ICP } from "../../../domain/user/user";

    const dispatch = createEventDispatcher();
    const decimals = 1;

    export let api: ServiceContainer;
    export let user: CreatedUser;

    let error: string | undefined = undefined;
    let range: HTMLInputElement;
    let icpPrice: number = 0.1; // storage price in ICP per 1/10th of a GB
    let confirming = false;
    let confirmed = false;
    let refreshing = false;
    let accountSummary = user.billingAccount;

    $: icpBalance = user.accountCredite8s / E8S_PER_ICP; //balance in the user's account expressed as ICP
    $: min = Math.ceil(($storageStore.byteLimit / ONE_GB) * 10); //the min bound expressed as number of 1/10 GB units
    $: newLimit = min;
    $: toPay = (newLimit - min) * icpPrice;
    $: insufficientFunds = toPay - icpBalance > 0.0001; //we need to account for the fact that js cannot do maths
    $: {
        if (user.billingAccount.length > 20) {
            accountSummary =
                user.billingAccount.slice(0, 10) +
                "..." +
                user.billingAccount.slice(user.billingAccount.length - 10);
        }
    }

    $: console.log($storageStore);

    function refreshBalance() {}

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

        const newLimitBytes = (newLimit * ONE_GB) / 10;

        api.upgradeStorage(newLimitBytes)
            .then((resp) => {
                console.log("Notify: ", resp);
                if (resp.kind === "success" || resp.kind === "success_no_change") {
                    // todo - update the user's balance
                    // todo - update the user's storage limit
                    // todo - display errors
                    error = undefined;
                    confirmed = true;
                } else {
                    error = "register.unableToConfirmFee";
                }
            })
            .finally(() => (confirming = false));
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(user.billingAccount).then(
            () => {
                toastStore.showSuccessToast("copiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("failedToCopyToClipboard");
            }
        );
    }
</script>

<div class="body" class:is-confirmed={confirmed}>
    {#if confirming}
        <Loading size={"large"} />
    {:else if confirmed}
        <Congratulations />
    {:else}
        <div class="account-info">
            <div class="qr">
                <QR text={user.billingAccount} />
            </div>
            <div class="receiver">
                <div class="account">
                    {accountSummary}
                </div>
                <div class="copy" title={$_("copyToClipboard")} on:click={copyToClipboard}>
                    <ContentCopy size={$iconSize} color={"#555"} />
                </div>
            </div>
        </div>

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
                    balance: icpBalance.toFixed(decimals),
                    limit: $storageInGb.gbLimit.toFixed(decimals),
                },
            })}
        </p>

        <p class="para">
            {#if toPay === 0}
                {$_("noChangeToStorage")}
            {:else if insufficientFunds}
                {$_("insufficientFunds", {
                    values: { amount: toPay.toFixed(decimals) },
                })}
            {:else}
                {$_("pleaseDeposit", {
                    values: { amount: toPay.toFixed(decimals), limit: `${newLimit / 10}GB` },
                })}
            {/if}
        </p>
    {/if}
</div>
<Footer>
    {#if confirmed}
        <Button small={true} on:click={cancel}>{$_("close")}</Button>
    {:else}
        <a
            class="how-to"
            href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
            target="_blank">
            {$_("howToBuyICP")}
        </a>
        {#if insufficientFunds}
            <Button
                disabled={refreshing}
                loading={refreshing}
                on:click={refreshBalance}
                small={true}>{$_("refresh")}</Button>
        {:else}
            <Button
                disabled={confirming || toPay === 0}
                loading={confirming}
                on:click={confirm}
                small={true}>{$_("register.confirmed")}</Button>
        {/if}
        <Button disabled={confirming} small={true} secondary={true} on:click={cancel}
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

    .qr {
        background-color: #fff;
        width: 140px;
        height: 140px;
    }

    .account-info {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .receiver {
        display: flex;
        align-items: center;
        .account {
            @include ellipsis();
            @include font(book, normal, fs-80);
            width: 200px;
        }

        .copy {
            cursor: pointer;
            width: 30px;
        }
        margin: $sp4 0;
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
