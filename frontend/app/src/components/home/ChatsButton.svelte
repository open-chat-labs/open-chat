<script lang="ts">
    import { _ } from "svelte-i18n";
    import { getContext, onMount } from "svelte";
    import type { ChatSummary, OpenChat } from "openchat-client";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";

    export let selected = false;

    let chatsWithUnreadMsgs: number;

    const client = getContext<OpenChat>("client");

    $: messagesRead = client.messagesRead;
    $: chatSummariesListStore = client.chatSummariesListStore;

    function updateUnreadChatsCount(chats: ChatSummary[]) {
        chatsWithUnreadMsgs = chats.reduce((num, chat) => {
            if (chat.notificationsMuted) return num;
            const unread = client.unreadMessageCount(
                chat.chatId,
                chat.latestMessage?.event.messageIndex
            );
            return unread > 0 ? num + 1 : num;
        }, 0);
    }

    $: {
        updateUnreadChatsCount($chatSummariesListStore);
        document.title = chatsWithUnreadMsgs > 0 ? `OpenChat (${chatsWithUnreadMsgs})` : "OpenChat";
    }

    onMount(() => {
        return messagesRead.subscribe((_val) => updateUnreadChatsCount($chatSummariesListStore));
    });
</script>

<ChatListSectionButton on:click {selected} title={$_("chats")} unread={chatsWithUnreadMsgs} />
