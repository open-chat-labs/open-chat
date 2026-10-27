<script lang="ts">
    import CoreQRCode from "@src/core/QRCode.svelte";
    import { Spinner } from "component-lib";

    interface Props {
        text: string;
        size?: "default" | "smaller" | "larger";
        border?: boolean;
        logo?: string | undefined;
        fullWidthOnMobile?: boolean;
    }

    let {
        text,
        size = "default",
        border = false,
        logo = undefined,
        fullWidthOnMobile = false,
    }: Props = $props();
</script>

<div class="qr-wrapper" class:border>
    <div
        class="qr"
        class:smaller={size === "smaller"}
        class:larger={size === "larger"}
        class:full-width-on-mobile={fullWidthOnMobile}>
        <!-- the QR code itself is every tree's (core/QRCode); this sizes and frames it -->
        <CoreQRCode {text} {logo}>
            {#snippet loading()}<Spinner size="2em" />{/snippet}
        </CoreQRCode>
    </div>
</div>

<style lang="scss">
    .qr-wrapper {
        padding: $sp5;
        display: flex;
        justify-content: center;
        width: 100%;
        height: 100%;
        position: relative;

        &.border {
            border: 1px solid var(--bd);
        }
    }

    .qr {
        width: 200px;
        height: 200px;
        border-radius: 4px;
        overflow: hidden;

        &.smaller {
            width: 150px;
            height: 150px;
        }

        &.larger {
            width: 250px;
            height: 250px;
        }

        &.full-width-on-mobile {
            width: 100%;
            height: auto;
            margin: 0;
        }
    }
</style>
