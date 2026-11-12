<!-- Forwarding a message (5b): ChatPicker over the conversation, listing the chats the user can send
     text in (SharePicker), the open one left out, as the old pickers did. Picking one opens it, and
     the message is forwarded there as it opens (messageToForwardStore, as in the old trees), so
     its rules are asked for first; a note written in the picker waits in that chat's draft. -->
<script lang="ts">
    import {
        allUsersStore,
        chatListScopeStore,
        localUpdates,
        routeForChatIdentifier,
        selectedChatIdStore,
        userGroupSummariesStore,
        type OpenChat,
    } from "@client";
    import ChatPicker from "@openchat/ui/src/lib/components/ChatPicker.svelte";
    import { typedMentions } from "@src/logic/conversation/typedMentions";
    import { messageToForwardStore } from "@src/stores/messageToForward";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { SharePicker } from "../share/sharePicker.svelte";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "forward" }>> = $props();

    const client = getContext<OpenChat>("client");
    // svelte-ignore state_referenced_locally
    const picker = new SharePicker(client, $_, () => selectedChatIdStore.value);

    const item = $derived({
        // its mentions as the @names typed, every community's groups as its rows
        // (conversationContext): a forwarded message can name another community's
        title: typedMentions({
            users: $allUsersStore,
            userGroups: $userGroupSummariesStore,
        })(client.getContentAsText($_, dialog.message.content)),
        icon: "forward",
    });

    function pick({ chatId, message }: { chatId: string; message: string }) {
        const id = picker.chatId(chatId);
        if (id === undefined) return;
        if (message.trim() !== "") {
            localUpdates.draftMessages.setTextContent({ chatId: id }, message.trim());
        }
        messageToForwardStore.set(dialog.message);
        onClose();
        navigate(routeForChatIdentifier($chatListScopeStore.kind, id));
    }
</script>

<ChatPicker
    title={$_("forward")}
    {item}
    chats={picker.chats()}
    filter={(query) => picker.search(query)}
    sendLabel={$_("forward")}
    onSend={pick}
    {onClose} />
