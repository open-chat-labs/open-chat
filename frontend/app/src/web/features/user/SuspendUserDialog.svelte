<!-- A platform moderator suspends a user, with a reason: from the user's card, in its place over
     the same backdrop with a back arrow to it (SuspendUserDialogScreen), or from a DM's menu (the
     `suspendUser` app event). It names who: their picture, display name and @username, or their
     username alone without a display name (`suspendee`). Suspend spins and the dialog stays, with nothing dismissing it, until the
     backend answers (PendingAction): a failure says so inline, the reason kept, for another try;
     a success closes it and says so in a toast ("… has been suspended") whose Undo lifts it in a
     pending toast (`unsuspend`: "Un-suspending …", then how it went). -->
<script lang="ts">
    import { allUsersStore, type OpenChat } from "@client";
    import { interpolate } from "@i18n/i18n";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import MemberRow from "@openchat/ui/src/lib/components/MemberRow.svelte";
    import TextArea from "@openchat/ui/src/lib/components/TextArea.svelte";
    import { getPendingToastHost, getToastHost } from "@openchat/ui/src/lib/toasts.svelte";
    import { suspendee, suspendUser, unsuspend } from "@src/logic/moderation/chatModeration";
    import { PendingAction } from "@src/logic/moderation/pendingAction.svelte";
    import { swatchFor } from "@src/logic/swatch";
    import { runInPendingToast, UNDO_TOAST_MS } from "../../shell/pendingToast";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        userId: string;
        onClose: () => void;
        /** Back to the dialog it was opened from (the user's card). */
        onBack?: () => void;
    }

    let { userId, onClose, onBack }: Props = $props();

    const client = getContext<OpenChat>("client");
    // the app's toast layer (App), which outlasts this dialog, so the Undo still works once it's gone
    const toastHost = getToastHost();
    const pendingToasts = getPendingToastHost();

    const who = $derived(suspendee(userId, $allUsersStore));
    const action = new PendingAction();
    let reason = $state("");

    // nothing dismisses it while the suspension is on its way: its outcome has to be seen
    function close() {
        if (!action.busy) onClose();
    }

    function back() {
        if (!action.busy) onBack?.();
    }

    async function suspend() {
        // the Undo runs once this dialog is gone, when its props (the parent's dialog) are too
        const target = userId;
        const outcome = await action.run(() =>
            suspendUser(client, target, reason, allUsersStore.value),
        );
        if (outcome === undefined) return;
        onClose();
        toastHost?.({
            message: interpolate($_, outcome.message),
            duration: UNDO_TOAST_MS,
            onAction: () => undo(target),
        });
    }

    function undo(target: string) {
        void runInPendingToast(
            pendingToasts,
            unsuspend(client, target, allUsersStore.value),
            $_,
        );
    }
</script>

<!-- TODO(design): no suspend dialog in the design; who it names (avatar, display name, @username)
     is ours -->
<DialogShell
    title={$_("suspendUser")}
    height="auto"
    onBack={onBack && back}
    onClose={action.busy ? undefined : close}>
    <div class="who">
        <MemberRow
            title={who.name}
            subtitle={who.handle ?? ""}
            color={swatchFor(userId)}
            image={who.avatarUrl ?? ""}
            showMenu={false} />
    </div>
    <TextArea
        value={reason}
        placeholder={$_("reasonForSuspension")}
        maxLength={512}
        onInput={(e) => (reason = e.currentTarget.value)} />
    {#if action.error !== undefined}
        <p class="error" role="alert">{interpolate($_, action.error)}</p>
    {/if}
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" disabled={action.busy} onClick={close} />
        <Button label={$_("suspend")} busy={action.busy} onClick={suspend} />
    </div>
</DialogShell>

<style lang="scss">
    .who {
        margin-block-end: var(--space-12);
    }

    .error {
        margin: var(--space-12) 0 0;
        font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--status-danger);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
        margin-block-start: var(--space-16);
    }
</style>
