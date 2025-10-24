<script lang="ts">
    import { Container, FloatingButton } from "component-lib";
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
    import { chatListView } from "../../stores/chatListView";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Translatable from "../Translatable.svelte";
    import ChatListFilters, { type ChatListFilter } from "./ChatListFilters.svelte";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import DirectAndGroupChatsHeader from "./communities/DirectAndGroupChatsHeader.svelte";
    import FavouriteChatsHeader from "./communities/FavouriteChatsHeader.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import SelectedCommunityHeader from "./communities/SelectedCommunityHeader.svelte";
    import ThreadPreviews from "./thread/ThreadPreviews.svelte";
    import ActiveCallSummary from "./video/ActiveCallSummary.svelte";

    const client = getContext<OpenChat>("client");
    const TO_SHOW = 30;

    let previousScope: ChatListScope = $chatListScopeStore;
    let previousView: "chats" | "threads" = $chatListView;
    let chatListFilter = $state<ChatListFilter>("all");
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

    function chatSelected({ id }: ChatSummaryType): void {
        const url = routeForChatIdentifier($chatListScopeStore.kind, id);
        page(url);
    }

    function setView(view: "chats" | "threads"): void {
        chatListView.set(view);
    }

    function onScopeChanged() {
        previousScope = $chatListScopeStore;
        chatListView.set("chats");
        onViewChanged();
    }

    function onViewChanged() {
        previousView = $chatListView;
        chatsToShow = TO_SHOW;
        chatListFilter = "all";
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
    $effect(() => {
        if ($numberOfThreadsStore === 0) {
            chatListView.set("chats");
        }
    });

    let allChats = $derived($chatSummariesListStore);
    let filteredChats = $derived.by(() => {
        return allChats.filter((c) => {
            return (
                chatListFilter === "all" ||
                (chatListFilter === "unread" &&
                    client.unreadMessageCount(c.id, c.latestMessage?.event.messageIndex) > 0) ||
                (chatListFilter === "direct" && c.kind === "direct_chat") ||
                (chatListFilter === "groups" && c.kind === "group_chat")
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
        <ChatListFilters bind:filter={chatListFilter} />
    {:else if $chatListScopeStore.kind === "community"}
        {#if $numberOfThreadsStore > 0}
            <Container mainAxisAlignment={"spaceBetween"} padding={["sm", "md"]} gap={"sm"}>
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
            </Container>
        {/if}
    {/if}

    <Container width={{ kind: "fill" }} height={{ kind: "fill" }} direction={"vertical"}>
        {#if $chatListView === "threads"}
            <ThreadPreviews />
        {:else}
            <Container
                supplementalClass={"chat_summary_list"}
                closeMenuOnScroll
                onInsideEnd={insideBottom}
                width={{ kind: "fill" }}
                height={{ kind: "fill" }}
                direction={"vertical"}>
                {#each chats as chatSummary (chatIdentifierToString(chatSummary.id))}
                    <ChatSummary
                        {chatSummary}
                        selected={chatIdentifiersEqual($selectedChatIdStore, chatSummary.id)}
                        visible={!chatSummary.membership.archived}
                        onChatSelected={chatSelected} />
                {/each}
            </Container>
        {/if}
    </Container>
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
    }

    .floating {
        position: absolute;
        bottom: var(--sp-md);
        right: var(--sp-md);
    }
</style>
