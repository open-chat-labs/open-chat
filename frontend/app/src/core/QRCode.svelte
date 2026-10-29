<!-- A QR code for some text, drawn by svelte-qrcode-image (loaded when first shown), filling its
     container, with an optional logo in the middle. Every tree's QR code is this: the desktop and
     mobile wrappers add their own size and border, the web wallet's Receive shows it in its card. -->
<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        text: string;
        logo?: string;
        /** Shown while the QR library loads. */
        loading?: Snippet;
    }

    let { text, logo, loading }: Props = $props();
</script>

<div class="qr">
    {#await import("svelte-qrcode-image")}
        <div class="loading" aria-busy="true">{@render loading?.()}</div>
    {:then { QRCodeImage }}
        <QRCodeImage {text} errorCorrectionLevel="Q" margin={2} displayClass="qr-code-image" />
    {:catch}
        <p class="failed">Unable to load QR code</p>
    {/await}
    {#if logo}
        <img class="logo" src={logo} alt="" />
    {/if}
</div>

<style>
    .qr {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .qr :global(.qr-code-image) {
        display: block;
        width: 100%;
        height: 100%;
    }

    .loading {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .logo {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18%;
        height: 18%;
        padding: 4px;
        border-radius: 4px;
        background-color: #fff;
        box-sizing: content-box;
    }

    .failed {
        margin: 0;
        font-size: 0.8em;
    }
</style>
