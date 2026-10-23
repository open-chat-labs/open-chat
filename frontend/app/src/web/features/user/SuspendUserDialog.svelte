<!-- A platform moderator suspends a user, with a reason (the `suspendUser` app event, from the
     user's card). The old UI's dialog: a failure says so and keeps the reason. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import TextArea from "@openchat/ui/src/lib/components/TextArea.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        userId: string;
        onClose: () => void;
    }

    let { userId, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let reason = $state("");
    let suspending = $state(false);
    let failed = $state(false);

    async function suspend() {
        if (suspending) return;
        suspending = true;
        failed = false;
        const success = await client.suspendUser(userId, reason);
        suspending = false;
        if (success) {
            onClose();
        } else {
            failed = true;
        }
    }
</script>

<!-- TODO(design): no suspend dialog in the design -->
<DialogShell title={$_("suspendedUser")} height="auto" onClose={suspending ? undefined : onClose}>
    <TextArea
        value={reason}
        placeholder={$_("reasonForSuspension")}
        maxLength={512}
        error={failed}
        errorText={failed ? $_("failedToSuspendUser") : ""}
        onInput={(e) => (reason = e.currentTarget.value)} />
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" disabled={suspending} onClick={onClose} />
        <Button label={$_("suspend")} disabled={suspending} onClick={suspend} />
    </div>
</DialogShell>

<style>
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
        margin-block-start: var(--space-16);
    }
</style>
