<!-- The left column's chat list (region "chats"): DMs and groups, favourites, or a community's channels,
     as the route's scope says (DATA.md, ChatListPanel rows). Picking a chat routes to it. -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifierToString,
        chatListScopeStore,
        chatsInitialisedStore,
        chatSummariesListStore,
        currentUserIdStore,
        favouritesStore,
        messagesRead,
        pinnedChatsStore,
        routeForChatIdentifier,
        routeForScope,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        type ChatSummary,
        type OpenChat,
    } from "@client";
    import ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
    import type { MenuItem } from "@openchat/ui/src/lib/types";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { chatRow, type ChatListRow, type RowContext } from "./chatList.adapter";

    let { region }: ScreenProps<Extract<LeftRegion, { kind: "chats" }>> = $props();

    const client = getContext<OpenChat>("client");

    const scope = $derived(region.scope);
    const chats = $derived($chatSummariesListStore);
    const byId = $derived(new Map(chats.map((chat) => [chatIdentifierToString(chat.id), chat])));

    const context = $derived.by((): RowContext => {
        // read so unread counts follow messages being read
        void $messagesRead;
        const users = $allUsersStore;
        return {
            me: $currentUserIdStore,
            you: $_("you"),
            userName: (userId) => client.displayName(users.get(userId)),
            contentText: (content) => client.getContentAsText($_, content),
            date: (timestamp) =>
                client.formatMessageDate(timestamp, $_("today"), $_("yesterday"), true, true),
            unread: (chat) =>
                client.unreadMessageCount(chat.id, chat.latestMessage?.event.messageIndex),
            pinned: new Set(($pinnedChatsStore.get(scope.kind) ?? []).map(chatIdentifierToString)),
            selected: $selectedChatIdStore && chatIdentifierToString($selectedChatIdStore),
        };
    });

    const rows = $derived(
        chats.map((chat): ChatListRow => ({ ...chatRow(chat, context), menu: menuFor(chat) })),
    );

    // the row menu, in the app's words (the old row's menu)
    function menuFor(chat: ChatSummary): MenuItem[] {
        const id = chatIdentifierToString(chat.id);
        const pinned = context.pinned.has(id);
        const favourite = $favouritesStore.has(chat.id);
        const muted = chat.membership.notificationsMuted;
        const items: MenuItem[] = [
            favourite
                ? {
                      label: $_("communities.removeFromFavourites"),
                      onSelect: () => client.removeFromFavourites(chat.id),
                  }
                : {
                      label: $_("communities.addToFavourites"),
                      onSelect: () => client.addToFavourites(chat.id),
                  },
            pinned
                ? { label: $_("pinChat.unpinMenuItem"), onSelect: () => client.unpinChat(chat.id) }
                : { label: $_("pinChat.menuItem"), onSelect: () => client.pinChat(chat.id) },
            {
                label: $_(muted ? "unmuteNotifications" : "muteNotifications"),
                onSelect: () => client.toggleMuteNotifications(chat.id, !muted, undefined),
            },
        ];
        if (context.unread(chat) > 0) {
            items.push({ label: $_("markAllRead"), onSelect: () => client.markAllRead(chat) });
        }
        return items;
    }

    function select(id: string) {
        const chat = byId.get(id);
        if (chat !== undefined) navigate(routeForChatIdentifier($chatListScopeStore.kind, chat.id));
    }

    const community = $derived(scope.kind === "community" ? $selectedCommunitySummaryStore : undefined);

    // TODO(phase 3): the thread count, and the community header's other menu items (they open
    // dialogs that later phases build)
    function onHeaderMenu(item: string) {
        if (item === "markAllRead") client.markAllReadForCurrentScope();
    }
</script>

<ChatListPanel
    {rows}
    onSelect={select}
    headerKind={community ? "community" : "dms"}
    headerTitle={community?.name ?? (scope.kind === "favourite" ? $_("communities.favourites") : undefined)}
    headerVisibility={community?.public === false ? "Private" : "Public"}
    headerMembers={community?.memberCount ?? 0}
    {onHeaderMenu}
    searchable
    threadsAction={() => navigate(`${routeForScope(scope)}/threads`)}
    loading={!$chatsInitialisedStore} />
