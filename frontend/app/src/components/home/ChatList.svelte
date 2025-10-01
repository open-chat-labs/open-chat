<script lang="ts">
    import { scrollLimits } from "component-lib";
    import {
        allUsersStore,
        type BotMatch,
        chatIdentifiersEqual,
        chatIdentifierToString,
        type ChatListScope,
        chatListScopesEqual,
        chatListScopeStore,
        chatSummariesListStore,
        type ChatSummary as ChatSummaryType,
        type CombinedUnreadCounts,
        currentUserIdStore,
        emptyCombinedUnreadCounts,
        type GroupMatch,
        type GroupSearchResponse,
        mobileWidth,
        numberOfThreadsStore,
        OpenChat,
        publish,
        ROLE_NONE,
        routeForChatIdentifier,
        routeForScope,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        unreadCommunityChannelCountsStore,
        unreadDirectAndGroupCountsStore,
        unreadFavouriteCountsStore,
        type UserSummary,
    } from "openchat-client";
    import page from "page";
    import { getContext, tick } from "svelte";
    import { menuCloser } from "../../actions/closeMenu";
    import { i18nKey } from "../../i18n/i18n";
    import { chatListView } from "../../stores/chatListView";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import FilteredUsername from "../FilteredUsername.svelte";
    import Translatable from "../Translatable.svelte";
    import ChatListSearch from "./ChatListSearch.svelte";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import BrowseChannels from "./communities/details/BrowseChannels.svelte";
    import DirectAndGroupChatsHeader from "./communities/DirectAndGroupChatsHeader.svelte";
    import FavouriteChatsHeader from "./communities/FavouriteChatsHeader.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import SelectedCommunityHeader from "./communities/SelectedCommunityHeader.svelte";
    import Badges from "./profile/Badges.svelte";
    import SearchResult from "./SearchResult.svelte";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import ActiveCallSummary from "./video/ActiveCallSummary.svelte";

    const TO_SHOW = 30;
    const client = getContext<OpenChat>("client");

    let groupSearchResults: Promise<GroupSearchResponse> | undefined = $state(undefined);
    let userAndBotSearchResults: Promise<(UserSummary | BotMatch)[]> | undefined =
        $state(undefined);
    let searchTerm: string = $state("");
    let searchResultsAvailable: boolean = $state(false);
    let previousScope: ChatListScope = $chatListScopeStore;
    let previousView: "chats" | "threads" = $chatListView;
    let chatsToShow = $state(TO_SHOW);
    let rendering = $state(false);

    function insideBottom() {
        if (rendering) return;
        rendering = true;
        chatsToShow = Math.min(allMatchingChats.length, chatsToShow + TO_SHOW / 2);
        tick().then(() => (rendering = false));
    }

    $effect(() => {
        if (!chatListScopesEqual(previousScope, $chatListScopeStore)) {
            onScopeChanged();
        } else if (previousView !== $chatListView) {
            onViewChanged();
        }
    });

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
        if ($selectedCommunitySummaryStore) {
            client.removeCommunity($selectedCommunitySummaryStore.id);
            page(routeForScope(client.getDefaultScope()));
        }
    }

    function chatWith(userId: string): void {
        publish("chatWith", { kind: "direct_chat", userId });
    }

    /**
     * All we need to do here is push the route
     * the routing will take care of the rest
     */
    function selectGroup({ chatId }: GroupMatch): void {
        page(routeForChatIdentifier($chatListScopeStore.kind, chatId));
        searchTerm = "";
    }

    function chatSelected({ id }: ChatSummaryType): void {
        const url = routeForChatIdentifier($chatListScopeStore.kind, id);
        page(url);
        searchTerm = "";
    }

    function setView(view: "chats" | "threads"): void {
        chatListView.set(view);

        if (view === "threads") {
            searchTerm = "";
        }
    }

    function onScopeChanged() {
        previousScope = $chatListScopeStore;
        chatListView.set("chats");
        onViewChanged();
    }

    function onViewChanged() {
        previousView = $chatListView;
        chatsToShow = TO_SHOW;
    }

    function userOrBotKey(match: UserSummary | BotMatch): string {
        switch (match.kind) {
            case "bot_match":
                return match.id;
            default:
                return match.userId;
        }
    }

    let showPreview = $derived(
        $mobileWidth &&
            $selectedCommunitySummaryStore?.membership.role === ROLE_NONE &&
            $selectedChatIdStore === undefined,
    );
    let user = $derived($allUsersStore.get($currentUserIdStore));
    let lowercaseSearch = $derived(searchTerm.toLowerCase());
    let showBrowseChannnels = $derived($chatListScopeStore.kind === "community");
    let unreadCounts = $derived.by(() => {
        switch ($chatListScopeStore.kind) {
            case "chats": {
                return $unreadDirectAndGroupCountsStore;
            }
            case "favourite": {
                return $unreadFavouriteCountsStore;
            }
            case "community": {
                return (
                    $unreadCommunityChannelCountsStore.get($chatListScopeStore.id) ??
                    emptyCombinedUnreadCounts()
                );
            }
            default:
                return emptyCombinedUnreadCounts();
        }
    });
    let canMarkAllRead = $derived(anythingUnread(unreadCounts));
    $effect(() => {
        if ($numberOfThreadsStore === 0) {
            chatListView.set("chats");
        }
    });
    $effect(() => {
        if ($chatListView === "threads" && searchTerm !== "") {
            chatListView.set("chats");
        }
    });
    let allMatchingChats = $derived(
        searchTerm !== ""
            ? $chatSummariesListStore.filter((c) => client.chatMatchesSearch(lowercaseSearch, c))
            : $chatSummariesListStore,
    );
    let chats = $derived(allMatchingChats.slice(0, chatsToShow));
