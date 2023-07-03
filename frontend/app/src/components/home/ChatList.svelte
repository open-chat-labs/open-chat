<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SelectedCommunityHeader from "./communities/SelectedCommunityHeader.svelte";
    import Search from "../Search.svelte";
    import Loading from "../Loading.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import { _ } from "svelte-i18n";
    import {
        ChatSummary as ChatSummaryType,
        GroupMatch,
        UserSummary,
        OpenChat,
        GroupSearchResponse,
        routeForChatIdentifier,
        chatIdentifiersEqual,
    } from "openchat-client";
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import SearchResult from "./SearchResult.svelte";
    import page from "page";
    import NotificationsBar from "./NotificationsBar.svelte";
    import { chatListScroll } from "../../stores/scrollPos";
    import { menuCloser } from "../../actions/closeMenu";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import ThreadsButton from "./ThreadsButton.svelte";
    import ChatsButton from "./ChatsButton.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { discoverHotGroupsDismissed } from "../../stores/settings";
    import { communitiesEnabled } from "../../utils/features";
    import { pushRightPanelHistory } from "../../stores/rightPanel";

    const client = getContext<OpenChat>("client");
    const createdUser = client.user;

    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    const dispatch = createEventDispatcher();

    let view: "chats" | "threads" = "chats";

    $: selectedChatId = client.selectedChatId;
    $: chatListScope = client.chatListScope;
    $: numberOfThreadsStore = client.numberOfThreadsStore;
    $: chatsLoading = client.chatsLoading;
    $: selectedCommunity = client.selectedCommunity;
    $: chatSummariesListStore = $selectedCommunity
        ? client.selectedCommunityChannels
        : client.chatSummariesListStore;
    $: userStore = client.userStore;
    $: user = $userStore[createdUser.userId];
    $: lowercaseSearch = searchTerm.toLowerCase();
    $: showWhatsHot =
        $chatListScope.kind !== "community" &&
        !$discoverHotGroupsDismissed &&
        groupSearchResults === undefined &&
        userSearchResults === undefined;
    $: showBrowseChannnels =
        $chatListScope.kind === "community" &&
        groupSearchResults === undefined &&
        userSearchResults === undefined;

    function chatMatchesSearch(chat: ChatSummaryType): boolean {
        if (chat.kind === "group_chat") {
            return (
                chat.name.toLowerCase().indexOf(lowercaseSearch) >= 0 ||
                chat.description.toLowerCase().indexOf(lowercaseSearch) >= 0
            );
        }

        if (chat.kind === "direct_chat") {
            const username = $userStore[chat.them.userId]?.username;
            return username ? username.toLowerCase().indexOf(lowercaseSearch) >= 0 : false;
        }
        return false;
    }

    // TODO - we need to reset the view if the selected chat changes

    $: chats =
        searchTerm !== ""
            ? $chatSummariesListStore.filter(chatMatchesSearch)
            : $chatSummariesListStore;

    function chatWith(userId: string): void {
        dispatch("chatWith", { kind: "direct_chat", userId });
        closeSearch();
    }

    /**
     * All we need to do here is push the route
     * the routing will take care of the rest
     */
    function selectGroup({ chatId }: GroupMatch): void {
        page(routeForChatIdentifier(chatId));
        closeSearch();
    }

    function closeSearch() {
        dispatch("searchEntered", "");
    }

    function chatSelected(ev: CustomEvent<ChatSummaryType>): void {
        chatScrollTop = chatListElement.scrollTop;
        const url = routeForChatIdentifier(ev.detail.id);
        page(url);
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

        return () => {
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

    function showChannels() {
        if ($chatListScope.kind === "community") {
            pushRightPanelHistory({
                kind: "community_channels",
            });
        }
    }
</script>

{#if user}
    {#if $communitiesEnabled && $selectedCommunity}
        <SelectedCommunityHeader
            community={$selectedCommunity}
            on:leaveCommunity
            on:deleteCommunity
            on:editCommunity
            on:communityDetails
            on:newChannel />
    {:else}
        <CurrentUser
            on:wallet
            on:showHomePage
            on:logout
            on:whatsHot
            on:halloffame
            {user}
            on:profile
            on:upgrade
            on:newGroup />
    {/if}

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
                {#each chats as chatSummary}
                    <ChatSummary
                        {chatSummary}
                        selected={chatIdentifiersEqual($selectedChatId, chatSummary.id)}
                        visible={searchTerm !== "" || !chatSummary.membership.archived}
                        on:chatSelected={chatSelected}
                        on:pinChat
                        on:unpinChat
                        on:archiveChat
                        on:unarchiveChat
                        on:toggleMuteNotifications
                        on:deleteDirectChat />
                {/each}

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
                {#if groupSearchResults !== undefined}
                    <div class="search-matches">
                        {#await groupSearchResults then resp}
                            {#if resp.kind === "success" && resp.matches.length > 0}
                                <h3 class="search-subtitle">{$_("publicGroups")}</h3>
                                {#each resp.matches as group, i (group.chatId.groupId)}
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
            </div>
            {#if showWhatsHot}
                <div class="hot-groups" on:click={() => page("/hotgroups")}>
                    <div class="flame">🔥</div>
                    <div class="label">{$_("whatsHotButton")}</div>
                    <div on:click={() => discoverHotGroupsDismissed.set(true)} class="close">
                        <Close viewBox="0 -3 24 24" size={$iconSize} color={"var(--button-txt)"} />
                    </div>
                </div>
            {/if}
            {#if showBrowseChannnels}
                <div class="browse-channels" on:click={showChannels}>
                    <div class="flame">#</div>
                    <div class="label">{$_("communities.browseChannels")}</div>
                </div>
            {/if}
        {/if}
    </div>
    <NotificationsBar />
{/if}

<style lang="scss">
    .body {
        overflow: auto;
        flex: auto;
        @include nice-scrollbar();
        position: relative;
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

    .hot-groups,
    .browse-channels {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: toRem(80);
        border-top: 1px solid var(--bd);
        border-bottom: 1px solid var(--bd);
        padding: $sp4;
        gap: toRem(12);
        cursor: pointer;

        @include mobile() {
            padding: $sp3 $sp4;
        }

        .label {
            flex: auto;
        }

        .close {
            flex: 0 0 toRem(20);
        }

        .flame {
            display: grid;
            align-content: center;
            @include font-size(fs-120);
            text-align: center;
            flex: 0 0 toRem(48);
            height: toRem(48);
            width: toRem(48);
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
        }
    }
</style>
