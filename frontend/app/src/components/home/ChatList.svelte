<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import SelectedCommunityHeader from "./communities/SelectedCommunityHeader.svelte";
    import ChatListSearch from "./ChatListSearch.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import {
        type ChatListScope,
        type ChatSummary as ChatSummaryType,
        type GroupMatch,
        type UserSummary,
        OpenChat,
        type GroupSearchResponse,
        routeForChatIdentifier,
        chatIdentifiersEqual,
        emptyCombinedUnreadCounts,
        chatIdentifierToString,
        type CombinedUnreadCounts,
        userStore,
        currentUser as createdUser,
        selectedChatId,
        chatListScopeStore as chatListScope,
        numberOfThreadsStore,
        selectedCommunity,
        chatSummariesListStore,
        unreadDirectCounts,
        unreadGroupCounts,
        unreadFavouriteCounts,
        unreadCommunityChannelCounts,
        type BotMatch,
    } from "openchat-client";
    import { afterUpdate, beforeUpdate, createEventDispatcher, getContext, tick } from "svelte";
    import SearchResult from "./SearchResult.svelte";
    import page from "page";
    import Button from "../Button.svelte";
    import { menuCloser } from "../../actions/closeMenu";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import { chatListView } from "../../stores/chatListView";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { exploreGroupsDismissed } from "../../stores/settings";
    import GroupChatsHeader from "./communities/GroupChatsHeader.svelte";
    import DirectChatsHeader from "./communities/DirectChatsHeader.svelte";
    import FavouriteChatsHeader from "./communities/FavouriteChatsHeader.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import { routeForScope } from "../../routes";
    import ButtonGroup from "../ButtonGroup.svelte";
    import FilteredUsername from "../FilteredUsername.svelte";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";
    import Badges from "./profile/Badges.svelte";
    import BrowseChannels from "./communities/details/BrowseChannels.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ActiveCallSummary from "./video/ActiveCallSummary.svelte";
    import { publish } from "@src/utils/pubsub";

    const client = getContext<OpenChat>("client");

    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userAndBotSearchResults: Promise<(UserSummary | BotMatch)[]> | undefined = undefined;
    let searchTerm: string = "";
    let searchResultsAvailable: boolean = false;
    let chatsScrollTop: number = 0;
    let previousScope: ChatListScope | undefined = $chatListScope;
    let previousView: "chats" | "threads" = $chatListView;

    const dispatch = createEventDispatcher();

    $: showPreview =
        $mobileWidth &&
        $selectedCommunity?.membership.role === "none" &&
        $selectedChatId === undefined;
    $: user = $userStore.get($createdUser.userId);
    $: lowercaseSearch = searchTerm.toLowerCase();
    $: showExploreGroups =
        ($chatListScope.kind === "none" || $chatListScope.kind === "group_chat") &&
        !$exploreGroupsDismissed &&
        !searchResultsAvailable;
    $: showBrowseChannnels = $chatListScope.kind === "community";

    let unreadCounts = emptyCombinedUnreadCounts();
    $: {
        switch ($chatListScope.kind) {
            case "group_chat": {
                unreadCounts = $unreadGroupCounts;
                break;
            }
            case "direct_chat": {
                unreadCounts = $unreadDirectCounts;
                break;
            }
            case "favourite": {
                unreadCounts = $unreadFavouriteCounts;
                break;
            }
            case "community": {
                unreadCounts =
                    $unreadCommunityChannelCounts.get($chatListScope.id) ??
                    emptyCombinedUnreadCounts();
                break;
            }
            default:
                unreadCounts = emptyCombinedUnreadCounts();
        }
    }

    $: canMarkAllRead = anythingUnread(unreadCounts);
    $: {
        if ($numberOfThreadsStore === 0) {
            chatListView.set("chats");
        }
    }
    $: {
        if ($chatListView === "threads" && searchTerm !== "") {
            chatListView.set("chats");
        }
    }

    function anythingUnread(unread: CombinedUnreadCounts): boolean {
        return (
            unread.chats.muted +
                unread.chats.unmuted +
                unread.threads.muted +
                unread.threads.unmuted >
            0
        );
    }

    function cancelPreview() {
        if ($selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
            page(routeForScope(client.getDefaultScope()));
        }
    }

    function chatMatchesSearch(chat: ChatSummaryType): boolean {
        if (chat.kind === "group_chat" || chat.kind === "channel") {
            return (
                chat.name.toLowerCase().indexOf(lowercaseSearch) >= 0 ||
                chat.description.toLowerCase().indexOf(lowercaseSearch) >= 0
            );
        }

        if (chat.kind === "direct_chat") {
            const user = $userStore.get(chat.them.userId);
            if (user !== undefined) {
                return (
                    user.username.toLowerCase().indexOf(lowercaseSearch) >= 0 ||
                    (user.displayName !== undefined &&
                        user.displayName.toLowerCase().indexOf(lowercaseSearch) >= 0)
                );
            } else {
                return false;
            }
        }
        return false;
    }

    $: chats =
        searchTerm !== ""
            ? $chatSummariesListStore.filter(chatMatchesSearch)
            : $chatSummariesListStore;

    function chatWith(userId: string): void {
        publish("chatWith", { kind: "direct_chat", userId });
    }

    /**
     * All we need to do here is push the route
     * the routing will take care of the rest
     */
    function selectGroup({ chatId }: GroupMatch): void {
        page(routeForChatIdentifier($chatListScope.kind, chatId));
        searchTerm = "";
    }

    function chatSelected({ id }: ChatSummaryType): void {
        const url = routeForChatIdentifier($chatListScope.kind, id);
        page(url);
        searchTerm = "";
    }

    let chatListElement: HTMLElement;

    beforeUpdate(() => {
        if (
            previousScope === $chatListScope &&
            $chatListView !== "chats" &&
            previousView === "chats"
        ) {
            chatsScrollTop = chatListElement?.scrollTop;
        }
    });

    afterUpdate(() => {
        if (previousScope !== $chatListScope) {
            onScopeChanged();
        } else if (previousView !== $chatListView) {
            onViewChanged();
        }
    });

    function setView(view: "chats" | "threads"): void {
        chatListView.set(view);

        if (view === "threads") {
            searchTerm = "";
        }
    }

    function onScopeChanged() {
        previousScope = $chatListScope;
        chatListView.set("chats");
        chatsScrollTop = 0;
        onViewChanged();
    }

    function onViewChanged() {
        previousView = $chatListView;
        const scrollTop = previousView === "chats" ? chatsScrollTop : 0;
        tick().then(() => {
            if (chatListElement !== undefined) {
                chatListElement.scrollTop = scrollTop;
            }
        });
    }

    function markAllRead() {
        client.markAllReadForCurrentScope();
    }

    function userOrBotKey(match: UserSummary | BotMatch): string {
        switch (match.kind) {
            case "bot_match":
                return match.id;
            default:
                return match.userId;
        }
    }
