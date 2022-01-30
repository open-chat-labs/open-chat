<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import { createEventDispatcher } from "svelte";
    import Footer from "./Footer.svelte";
    import { ONE_GB, storageInMb, storageStore } from "../../../stores/storage";
    import Loading from "../../Loading.svelte";
    import Congratulations from "./Congratulations.svelte";
    import QR from "svelte-qr";
    import { toastStore } from "../../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../../stores/iconSize";

    const dispatch = createEventDispatcher();

    let range: HTMLInputElement;
    let amount: number = 0.1;
    let account: string = "lkasd64aadkadlkjasd;lkja;dasd;jsdlkjlKSDflkjdflkjsdf;";
    let confirming = false;
    let confirmed = false;
    let accountSummary = account;

    $: min = Math.ceil($storageStore.byteLimit / 100_000_000);
    $: max = Math.ceil(ONE_GB / 100_000_000);
    $: newLimit = min;
    $: toPay = (newLimit - min) * amount;
    $: {
        if (account.length > 20) {
            accountSummary = account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
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
        window.setTimeout(() => {
            confirmed = true;
            confirming = false;
        }, 2000);
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(account).then(
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
                <QR text={account} />
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
                    {max}
                    value={newLimit}
                    on:input={changeLimit} />
            </div>
        </div>

        <div class="new-limit">
            {$_("newLimit", {
                values: { limit: (newLimit === 10 ? "1GB" : `${newLimit * 100}MB`).toString() },
            })}
        </div>

        <p class="para">
            {$_("currentLimit", { values: { limit: $storageInMb.mbLimit.toString() } })}
        </p>

        <p class="para">
            {$_("pleaseDeposit", {
                values: { amount: toPay.toFixed(2).toString() },
            })}
        </p>

        <!-- TODO - how to buy ICP link 
                    <a
                    class="how-to"
                    href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                    target="_blank">
                    {$_("howToBuyICP")}
                </a> -->
    {/if}
</div>
<Footer>
    {#if confirmed}
        <Button small={true} on:click={cancel}>{$_("close")}</Button>
    {:else}
        <Button
            disabled={confirming || toPay === 0}
            loading={confirming}
            on:click={confirm}
            small={true}>{$_("register.confirmed")}</Button>
        <Button disabled={confirming} small={true} secondary={true} on:click={cancel}
            >{$_("cancel")}</Button>
    {/if}
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;
        height: 390px;
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

    .confirmed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;

        h1 {
            @include font(bold, normal, fs-160);
            margin-bottom: $sp4;
        }

        .tada {
            @include font-size(fs-220);
            margin-bottom: $sp4;
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
</style>
