<script lang="ts">
    import CurrentUser from "./CurrentUser.svelte";
    import Search from "./Search.svelte";
    import Loading from "../Loading.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import NewMessageFab from "./NewMessageFab.svelte";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { elasticOut } from "svelte/easing";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import { _ } from "svelte-i18n";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";
    import { toastStore } from "../../stores/toast";
    import { rollbar } from "../../utils/logging";
    import type { ChatSummary as ChatSummaryType } from "../../domain/chat/chat";
    import type {
        GroupMatch,
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";
    import { createEventDispatcher } from "svelte";
    import SearchResult from "./SearchResult.svelte";
    import { push } from "svelte-spa-router";
    import { avatarUrl } from "../../domain/user/user.utils";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import type { DataContent } from "../../domain/data/data";
    import { userStore } from "../../stores/user";
    import NotificationsBar from "./NotificationsBar.svelte";

    export let machine: ActorRefFrom<HomeMachine>;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    const dispatch = createEventDispatcher();

    let joiningGroup: string | undefined = undefined;

    $: user = $machine.context.user ? $userStore[$machine.context.user?.userId] : undefined;

    $: userId = $machine.context.user!.userId;

    $: api = $machine.context.serviceContainer!;

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

    $: chats =
        searchTerm !== ""
            ? $machine.context.chatSummaries.filter(chatMatchesSearch)
            : $machine.context.chatSummaries;

    $: chatLookup = $machine.context.chatSummaries.reduce((lookup, chat) => {
        lookup[chat.chatId] = chat;
        return lookup;
    }, {} as Record<string, ChatSummaryType>);

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        // optimistic update
        machine.send({
            type: "UPDATE_USER_AVATAR",
            data: {
                blobData: ev.detail.data,
                blobUrl: ev.detail.url,
            },
        });
        $machine.context.serviceContainer
            ?.setUserAvatar(ev.detail.data)
            .then((_resp) => toastStore.showSuccessToast("avatarUpdated"))
            .catch((err) => {
                rollbar.error("Failed to update user's avatar", err);
                toastStore.showFailureToast("avatarUpdateFailed");
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
            $machine.context
                .serviceContainer!.joinGroup(group.chatId)
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
        const chat = chatLookup[chatId];
        if (chat === undefined) {
            return { blobUrl: undefined };
        }
        return chat.kind === "group_chat" ? chat : $userStore[sender];
    }

    function messageMatchTitle({ chatId, sender }: MessageMatch): string {
        const chat = chatLookup[chatId];
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
        on:newchat
        on:newGroup />
    <div class="body">
        <Search {searching} {searchTerm} on:searchEntered />
        {#if $machine.matches("loading_chats")}
            <Loading />
        {:else}
            <div class="chat-summaries">
                {#if searchResultsAvailable && chats.length > 0}
                    <h3 class="search-subtitle">{$_("yourChats")}</h3>
                {/if}
                {#each chats as chatSummary, _i (chatSummary.chatId)}
                    <div
                        animate:flip={{ duration: 600, easing: elasticOut }}
                        out:fade|local={{ duration: 150 }}>
                        <ChatSummary
                            messagesRead={$machine.context.markRead}
                            {chatSummary}
                            selected={$machine.context.selectedChat?.chatId ===
                                chatSummary.chatId} />
                    </div>
                {/each}

                {#if groupSearchResults !== undefined}
                    <div class="search-matches">
                        {#await groupSearchResults then resp}
                            {#if resp.kind === "success" && resp.matches.length > 0}
                                <h3 class="search-subtitle">{$_("publicGroups")}</h3>
                                {#each resp.matches as group, _i (group.chatId)}
                                    <div
                                        animate:flip={{ duration: 600, easing: elasticOut }}
                                        out:fade|local={{ duration: 150 }}>
                                        <SearchResult
                                            avatarUrl={avatarUrl(group)}
                                            showSpinner={joiningGroup === group.chatId}
                                            on:click={() => joinGroup(group)}>
                                            <h4 class="search-item-title">
                                                {group.name}
                                            </h4>
                                            <p title={group.description} class="search-item-desc">
                                                {group.description}
                                            </p>
                                        </SearchResult>
                                    </div>
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
                                {#each resp as user, _i (user.userId)}
                                    <div
                                        animate:flip={{ duration: 600, easing: elasticOut }}
                                        out:fade|local={{ duration: 150 }}>
                                        <SearchResult
                                            avatarUrl={avatarUrl(user)}
                                            on:click={() => chatWith(user.userId)}>
                                            <h4 class="search-item-title">
                                                @{user.username}
                                            </h4>
                                        </SearchResult>
                                    </div>
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
                                {#each resp.matches as msg, _i (`${msg.chatId}_${msg.eventIndex}`)}
                                    <div
                                        animate:flip={{ duration: 600, easing: elasticOut }}
                                        out:fade|local={{ duration: 150 }}>
                                        <SearchResult
                                            avatarUrl={avatarUrl(messageMatchDataContent(msg))}
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
                                    </div>
                                {/each}
                            {/if}
                        {/await}
                    </div>
                {/if}
            </div>
        {/if}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <NewMessageFab on:newchat />
        {/if}
    </div>
    <NotificationsBar {api} {userId} />
{/if}

<style type="text/scss">
    .body {
        overflow: auto;
        @include size-below(xs) {
            padding: 0 $sp3;
        }
    }
    .chat-summaries {
        overflow: auto;
    }

    .search-subtitle {
        margin-bottom: $sp3;
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
