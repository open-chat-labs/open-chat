<script lang="ts">
    import Panel from "../Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import { avatarUrl, UserStatus } from "../../domain/user";
    import type { UserLookup } from "../../domain/user";
    import type { User } from "../../domain/user";
    import type { HomeState } from "./Home.types";
    import Loading from "../Loading.svelte";
    import { getContentAsText } from "../../domain/chat";
    import type { ChatSummary as ChatSummaryType, DirectChatSummary } from "../../domain/chat";
    import ChatSummary from "./ChatSummary.svelte";
    import NewMessageFab from "./NewMessageFab.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import { _ } from "svelte-i18n";

    export let state: HomeState;
    export let user: User;
    export let users: UserLookup;
    export let chatSummaries: ChatSummaryType[] = [];
    export let selectedChatId: bigint | undefined;
    export let hideLeft = false;

    function filterChats(event: { detail: string }) {}

    function unreadMessages({ lastestMessageId, lastReadByUs }: ChatSummaryType): number {
        return lastestMessageId - lastReadByUs;
    }

    function userStatus({ them }: DirectChatSummary): UserStatus {
        return (users[them]?.secondsSinceLastOnline ?? Number.MAX_VALUE) < 120
            ? UserStatus.Online
            : UserStatus.Offline;
    }

    function latestMessageText({ latestMessage }: ChatSummaryType): string {
        return latestMessage ? getContentAsText(latestMessage.content) : "";
    }

    function chatSummaryProps(chatSummary: ChatSummaryType) {
        if (chatSummary.kind === "direct_chat") {
            return {
                selected: chatSummary.chatId === selectedChatId,
                chatId: chatSummary.chatId,
                date: chatSummary.displayDate,
                name: users[chatSummary.them]?.username,
                lastMessage: latestMessageText(chatSummary),
                avatarUrl: avatarUrl(chatSummary.them),
                userStatus: userStatus(chatSummary),
                unreadMessages: unreadMessages(chatSummary),
            };
        }
        return {
            selected: chatSummary.chatId === selectedChatId,
            chatId: chatSummary.chatId,
            date: chatSummary.displayDate,
            name: chatSummary.subject,
            lastMessage: latestMessageText(chatSummary),
            userStatus: UserStatus.None,
            unreadMessages: unreadMessages(chatSummary),
            avatarUrl: undefined,
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