</script>

<!-- svelte-ignore missing_declaration -->
{#if user}
    {#if $chatListScopeStore.kind === "chats"}
        <DirectAndGroupChatsHeader {canMarkAllRead} />
    {:else if $chatListScopeStore.kind === "favourite"}
        <FavouriteChatsHeader {canMarkAllRead} />
    {:else if $selectedCommunitySummaryStore && $chatListScopeStore.kind === "community"}
        <SelectedCommunityHeader community={$selectedCommunitySummaryStore} {canMarkAllRead} />
    {/if}

    <ChatListSearch
        bind:userAndBotsSearchResults={userAndBotSearchResults}
        bind:groupSearchResults
        bind:searchResultsAvailable
        bind:searchTerm />

    {#if $numberOfThreadsStore > 0}
        <div class="section-selector">
            <ChatListSectionButton
                onClick={() => setView("chats")}
                unread={unreadCounts.chats}
                title={i18nKey("chats")}
                selected={$chatListView === "chats"} />
            <ChatListSectionButton
                unread={unreadCounts.threads}
                onClick={() => setView("threads")}
                title={i18nKey("thread.previewTitle")}
                selected={$chatListView === "threads"} />
        </div>
    {/if}

    <div class="body">
        {#if $chatListView === "threads"}
            <ThreadPreviews />
        {:else}
            <div
                use:scrollLimits={{
                    threshold: 200,
                    onEnd: insideBottom,
                }}
                use:menuCloser
                class="chat-summaries">
                {#if searchResultsAvailable && chats.length > 0}
                    <h3 class="search-subtitle">
                        <Translatable resourceKey={i18nKey("yourChats")} />
                    </h3>
                {/if}

                {#each chats as chatSummary (chatIdentifierToString(chatSummary.id))}
                    <ChatSummary
                        {chatSummary}
                        selected={chatIdentifiersEqual($selectedChatIdStore, chatSummary.id)}
                        visible={searchTerm !== "" || !chatSummary.membership.archived}
                        onChatSelected={chatSelected} />
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
                                                        streak={match.streak} />
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
                                            $selectedCommunitySummaryStore,
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
            {#if showBrowseChannnels}
                <BrowseChannels {searchTerm} />
            {/if}
        {/if}
    </div>
    <ActiveCallSummary />
    {#if showPreview}
        <PreviewWrapper>
            {#snippet children(joiningCommunity, joinCommunity)}
                <div class="join">
                    <ButtonGroup align="center">
                        <Button secondary small onClick={cancelPreview}>
                            <Translatable resourceKey={i18nKey("leave")} />
                        </Button>
                        <Button
                            loading={joiningCommunity}
                            disabled={joiningCommunity}
                            onClick={joinCommunity}
                            ><Translatable
                                resourceKey={i18nKey("communities.joinCommunity")} /></Button>
                    </ButtonGroup>
                </div>
            {/snippet}
        </PreviewWrapper>
    {/if}
{/if}

<style lang="scss">
    .body {
        overflow: hidden;
        flex: auto;
        position: relative;
    }
    .chat-summaries {
        height: 100%;
        @include nice-scrollbar();
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
