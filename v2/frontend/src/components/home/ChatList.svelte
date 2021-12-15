<script lang="ts">
    import CurrentUser from "./CurrentUser.svelte";
    import Search from "../Search.svelte";
    import Loading from "../Loading.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { elasticOut } from "svelte/easing";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import type { ChatSummary as ChatSummaryType } from "../../domain/chat/chat";
    import type {
        GroupMatch,
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";
    import { createEventDispatcher, onDestroy } from "svelte";
    import SearchResult from "./SearchResult.svelte";
    import { push } from "svelte-spa-router";
    import { avatarUrl } from "../../domain/user/user.utils";
    import { getContentAsText, getMinVisibleMessageIndex } from "../../domain/chat/chat.utils";
    import type { DataContent } from "../../domain/data/data";
    import { userStore } from "../../stores/user";
    import NotificationsBar from "./NotificationsBar.svelte";
    import { unsubscribeNotifications } from "../../utils/notifications";
    import type { HomeController } from "../../fsm/home.controller";

    export let controller: HomeController;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    const dispatch = createEventDispatcher();

    let joiningGroup: string | undefined = undefined;
    let chatsWithUnreadMsgs: number;

    $: user = controller.user ? $userStore[controller.user?.userId] : undefined;
    $: api = controller.api;
    $: userId = controller.user!.userId;
    $: chatsList = controller.chatSummariesList;
    $: selectedChat = controller.selectedChat;
    $: chatsLoading = controller.loading;

    function chatMatchesSearch(chat: ChatSummaryType): boolean {
        if (chat.kind === "group_chat") {
            return (
                chat.name.toLowerCase().indexOf(searchTerm) >= 0 ||
                chat.description.toLowerCase().indexOf(searchTerm) >= 0
            );
        }

        if (chat.kind === "direct_chat") {
            const username = $userStore[chat.them]?.username;
            return username ? username.indexOf(searchTerm) >= 0 : false;
        }
        return false;
    }

    $: chats = searchTerm !== "" ? $chatsList.filter(chatMatchesSearch) : $chatsList;

    let unsub = controller.messagesRead.subscribe((_val) => {
        chatsWithUnreadMsgs = chats
            ? chats.reduce(
                  (num, chat) =>
                      controller.messagesRead.unreadMessageCount(
                          chat.chatId,
                          getMinVisibleMessageIndex(chat),
                          chat.latestMessage?.event.messageIndex
                      ) > 0
                          ? num + 1
                          : num,
                  0
              )
            : 0;
    });

    onDestroy(unsub);

    $: {
        document.title = chatsWithUnreadMsgs > 0 ? `OpenChat (${chatsWithUnreadMsgs})` : "OpenChat";
    }

    $: chatLookup = controller.chatSummaries;

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        controller.updateUserAvatar({
            blobData: ev.detail.data,
            blobUrl: ev.detail.url,
        });
    }

    function chatWith(userId: string): void {
        dispatch("chatWith", userId);
    }

    function loadMessage(msg: MessageMatch): void {
        dispatch("loadMessage", msg);
    }

    // this is pretty iffy, but ....
    function selectJoinedChat(chatId: string): void {
        if (chats.find((c) => c.chatId === chatId) !== undefined) {
            push(`/${chatId}`);
            joiningGroup = undefined;
        } else {
            setTimeout(() => selectJoinedChat(chatId), 200);
        }
    }

    function joinGroup(group: GroupMatch): void {
        if (chats.find((c) => c.chatId === group.chatId) !== undefined) {
            push(`/${group.chatId}`);
            joiningGroup = undefined;
        } else {
            joiningGroup = group.chatId;
            api.joinGroup(group.chatId)
                .then((resp) => {
                    if (resp === "success" || resp === "already_in_group") {
                        selectJoinedChat(group.chatId);
                    } else {
                        toastStore.showFailureToast("joinGroupFailed");
                        joiningGroup = undefined;
                    }
                })
                .catch((_err) => {
                    toastStore.showFailureToast("joinGroupFailed");
                    joiningGroup = undefined;
                });
        }
    }

    function messageMatchDataContent({ chatId, sender }: MessageMatch): DataContent {
        const chat = $chatLookup[chatId];
        if (chat === undefined) {
            return { blobUrl: undefined };
        }
        return chat.kind === "group_chat" ? chat : $userStore[sender];
    }

    function messageMatchTitle({ chatId, sender }: MessageMatch): string {
        const chat = $chatLookup[chatId];
        if (chat === undefined) {
            return "";
        }
        return chat.kind === "group_chat" ? chat.name : $userStore[sender].username ?? "";
    }
</script>

{#if user}
    <CurrentUser
        on:userAvatarSelected={userAvatarSelected}
        on:logout
        {user}
        on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
        on:newGroup />
    <Search {searching} {searchTerm} on:searchEntered />
    <div class="body">
        {#if $chatsLoading}
            <Loading />
        {:else}
            <div class="chat-summaries">
                {#if searchResultsAvailable && chats.length > 0}
                    <h3 class="search-subtitle">{$_("yourChats")}</h3>
                {/if}
                {#each chats as chatSummary, i (chatSummary.chatId)}
                    <div
                        animate:flip={{ duration: 600, easing: elasticOut }}
                        out:fade|local={{ duration: 150 }}>
                        <ChatSummary
                            index={i}
                            messagesRead={controller.messagesRead}
                            {chatSummary}
                            userId={userId}
                            selected={$selectedChat?.chatId === chatSummary.chatId} />
                    </div>
                {/each}

                {#if groupSearchResults !== undefined}
                    <div class="search-matches">
                        {#await groupSearchResults then resp}
                            {#if resp.kind === "success" && resp.matches.length > 0}
                                <h3 class="search-subtitle">{$_("publicGroups")}</h3>
                                {#each resp.matches as group, i (group.chatId)}
                                    <SearchResult
                                        index={i}
                                        avatarUrl={avatarUrl(group, "../assets/group.svg")}
                                        showSpinner={joiningGroup === group.chatId}
                                        on:click={() => joinGroup(group)}>
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
                                        avatarUrl={avatarUrl(user)}
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
                {#if messageSearchResults !== undefined}
                    <div class="search-matches">
                        {#await messageSearchResults then resp}
                            {#if resp.kind == "success" && resp.matches.length > 0}
                                <h3 class="search-subtitle">{$_("messages")}</h3>
                                {#each resp.matches as msg, i (`${msg.chatId}_${msg.messageIndex}`)}
                                    <SearchResult
                                        index={i}
                                        avatarUrl={avatarUrl(
                                            messageMatchDataContent(msg),
                                            "../assets/group.svg"
                                        )}
                                        showSpinner={false}
                                        on:click={() => loadMessage(msg)}>
                                        <h4 class="search-item-title">
                                            {messageMatchTitle(msg)}
                                        </h4>
                                        <p
                                            title={getContentAsText(msg.content)}
                                            class="search-item-desc">
                                            {getContentAsText(msg.content)}
                                        </p>
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
        @include nice-scrollbar();
        @include size-below(xs) {
            padding: var(--chatSearch-xs-pd);
        }
    }
    .chat-summaries {
        overflow: auto;
    }

    .search-subtitle {
        margin-bottom: $sp3;
        margin-left: var(--chatSearch-section-title-ml);
        color: var(--chatSearch-section-txt);
    }

    .search-matches {
        margin-top: $sp4;
    }
    .search-item-title {
        margin-bottom: $sp3;
    }
    .search-item-desc {
        color: var(--chatSummary-txt2);
        @include font(light, normal, fs-80);
        @include ellipsis();
    }
</style>