</script>

<!-- svelte-ignore missing-declaration -->
{#if user}
    {#if $chatListScope.kind === "favourite"}
        <FavouriteChatsHeader on:markAllRead={markAllRead} {canMarkAllRead} />
    {:else if $chatListScope.kind === "group_chat"}
        <GroupChatsHeader on:markAllRead={markAllRead} {canMarkAllRead} on:newGroup />
    {:else if $chatListScope.kind === "direct_chat"}
        <DirectChatsHeader on:markAllRead={markAllRead} {canMarkAllRead} />
    {:else if $selectedCommunity && $chatListScope.kind === "community"}
        <SelectedCommunityHeader
            community={$selectedCommunity}
            {canMarkAllRead}
            on:markAllRead={markAllRead}
            on:leaveCommunity
            on:editCommunity
            on:communityDetails
            on:newChannel />
    {/if}

    <ChatListSearch
        bind:userAndBotsSearchResults={userAndBotSearchResults}
        bind:groupSearchResults
        bind:searchResultsAvailable
        bind:searchTerm />

    {#if $numberOfThreadsStore > 0}
        <div class="section-selector">
            <ChatListSectionButton
                on:click={() => setView("chats")}
                unread={unreadCounts.chats}
                title={i18nKey("chats")}
                selected={$chatListView === "chats"} />
            <ChatListSectionButton
                unread={unreadCounts.threads}
                on:click={() => setView("threads")}
                title={i18nKey("thread.previewTitle")}
                selected={$chatListView === "threads"} />
        </div>
    {/if}

    <div use:menuCloser bind:this={chatListElement} class="body">
        {#if $chatListView === "threads"}
            <ThreadPreviews />
        {:else}
            <div class="chat-summaries">
                {#if searchResultsAvailable && chats.length > 0}
                    <h3 class="search-subtitle">
                        <Translatable resourceKey={i18nKey("yourChats")} />
                    </h3>
                {/if}
                {#each chats as chatSummary (chatIdentifierToString(chatSummary.id))}
                    <ChatSummary
                        {chatSummary}
                        selected={chatIdentifiersEqual($selectedChatId, chatSummary.id)}
                        visible={searchTerm !== "" || !chatSummary.membership.archived}
                        onChatSelected={chatSelected}
                        onLeaveGroup={(ev) => dispatch("leaveGroup", ev)}
                        onUnarchiveChat={(chatId) => dispatch("unarchiveChat", chatId)}
                        onToggleMuteNotifications={(chatId, mute) =>
                            dispatch("toggleMuteNotifications", { chatId, mute })} />
                {/each}

                {#if userAndBotSearchResults !== undefined}
                    <div class="search-matches">
                        {#await userAndBotSearchResults then resp}
                            {#if resp.length > 0}
                                <h3 class="search-subtitle">
                                    <Translatable resourceKey={i18nKey("usersAndBots")} />
                                </h3>
                                {#each resp as match, i (userOrBotKey(match))}
                                    {#if match.kind === "bot_match"}
                                        <SearchResult
                                            bot
                                            index={i}
                                            avatarUrl={match.avatarUrl ?? "/assets/bot_avatar.svg"}
                                            onclick={() => chatWith(match.id)}>
                                            <div class="user-result">
                                                <h4>
                                                    <FilteredUsername
                                                        {searchTerm}
                                                        username={match.name} />
                                                </h4>
                                                <div class="username">
                                                    {match.definition.description}
                                                </div>
                                            </div>
                                        </SearchResult>
                                    {:else}
                                        <SearchResult
                                            index={i}
                                            avatarUrl={client.userAvatarUrl(match)}
                                            onclick={() => chatWith(match.userId)}>
                                            <div class="user-result">
                                                <h4>
                                                    <FilteredUsername
                                                        {searchTerm}
                                                        username={match.displayName ??
                                                            match.username} />

                                                    <Badges
                                                        uniquePerson={match.isUniquePerson}
                                                        diamondStatus={match.diamondStatus}
                                                        streak={client.getStreak(match.userId)} />
                                                </h4>
                                                <div class="username">
                                                    <FilteredUsername
                                                        {searchTerm}
                                                        username={"@" + match.username} />
                                                </div>
                                            </div>
                                        </SearchResult>
                                    {/if}
                                {/each}
                            {/if}
                        {/await}
                    </div>
                {/if}
                {#if groupSearchResults !== undefined}
                    <div class="search-matches">
                        {#await groupSearchResults then resp}
                            {#if resp.kind === "success" && resp.matches.length > 0}
                                <h3 class="search-subtitle">
                                    <Translatable resourceKey={i18nKey("publicGroups")} />
                                </h3>
                                {#each resp.matches as group, i (group.chatId.groupId)}
                                    <SearchResult
                                        index={i}
                                        avatarUrl={client.groupAvatarUrl(
                                            {
                                                ...group,
                                                id: group.chatId,
                                            },
                                            $selectedCommunity,
                                        )}
                                        onclick={() => selectGroup(group)}>
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
            {#if showExploreGroups}
                <div class="explore-groups" on:click={() => page("/groups")}>
                    <div class="disc">
                        <Compass size={$iconSize} color={"var(--icon-txt)"} />
                    </div>
                    <div class="label">
                        <Translatable resourceKey={i18nKey("exploreGroups")} />
                    </div>
                    <div on:click={() => exploreGroupsDismissed.set(true)} class="close">
                        <Close viewBox="0 -3 24 24" size={$iconSize} color={"var(--button-txt)"} />
                    </div>
                </div>
            {/if}
            {#if showBrowseChannnels}
                <BrowseChannels {searchTerm} />
            {/if}
        {/if}
    </div>
    <ActiveCallSummary />
    {#if showPreview}
        <PreviewWrapper let:joiningCommunity let:joinCommunity>
            <div class="join">
                <ButtonGroup align="center">
                    <Button secondary small on:click={cancelPreview}>
                        <Translatable resourceKey={i18nKey("leave")} />
                    </Button>
                    <Button
                        loading={joiningCommunity}
                        disabled={joiningCommunity}
                        on:click={joinCommunity}
                        ><Translatable
                            resourceKey={i18nKey("communities.joinCommunity")} /></Button>
                </ButtonGroup>
            </div>
        </PreviewWrapper>
    {/if}
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

    .join {
        position: sticky;
        bottom: 0;
        padding: $sp3 $sp4;
        background-color: var(--entry-bg);
    }

    .section-selector {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        margin: 0 $sp4 $sp4 $sp4;
        gap: $sp3;
        @include mobile() {
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

    .explore-groups {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: toRem(80);
        border-top: var(--bw) solid var(--bd);
        border-bottom: var(--bw) solid var(--bd);
        padding: $sp4;
        gap: toRem(12);
        cursor: pointer;

        @include mobile() {
            padding: $sp3 toRem(10);
        }

        .label {
            flex: auto;
        }

        .disc {
            display: flex;
            align-items: center;
            justify-content: center;
            align-content: center;
            text-align: center;
            height: toRem(48);
            width: toRem(48);
            background-color: var(--icon-hv);
            border-radius: 50%;
        }
    }

    .user-result {
        flex: 1;
        display: flex;
        flex-direction: column;

        h4 {
            display: flex;
            align-items: center;
            gap: $sp2;
        }

        .username {
            font-weight: 200;
            color: var(--txt-light);
            @include clamp();
        }
    }
</style>
