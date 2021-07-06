<script lang="ts">
    import Panel from "../Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import { avatarUrl, UserStatus } from "../../domain/user";
    import type { User } from "../../domain/user";
    import type { LeftPanelState } from "./LeftPanel.types";
    import Loading from "../Loading.svelte";
    import type { ChatSummary as ChatSummaryType } from "../../domain/chat";
    import ChatSummary from "./ChatSummary.svelte";
    import NewMessageFab from "./NewMessageFab.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";

    export let state: LeftPanelState;
    export let user: User;
    export let chatSummaries: ChatSummaryType[] = [];
    export let selectedChatId: bigint | undefined;
    export let hideLeft = false;

    function filterChats(event: { detail: string }) {}

    function unreadMessages({ lastestMessageId, lastReadByUs }: ChatSummaryType): number {
        return lastestMessageId - lastReadByUs;
    }

    function chatSummaryProps(chatSummary: ChatSummaryType) {
        if (chatSummary.kind === "direct_chat") {
            return {
                selected: chatSummary.chatId === selectedChatId,
                chatId: chatSummary.chatId,
                date: chatSummary.displayDate,
                name: "TODO - look up the username",
                lastMessage: "TODO - str summary of latest message",
                avatarUrl: avatarUrl(chatSummary.them.toString()),
                userStatus: UserStatus.Online, // todo - work out if the other user is online
                unreadMessages: unreadMessages(chatSummary),
            };
        }
        return {
            selected: chatSummary.chatId === selectedChatId,
            chatId: chatSummary.chatId,
            date: chatSummary.displayDate,
            name: chatSummary.subject,
            lastMessage: "TODO - str summary of latest message",
            userStatus: UserStatus.None,
            unreadMessages: unreadMessages(chatSummary),
        };
    }
</script>

{#if user}
    <Panel left {hideLeft}>
        <CurrentUser on:logout {user} on:newchat />
        <SearchChats on:filter={filterChats} />
        {#if state === "loadingChats"}
            <Loading />
        {:else}
            <div class="chat-summaries">
                {#each chatSummaries as chatSummary}
                    <ChatSummary {...chatSummaryProps(chatSummary)} on:selectChat />
                {/each}
            </div>
        {/if}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <NewMessageFab on:newchat />
        {/if}
    </Panel>
{/if}

<style type="text/scss">
    .chat-summaries {
        overflow: auto;
    }
</style>
