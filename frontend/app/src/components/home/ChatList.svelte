<script lang="ts">
    import CurrentUser from "./CurrentUser.svelte";
    import Search from "../Search.svelte";
    import Loading from "../Loading.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import { _ } from "svelte-i18n";
    import type {
        ChatSummary as ChatSummaryType,
        GroupMatch,
        GroupSearchResponse,
        UserSummary,
        OpenChat,
    } from "openchat-client";
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import SearchResult from "./SearchResult.svelte";
    import { push } from "svelte-spa-router";
    import NotificationsBar from "./NotificationsBar.svelte";
    import { chatListScroll } from "../../stores/scrollPos";
    import { menuCloser } from "../../actions/closeMenu";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import ThreadsButton from "./ThreadsButton.svelte";
    import ChatsButton from "./ChatsButton.svelte";

    const client = getContext<OpenChat>("client");
    const createdUser = client.user;

    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    const dispatch = createEventDispatcher();

    let chatsWithUnreadMsgs: number;
    let view: "chats" | "threads" = "chats";

    $: selectedChatId = client.selectedChatId;
    $: numberOfThreadsStore = client.numberOfThreadsStore;
    $: chatsLoading = client.chatsLoading;
    $: messagesRead = client.messagesRead;
    $: chatSummariesListStore = client.chatSummariesListStore;
    $: userStore = client.userStore;
    $: user = $userStore[createdUser.userId];
    $: lowercaseSearch = searchTerm.toLowerCase();

    function chatMatchesSearch(chat: ChatSummaryType): boolean {
        if (chat.kind === "group_chat") {
            return (
                chat.name.toLowerCase().indexOf(lowercaseSearch) >= 0 ||
                chat.description.toLowerCase().indexOf(lowercaseSearch) >= 0
            );
        }

        if (chat.kind === "direct_chat") {
            const username = $userStore[chat.them]?.username;
            return username ? username.toLowerCase().indexOf(lowercaseSearch) >= 0 : false;
        }
        return false;
    }

    $: chats =
        searchTerm !== ""
            ? $chatSummariesListStore.filter(chatMatchesSearch)
            : $chatSummariesListStore;

    $: {
        document.title = chatsWithUnreadMsgs > 0 ? `OpenChat (${chatsWithUnreadMsgs})` : "OpenChat";
    }

    function chatWith(userId: string): void {
        dispatch("chatWith", userId);
        closeSearch();
    }

    /**
     * All we need to do here is push the route
     * the routing will take care of the rest
     */
    function selectGroup({ chatId }: GroupMatch): void {
        push(`/${chatId}`);
        closeSearch();
    }

    function closeSearch() {
        dispatch("searchEntered", "");
    }

    function chatSelected(ev: CustomEvent<string>): void {
        chatScrollTop = chatListElement.scrollTop;
        push(`/${ev.detail}`);
        closeSearch();
    }

    let chatListElement: HTMLElement;
    let chatScrollTop = 0;

    onMount(() => {
        tick().then(() => {
            if (chatListElement) {
                chatListElement.scrollTop = $chatListScroll;
            }
        });

        let unsub = messagesRead.subscribe((_val) => {
            chatsWithUnreadMsgs = chats
                ? chats.reduce(
                      (num, chat) =>
                          client.unreadMessageCount(
                              chat.chatId,
                              chat.latestMessage?.event.messageIndex
                          ) > 0
                              ? num + 1
                              : num,
                      0
                  )
                : 0;
        });

        return () => {
            unsub();
            chatListScroll.set(chatScrollTop);
        };
    });

    function onSearchEntered(ev: CustomEvent<unknown>) {
        setView("chats");
        dispatch("searchEntered", ev.detail);
    }

    function setView(v: "chats" | "threads"): void {
        view = v;
        chatListElement.scrollTop = 0;
        chatListScroll.set(0);
    }
</script>

{#if user}
    <CurrentUser
        on:wallet
        on:showHomePage
        on:logout
        on:whatsHot
        on:showFaq
        {user}
        on:profile
        on:upgrade
        on:newGroup />

    <Search {searching} {searchTerm} on:searchEntered={onSearchEntered} />

    {#if $numberOfThreadsStore > 0}
        <div class="section-selector">
            <ChatsButton on:click={() => setView("chats")} selected={view === "chats"} />
            <ThreadsButton on:click={() => setView("threads")} selected={view === "threads"} />
        </div>
    {/if}

    <div use:menuCloser bind:this={chatListElement} class="body">
        {#if $chatsLoading}
            <Loading />
        {:else if view === "threads"}
            <ThreadPreviews />
        {:else}
            <div class="chat-summaries">
                {#if searchResultsAvailable && chats.length > 0}
                    <h3 class="search-subtitle">{$_("yourChats")}</h3>
                {/if}
                {#each chats as chatSummary, i (chatSummary.chatId)}
                    <ChatSummary
                        index={i}
                        {chatSummary}
                        selected={$selectedChatId === chatSummary.chatId}
                        visible={searchTerm !== "" || !chatSummary.archived}
                        on:chatSelected={chatSelected}
                        on:pinChat
                        on:unpinChat
                        on:archiveChat
                        on:unarchiveChat
                        on:toggleMuteNotifications
                        on:deleteDirectChat />
                {/each}

                {#if groupSearchResults !== undefined}
                    <div class="search-matches">
                        {#await groupSearchResults then resp}
                            {#if resp.kind === "success" && resp.matches.length > 0}
                                <h3 class="search-subtitle">{$_("publicGroups")}</h3>
                                {#each resp.matches as group, i (group.chatId)}
                                    <SearchResult
                                        index={i}
                                        avatarUrl={client.groupAvatarUrl(group)}
                                        on:click={() => selectGroup(group)}>
                                        <h4 class="search-item-title">
                                            {group.name}
                                        </h4>
                                        <p title={group.description} class="search-item-desc">
                                            {group.description}
                                        </p>
                                    </SearchResult>
                                {/each}
                            {/if}
                        {/await}
                    </div>
                {/if}
                {#if userSearchResults !== undefined}
                    <div class="search-matches">
                        {#await userSearchResults then resp}
                            {#if resp.length > 0}
                                <h3 class="search-subtitle">{$_("users")}</h3>
                                {#each resp as user, i (user.userId)}
                                    <SearchResult
                                        index={i}
                                        avatarUrl={client.userAvatarUrl(user)}
                                        on:click={() => chatWith(user.userId)}>
                                        <h4 class="search-item-title">
                                            @{user.username}
                                        </h4>
                                    </SearchResult>
                                {/each}
                            {/if}
                        {/await}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
    <NotificationsBar />
{/if}

<style type="text/scss">
    .body {
        overflow: auto;
        flex: auto;
        @include nice-scrollbar();
    }
    .chat-summaries {
        overflow: auto;
        overflow-x: hidden;
    }

    .section-selector {
        display: flex;
        justify-content: flex-start;
        margin: 0 $sp4 $sp4 $sp4;
        gap: $sp3;
        @include mobile() {
            justify-content: space-evenly;
            margin: 0 $sp3 $sp3 $sp3;
        }
    }

    .search-subtitle {
        margin-bottom: $sp3;
        margin-left: 0;
        padding: 0 $sp4;

        @include mobile() {
            padding: 0 $sp3;
        }
    }

    .search-matches {
        margin-top: $sp4;
    }
    .search-item-title {
        margin-bottom: $sp3;
    }
    .search-item-desc {
        color: var(--txt-light);
        @include font(light, normal, fs-80);
        @include ellipsis();
    }
</style>
