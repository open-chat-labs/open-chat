<!-- Asks before doing something that can't be undone from here (removing a link preview,
     accepting or cancelling a swap offer), as the old trees' AreYouSure did: what happens, then
     Cancel or the action. `disabled` holds the action back (say why in `message`). `busy`: the
     action is under way (its button spins, Cancel is off and nothing dismisses the dialog); `error`
     says inline that it failed, for another try (the freeze confirm's, logic/moderation's
     PendingAction).
     TODO(design): the design has no confirm dialog. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        title: string;
        message?: string;
        confirmLabel: string;
        /** The dismiss button; Cancel by default (name it when the action is itself a cancel). */
        cancelLabel?: string;
        disabled?: boolean;
        /** The action is under way: it spins, and nothing dismisses the dialog. */
        busy?: boolean;
        /** The action failed (shown above the buttons), for another try. */
        error?: string;
        onConfirm: () => void;
        onClose: () => void;
        /** More above the buttons (a "don't ask again" toggle, say). */
        children?: Snippet;
    }

    let {
        title,
        message,
        confirmLabel,
        cancelLabel,
        disabled = false,
        busy = false,
        error,
        onConfirm,
        onClose,
        children,
    }: Props = $props();
</script>

<DialogShell {title} width={400} height="auto" onClose={busy ? undefined : onClose}>
    {#if message}
        <p class="message">{message}</p>
    {/if}
    {#if children}
        <div class="extra">{@render children()}</div>
    {/if}
    {#if error !== undefined}
        <p class="error" role="alert">{error}</p>
    {/if}
    <div class="actions">
        <Button
            label={cancelLabel ?? $_("cancel")}
            variant="secondary"
            disabled={busy}
            onClick={onClose} />
        <Button label={confirmLabel} variant="danger" {disabled} {busy} onClick={onConfirm} />
    </div>
</DialogShell>

<style lang="scss">
    .message {
        margin: 0 0 var(--space-16);
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);
    }

    .extra {
        margin-bottom: var(--space-16);
    }

    .error {
        margin: 0 0 var(--space-16);
        font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--status-danger);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
