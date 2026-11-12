<!-- A platform moderator confirming freezing a group or a community (L6), from any of the
     freeze items (the chat menus, the community menu): what freezing stops, an optional reason
     (who sees it is freezeConfirmText's hint), then Cancel or Freeze. Freeze spins and the dialog
     stays, with nothing dismissing it, until the backend answers (PendingAction): a success closes
     it and says so in a toast ("{name} has been frozen") whose Undo unfreezes, in a pending toast
     ("Unfreezing {name}…", then how it went), as a suspension's; a failure says so inline, the
     reason kept, for another try.
     TODO(design): the design has no freeze confirm; ConfirmDialog, as Delete message's, with a
     reason field as the suspend dialog's. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import TextArea from "@openchat/ui/src/lib/components/TextArea.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import {
        FREEZE_REASON_MAX_LENGTH,
        freeze as freezeTarget,
        freezeConfirmText,
        freezeReason,
        unfreeze,
        type FreezeTarget,
    } from "@src/logic/moderation/freeze";
    import { PendingAction } from "@src/logic/moderation/pendingAction.svelte";
    import { getPendingToastHost, getToastHost } from "@openchat/ui/src/lib/toasts.svelte";
    import { runInPendingToast, UNDO_TOAST_MS } from "../../shell/pendingToast";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import ConfirmDialog from "../conversation/ConfirmDialog.svelte";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "confirm_freeze" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    // the app's toast layer (App), which outlasts this dialog, so the Undo still works once it's gone
    const toastHost = getToastHost();
    const pendingToasts = getPendingToastHost();

    let typed = $state("");
    const action = new PendingAction();

    const text = $derived(freezeConfirmText(dialog.target, dialog.name));
    const reason = $derived(freezeReason(typed));

    async function freeze() {
        if (reason.kind !== "ok") return;
        // the Undo runs once this dialog is gone, when its props (the parent's dialog) are too
        const { target, name } = dialog;
        const given = reason.reason;
        const outcome = await action.run(() => freezeTarget(client, target, name, given));
        if (outcome === undefined) return;
        onClose();
        toastHost?.({
            message: interpolate($_, outcome.message),
            duration: UNDO_TOAST_MS,
            onAction: () => undo(target, name),
        });
    }

    function undo(target: FreezeTarget, name: string) {
        void runInPendingToast(pendingToasts, unfreeze(client, target, name), $_);
    }
</script>

<ConfirmDialog
    title={interpolate($_, text.title)}
    message={interpolate($_, text.body)}
    confirmLabel={$_("freezeConfirm.confirm")}
    disabled={reason.kind !== "ok"}
    busy={action.busy}
    error={action.error === undefined ? undefined : interpolate($_, action.error)}
    onConfirm={freeze}
    {onClose}>
    <div class="reason">
        <ListSectionLabel label={$_("freezeConfirm.reasonLabel")} />
        <TextArea
            value={typed}
            placeholder={interpolate($_, text.reasonHint)}
            maxLength={FREEZE_REASON_MAX_LENGTH}
            onInput={(e) => (typed = e.currentTarget.value)} />
    </div>
</ConfirmDialog>

<style lang="scss">
    .reason {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }
</style>
