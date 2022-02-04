<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../Button.svelte";
    import { fade } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { toastStore } from "../../stores/toast";
    import QR from "svelte-qr";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";

    export let amount: bigint | number;
    export let adviceKey: string;
    export let receiver: string;
    export let error: string | undefined = undefined;

    let receiverSummary = receiver;

    const dispatch = createEventDispatcher();

    $: {
        if (receiver.length > 20) {
            receiverSummary = receiver.slice(0, 10) + "..." + receiver.slice(receiver.length - 10);
        }
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(receiver).then(
            () => {
                toastStore.showSuccessToast("copiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("failedToCopyToClipboard");
            }
        );
    }
</script>

<h3 class="title">
    {$_("register.confirmTransfer")}
</h3>

<p class="options">
    {$_(adviceKey, {
        values: { amount: amount.toString() },
    })}
</p>
{#if $screenWidth !== ScreenWidth.ExtraSmall}
    <div class="qr">
        <QR text={receiver} />
    </div>
{/if}
<div class="receiver">
    <div class="account">
        {receiverSummary}
    </div>
    <div class="copy" title={$_("copyToClipboard")} on:click={copyToClipboard}>
        <ContentCopy size={$iconSize} color={"#555"} />
    </div>
</div>

<slot />

{#if error}
    <h4 in:fade class="error">{$_(error)}</h4>
{/if}

<div class="cta">
    <Button on:click={() => dispatch("transferConfirmed")}>
        {$_("register.confirm")}
    </Button>
</div>

<style type="text/scss">
    .options {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }

    .qr {
        width: 120px;
        height: 120px;
        margin-bottom: $sp4;
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
        margin-bottom: $sp4;
    }

    .title {
        @include font(bold, normal, fs-160);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }

    .cta {
        margin-top: auto;
    }

    .error {
        @include font(bold, normal, fs-100);
        color: var(--error);
        margin-bottom: $sp4;
    }
</style>
