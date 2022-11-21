<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";
    import Button from "../Button.svelte";

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

<Button hollow={!selected} small={true} on:click>
    <div class="wrapper">
        <h4 class="title" class:unread={chatsWithUnreadMsgs > 0}>
            {$_("chats")}
        </h4>
        {#if chatsWithUnreadMsgs > 0}
            <div
                in:pop={{ duration: 1500 }}
                title={$_("chats.unread", {
                    values: { count: chatsWithUnreadMsgs.toString() },
                })}
                class="unread-count">
                {chatsWithUnreadMsgs > 999 ? "999+" : chatsWithUnreadMsgs}
            </div>
        {/if}
    </div>
</Button>

<style type="text/scss">
    .wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: $sp4;
    }

    .unread-count {
        @include unread();
    }
</style>
