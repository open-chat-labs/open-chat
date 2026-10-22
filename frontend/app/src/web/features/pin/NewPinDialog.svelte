<!-- Choosing a new PIN once the user has signed in again (Forgot PIN), as the old SetPinNumberModal
     shows it then: the new PIN, why saving it failed, Cancel and Change pin. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { _ } from "svelte-i18n";
    import PinField from "./PinField.svelte";

    interface Props {
        /** Translated: why the last save failed. */
        error: string | undefined;
        canSave: boolean;
        onInput: (pin: string) => void;
        onSave: () => void;
        onClose: () => void;
    }

    let { error, canSave, onInput, onSave, onClose }: Props = $props();
</script>

<!-- TODO(design): no Set PIN dialog in the design (GAPS.md) -->
<DialogShell title={$_("pinNumber.changePinTitle")} width={360} height="auto" {onClose}>
    <div class="pin">
        <span class="label">{$_("pinNumber.newPin")}</span>
        <PinField label={$_("pinNumber.newPin")} {onInput} />
        {#if error !== undefined}
            <span class="error" role="alert">{error}</span>
        {/if}
        <div class="actions">
            <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
            <Button label={$_("pinNumber.changePin")} disabled={!canSave} onClick={onSave} />
        </div>
    </div>
</DialogShell>

<style>
    .pin {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
    }

    .label {
        font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--ink-2);
    }

    .error {
        font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--status-danger);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-10);
        margin-block-start: var(--space-4);
    }
</style>
