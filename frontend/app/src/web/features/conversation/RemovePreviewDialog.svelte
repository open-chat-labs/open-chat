<!-- Confirms removing a link preview from the sender's own message, as the old trees' AreYouSure
     did. TODO(design): the design has no confirm for it. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        onConfirm: () => void;
        onClose: () => void;
    }

    let { onConfirm, onClose }: Props = $props();
</script>

<DialogShell title={$_("removePreviewQuestion")} width={360} height="auto" {onClose}>
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
        <Button label={$_("remove")} variant="danger" onClick={onConfirm} />
    </div>
</DialogShell>

<style>
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
