<script lang="ts">
    import { QRCodeImage } from "svelte-qrcode-image";

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
        <QRCodeImage {text} errorCorrectionLevel="Q" margin={2} displayClass="qr-code-image" />
        {#if logo !== undefined}
            <img class="icon" src={logo} />
        {/if}
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

        .icon {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #fff;
            padding: 4px;
            height: 35px;
            width: 35px;
            border-radius: 4px;
        }

        :global(.qr-code-image) {
            width: 100%;
            height: 100%;
        }

        &.smaller {
            width: 150px;
            height: 150px;
            .icon {
                height: 30px;
                width: 30px;
            }
        }

        &.larger {
            width: 250px;
            height: 250px;
            .icon {
                height: 45px;
                width: 45px;
            }
        }

        &.full-width-on-mobile {
            @include mobile() {
                width: 100%;
                height: auto;
                margin: 0;
            }
        }
    }
</style>
