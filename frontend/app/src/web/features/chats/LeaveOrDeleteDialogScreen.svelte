<!-- Confirming leaving or deleting a group, channel, DM or community. The client goes off it first when
     it's open and back if the call fails; the outcome is a toast, and the dialog closes either way
     (a navigation closes it sooner). Deleting asks for the name to be typed, except for a DM. Once
     the open chat or community is gone, so are its details in the right column (as on desktop). -->
<script lang="ts">
    import {
        chatIdentifiersEqual,
        chatListScopeStore,
        selectedChatIdStore,
        setRightPanelHistory,
        type OpenChat,
    } from "@client";
    import DeleteGroupDialog from "@openchat/ui/src/features/components/DeleteGroupDialog.svelte";
    import LeaveGroupDialog from "@openchat/ui/src/features/components/LeaveGroupDialog.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "leave_or_delete" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const action = $derived(dialog.action);
    const noun = $derived.by(() => {
        switch (action.kind) {
            case "leave":
            case "delete":
                return action.chatId.kind === "channel" ? "channel" : "group";
            case "delete_direct_chat":
                return "chat";
            default:
                return "community";
        }
    });

    async function confirm() {
        const open =
            action.kind === "leave_community" || action.kind === "delete_community"
                ? $chatListScopeStore.kind === "community" &&
                  $chatListScopeStore.id.communityId === action.id.communityId
                : chatIdentifiersEqual($selectedChatIdStore, action.chatId);
        const outcome = await client.leaveOrDelete(action);
        if (outcome.kind === "success" && open) setRightPanelHistory([]);
        toastStore.showOutcome(outcome);
    }
</script>

{#if action.kind === "leave" || action.kind === "leave_community"}
    <LeaveGroupDialog
        groupName={dialog.name}
        noun={noun === "chat" ? "group" : noun}
        onConfirm={confirm}
        onCancel={onClose} />
{:else}
    <DeleteGroupDialog
        groupName={dialog.name}
        {noun}
        typeToConfirm={action.kind !== "delete_direct_chat"}
        onConfirm={confirm}
        onCancel={onClose} />
{/if}
