<!-- Picking a chat to share into what another app shared (?share, from /share?title&text&url; 4d,
     #10115): ChatPicker over the default page, listing the chats the user can send text in
     (SharePicker), in sections, searched by name or @username. Picking one opens it with the shared
     text, after the user's message, in its draft: nothing is sent until the user sends it (#10115
     invariant 4). Opening the chat closes the picker in the same navigation. -->
<script lang="ts">
    import {
        chatListScopeStore,
        localUpdates,
        routeForChatIdentifier,
        sharedDraftText,
        type OpenChat,
    } from "@client";
    import ChatPicker from "@openchat/ui/src/lib/components/ChatPicker.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { SharePicker } from "./sharePicker.svelte";

    let { dialog, onClose }: DialogProps<Extract<LinkedDialog, { kind: "share" }>> = $props();

    const client = getContext<OpenChat>("client");
    // svelte-ignore state_referenced_locally
    const picker = new SharePicker(client, $_);
    onMount(() => picker.loadLastSeen());

    // what was shared: the text (or title), with the url under it
    const draft = $derived(sharedDraftText(dialog));
    const item = $derived({
        title: dialog.text || dialog.title || dialog.url || "",
        sub: dialog.text || dialog.title ? dialog.url : undefined,
        icon: "share",
    });

    function pick({ chatId, message }: { chatId: string; message: string }) {
        const id = picker.chatId(chatId);
        if (id === undefined) return;
        const content = [message, draft].filter((part) => part !== "").join("\n");
        localUpdates.draftMessages.setTextContent({ chatId: id }, content);
        navigate(routeForChatIdentifier($chatListScopeStore.kind, id));
    }
</script>

<ChatPicker
    {item}
    chats={picker.chats()}
    filter={(query) => picker.chats(query)}
    sendLabel="ui.common.continue"
    onSend={pick}
    {onClose} />
