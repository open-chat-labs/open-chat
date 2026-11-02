<!-- Send's QR scanner (6d): the camera reads an address's QR code (core/QRScanner, every tree's
     scanner), which fills Send's address. -->
<script lang="ts">
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import QRScanner from "@src/core/QRScanner.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        onScan: (data: string) => void;
        onClose: () => void;
    }

    let { onScan, onClose }: Props = $props();

    let failed = $state(false);
</script>

<!-- TODO(design): no QR scanner in the design (GAPS.md); built from DialogShell -->
<DialogShell title={$_("cryptoAccount.scan")} width={440} height="auto" {onClose}>
    <div class="scan">
        {#if failed}
            <p class="note error" role="alert">{$_("cryptoAccount.cameraUnavailable")}</p>
        {:else}
            <div class="frame">
                <QRScanner autoscan onData={onScan} onError={() => (failed = true)} />
            </div>
            <p class="note">{$_("cryptoAccount.scanHint")}</p>
        {/if}
    </div>
</DialogShell>

<style>
    .scan {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-12);
    }

    .frame {
        --qr-scanner-max-height: 320px;
        width: 100%;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--overlay-1);
    }

    .note {
        margin: 0;
        font: var(--text-sm) / 1.4 var(--font-sans);
        color: var(--ink-3);
        text-align: center;
    }

    .error {
        color: var(--status-danger);
    }
</style>
