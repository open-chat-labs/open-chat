<!-- Asks before doing something that can't be undone from here (removing a link preview,
     accepting or cancelling a swap offer), as the old trees' AreYouSure did: what happens, then
     Cancel or the action. `disabled` holds the action back (say why in `message`).
     TODO(design): the design has no confirm dialog. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        title: string;
        message?: string;
        confirmLabel: string;
        disabled?: boolean;
        onConfirm: () => void;
        onClose: () => void;
    }

    let { title, message, confirmLabel, disabled = false, onConfirm, onClose }: Props = $props();
</script>

<DialogShell {title} width={400} height="auto" {onClose}>
    {#if message}
        <p class="message">{message}</p>
    {/if}
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
        <Button label={confirmLabel} variant="danger" {disabled} onClick={onConfirm} />
    </div>
</DialogShell>

<style>
    .message {
        margin: 0 0 var(--space-16);
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
