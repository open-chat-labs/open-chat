<script lang="ts">
    import QRScanner from "@src/core/QRScanner.svelte";

    interface Props {
        autoscan?: boolean;
        onData: (data: string) => void;
    }

    let { autoscan = false, onData }: Props = $props();

    let scanner: QRScanner | undefined = $state();

    export function scan() {
        scanner?.scan();
    }
</script>

<!-- the scanner itself is every tree's (core/QRScanner); this frames it -->
<div class="scanner">
    <QRScanner bind:this={scanner} {autoscan} {onData} />
</div>

<style lang="scss">
    .scanner {
        --qr-scanner-max-height: 300px;
        margin-bottom: $sp4;
        border: 4px dashed var(--bd);
        border-radius: $sp4;
        overflow: hidden;
        width: 100%;

        &:has(:global(canvas[hidden])) {
            display: none;
        }

        :global(.qr-scanner) {
            width: 100%;
        }
    }
</style>
