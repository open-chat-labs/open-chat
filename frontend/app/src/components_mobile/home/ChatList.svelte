<script lang="ts">
    import { chatListFilterStore } from "@src/stores/settings";
    import { CommonButton, Container, FloatingButton } from "component-lib";
    import {
        allUsersStore,
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
    } from "openchat-client";
    import page from "page";
    import { getContext, tick } from "svelte";
    import Pencil from "svelte-material-icons/LeadPencil.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import ChatListFilters, { type ChatListFilter } from "./ChatListFilters.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import DirectAndGroupChatsHeader from "./communities/DirectAndGroupChatsHeader.svelte";
    import FavouriteChatsHeader from "./communities/FavouriteChatsHeader.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import SelectedCommunityHeader from "./communities/SelectedCommunityHeader.svelte";
    import NoMatchingChats from "./NoMatchingChats.svelte";
    import ThreadIndicator from "./ThreadIndicator.svelte";

    const client = getContext<OpenChat>("client");
    const TO_SHOW = 30;

    let previousScope: ChatListScope = $chatListScopeStore;
    let chatsToShow = $state(TO_SHOW);
    let rendering = $state(false);
    function insideBottom() {
        if (rendering || chatsToShow >= filteredChats.length) return;
        rendering = true;
        chatsToShow = Math.min(filteredChats.length, chatsToShow + TO_SHOW / 2);
        tick().then(() => (rendering = false));
    }

    $effect(() => {
        if (!chatListScopesEqual(previousScope, $chatListScopeStore)) {
            onScopeChanged();
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

    function chatSelected({ id }: ChatSummaryType): void {
        const url = routeForChatIdentifier($chatListScopeStore.kind, id);
        page(url);
    }

    function onScopeChanged() {
        previousScope = $chatListScopeStore;
    }

    let showPreview = $derived(
        $selectedCommunitySummaryStore?.membership.role === ROLE_NONE &&
            $selectedChatIdStore === undefined,
    );
    let user = $derived($allUsersStore.get($currentUserIdStore));
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
    let allChats = $derived($chatSummariesListStore);
    let filteredChats = $derived.by(() => {
        if ($chatListScopeStore.kind !== "chats") return allChats;
        return allChats.filter((c) => {
            return (
                $chatListFilterStore === "all" ||
                ($chatListFilterStore === "unread" &&
                    client.unreadMessageCount(c.id, c.latestMessage?.event.messageIndex) > 0) ||
                ($chatListFilterStore === "direct" && c.kind === "direct_chat") ||
                ($chatListFilterStore === "groups" && c.kind === "group_chat")
            );
        });
    });

    let chats = $derived(filteredChats.slice(0, chatsToShow));

    function newMessage() {
        publish("newMessage");
    }
</script>

{#if user}
    {#if $chatListScopeStore.kind === "chats"}
        <DirectAndGroupChatsHeader {canMarkAllRead} />
    {:else if $chatListScopeStore.kind === "favourite"}
        <FavouriteChatsHeader {canMarkAllRead} />
    {:else if $selectedCommunitySummaryStore && $chatListScopeStore.kind === "community"}
        <SelectedCommunityHeader community={$selectedCommunitySummaryStore} {canMarkAllRead} />
    {/if}

    {#if $chatListScopeStore.kind === "chats"}
        <ChatListFilters bind:filter={$chatListFilterStore as ChatListFilter} />
    {/if}

    <Container
        supplementalClass={"chat_summary_list"}
        closeMenuOnScroll
        gap={"lg"}
        onInsideEnd={insideBottom}
        width={"fill"}
        height={"fill"}
        direction={"vertical"}>
        {#if chats.length === 0}
            <NoMatchingChats onReset={() => chatListFilterStore.set("all")} />
        {:else}
            {#if $numberOfThreadsStore > 0}
                <ThreadIndicator
                    onClick={() => publish("showThreads")}
                    unread={unreadCounts.threads} />
            {/if}
            {#each chats as chatSummary (chatIdentifierToString(chatSummary.id))}
                <ChatSummary
                    {chatSummary}
                    selected={chatIdentifiersEqual($selectedChatIdStore, chatSummary.id)}
                    visible={!chatSummary.membership.archived}
                    onChatSelected={chatSelected} />
            {/each}
        {/if}
    </Container>
    {#if showPreview}
        <PreviewWrapper>
            {#snippet children(joiningCommunity, joinCommunity)}
                <div class="join">
                    <Container crossAxisAlignment={"end"} mainAxisAlignment={"end"} gap={"md"}>
                        <CommonButton onClick={cancelPreview}>
                            <Translatable resourceKey={i18nKey("close")} />
                        </CommonButton>

                        <CommonButton
                            mode={"active"}
                            loading={joiningCommunity}
                            disabled={joiningCommunity}
                            onClick={joinCommunity}>
                            <Translatable resourceKey={i18nKey("communities.joinCommunity")} />
                        </CommonButton>
                    </Container>
                </div>
            {/snippet}
        </PreviewWrapper>
    {/if}
{/if}

{#if $chatListScopeStore.kind === "chats"}
    <div class="floating">
        <FloatingButton onClick={newMessage}>
            {#snippet icon(color)}
                <Pencil {color}></Pencil>
            {/snippet}
        </FloatingButton>
    </div>
{/if}

<style lang="scss">
    .join {
        position: sticky;
        bottom: 0;
        padding: $sp3 $sp4;
        background-color: var(--entry-bg);
        width: 100%;
    }

    .floating {
        position: absolute;
        bottom: var(--sp-md);
        right: var(--sp-md);
    }
</style>
