<script lang="ts">
    import { _ } from "svelte-i18n";
    import { getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";

    export let selected = false;

    const client = getContext<OpenChat>("client");
    let chatsWithUnreadMsgs: number;

    $: messagesRead = client.messagesRead;
    $: chatSummariesListStore = client.chatSummariesListStore;

    onMount(() => {
        return messagesRead.subscribe((_val) => {
            chatsWithUnreadMsgs = $chatSummariesListStore.reduce(
                (num, chat) =>
                    client.unreadMessageCount(chat.chatId, chat.latestMessage?.event.messageIndex) >
                    0
                        ? num + 1
                        : num,
                0
            );
        });
    });
</script>

<ChatListSectionButton on:click {selected} title={$_("chats")} unread={chatsWithUnreadMsgs} />
