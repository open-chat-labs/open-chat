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
    import UserSearchResult from "./UserSearchResult.svelte";
    import GroupSearchResult from "./GroupSearchResult.svelte";
    import MessageSearchResult from "./MessageSearchResult.svelte";
    import { push } from "svelte-spa-router";

    export let machine: ActorRefFrom<HomeMachine>;

    const dispatch = createEventDispatcher();
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;
    let joiningGroup: string | undefined = undefined;

    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;

    $: user = $machine.context.user
        ? $machine.context.userLookup[$machine.context.user?.userId]
        : undefined;

    function chatMatchesSearch(chat: ChatSummaryType): boolean {
        if (chat.kind === "group_chat") {
            return (
                chat.name.toLowerCase().indexOf(searchTerm) >= 0 ||
                chat.description.toLowerCase().indexOf(searchTerm) >= 0
            );
        }

        if (chat.kind === "direct_chat") {
            const username = $machine.context.userLookup[chat.them].username;
            return username ? username.indexOf(searchTerm) >= 0 : false;
        }
        return false;
    }

    $: chats =
        searchTerm !== ""
            ? $machine.context.chatSummaries.filter(chatMatchesSearch)
            : $machine.context.chatSummaries;

    async function performSearch(ev: CustomEvent<string>) {
        searchResultsAvailable = false;
        searchTerm = ev.detail.toLowerCase();
        if (searchTerm !== "") {
            searching = true;
            groupSearchResults = $machine.context.serviceContainer!.searchGroups(searchTerm, 10);
            userSearchResults = $machine.context.serviceContainer!.searchUsers(searchTerm, 10);
            messageSearchResults = $machine.context
                .serviceContainer!.searchAllMessages(searchTerm, 10)
                .then((res) => {
                    console.log(res);
                    return res;
                });
            try {
                await Promise.all([
                    groupSearchResults,
                    userSearchResults,
                    messageSearchResults,
                ]).then(() => {
                    searchResultsAvailable = true;
                    searching = false;
                });
            } catch (_err) {
                searching = false;
            }
        } else {
            clearSearch();
        }
    }

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

    function clearSearch() {
        groupSearchResults = userSearchResults = messageSearchResults = undefined;
        searchTerm = "";
        searching = false;
        searchResultsAvailable = false;
    }

    function chatWith(userId: string): void {
        clearSearch();
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
            clearSearch();
        } else {
            setTimeout(() => selectJoinedChat(chatId), 200);
        }
    }

    function joinGroup(group: GroupMatch): void {
        if (chats.find((c) => c.chatId === group.chatId) !== undefined) {
            push(`/${group.chatId}`);
            joiningGroup = undefined;
            clearSearch();
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
</script>

{#if user}
    <CurrentUser
        on:userAvatarSelected={userAvatarSelected}
        on:logout
        {user}
        on:newchat
        on:joinGroup
        on:newGroup />
    <div class="body">
        <Search {searching} {searchTerm} on:searchEntered={performSearch} />
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
                            users={$machine.context.userLookup}
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
                                {#each resp.matches as group, i (group.chatId)}
                                    <div
                                        animate:flip={{ duration: 600, easing: elasticOut }}
                                        out:fade|local={{ duration: 150 }}>
                                        <GroupSearchResult
                                            showSpinner={joiningGroup === group.chatId}
                                            {group}
                                            on:click={() => joinGroup(group)} />
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
                                {#each resp as user, i (user.userId)}
                                    <div
                                        animate:flip={{ duration: 600, easing: elasticOut }}
                                        out:fade|local={{ duration: 150 }}>
                                        <UserSearchResult
                                            {user}
                                            on:click={() => chatWith(user.userId)} />
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
                                {#each resp.matches as msg, i (`${msg.chatId}_${msg.eventIndex}`)}
                                    <div
                                        animate:flip={{ duration: 600, easing: elasticOut }}
                                        out:fade|local={{ duration: 150 }}>
                                        <MessageSearchResult
                                            {msg}
                                            on:click={() => loadMessage(msg)} />
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
        color: var(--chatSummary-txt1);
    }
</style>
