<!-- The left column's chat list (region "chats"): DMs and groups, favourites, or a community's channels,
     as the route's scope says (DATA.md, ChatListPanel rows). Picking a chat routes to it. -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifierToString,
        chatsInitialisedStore,
        chatSummariesListStore,
        currentUserIdStore,
        favouritesStore,
        messagesRead,
        muteNotificationsFailureMessage,
        pinChatFailureMessage,
        pinnedChatsStore,
        routeForChatIdentifier,
        selectedChatIdStore,
        translationsStore,
        selectedCommunitySummaryStore,
        type ChatSummary,
        type OpenChat,
    } from "@client";
    import ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
    import type { MenuItem } from "@openchat/ui/src/lib/types";
    import { i18nKey } from "@i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { withQueryStringFlag } from "@src/utils/urls";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import {
        chatRow,
        listed,
        unreadCount,
        type ChatListRow,
        type RowContext,
    } from "./chatList.adapter";
    import { AutoUnarchive } from "./autoUnarchive";
    import { latestMessagePreview } from "@src/logic/chats/latestMessagePreview";
    import { buildDisplayName } from "@src/utils/user";

    let { region }: ScreenProps<Extract<LeftRegion, { kind: "chats" }>> = $props();

    const client = getContext<OpenChat>("client");

    const scope = $derived(region.scope);
    const chats = $derived($chatSummariesListStore);
    // the panel's search text: the list searches itself (onSearch), so archived chats can show
    // while it's on
    let query = $state("");

    const context = $derived.by((): RowContext => {
        // read so unread counts follow messages being read
        void $messagesRead;
        const users = $allUsersStore;
        return {
            userName: (userId) => client.displayName(users.get(userId)),
            preview: (chat) =>
                latestMessagePreview(chat, {
                    formatter: $_,
                    me: $currentUserIdStore,
                    displayName: (userId, kind) => buildDisplayName(users, userId, kind, false),
                    translations: $translationsStore,
                    contentText: (content) => client.getContentAsText($_, content),
                }),
            date: (timestamp) =>
                client.formatMessageDate(timestamp, $_("today"), $_("yesterday"), true, true),
            unread: (chat) =>
                client.unreadMessageCount(chat.id, chat.latestMessage?.event.messageIndex),
            pinned: new Set(($pinnedChatsStore.get(scope.kind) ?? []).map(chatIdentifierToString)),
            selected: $selectedChatIdStore && chatIdentifierToString($selectedChatIdStore),
        };
    });

    const listedRows = $derived(
        chats.flatMap((chat) => {
            const row = chatRow(chat, context);
            return listed(chat, query, $allUsersStore) ? [{ chat, row }] : [];
        }),
    );
    const rows = $derived(
        listedRows.map(({ chat, row }): ChatListRow => ({ ...row, menu: menuFor(chat, row) })),
    );

    // An archived chat with unread messages comes out of the archive (as the old row did), with
    // the old UI's toast if it can't (AutoUnarchive: not repeated by itself)
    const autoUnarchive = new AutoUnarchive();
    $effect(() => {
        const ctx = context;
        const states = chats.map((chat) => ({
            id: chatIdentifierToString(chat.id),
            archived: chat.membership.archived,
            unread: chat.membership.archived ? unreadCount(chat, ctx) : 0,
            chat,
        }));
        for (const id of untrack(() => autoUnarchive.next(states))) {
            const state = states.find((s) => s.id === id);
            if (state !== undefined) untrack(() => unarchive(state.chat.id, id));
        }
    });

    function unarchive(chatId: ChatSummary["id"], id: string) {
        client
            .unarchiveChat(chatId)
            .catch(() => false)
            .then((success) => {
                autoUnarchive.settled(id, success);
                if (!success) toastStore.showFailureToast(i18nKey("unarchiveChatFailed"));
            });
    }

    async function setPinned(chatId: ChatSummary["id"], pin: boolean) {
        const success = await (pin ? client.pinChat(chatId) : client.unpinChat(chatId));
        if (!success) toastStore.showFailureToast(pinChatFailureMessage(pin));
    }

    async function toggleMute(chatId: ChatSummary["id"], mute: boolean) {
        const success = await client.toggleMuteNotifications(chatId, mute, undefined);
        if (!success) {
            toastStore.showFailureToast(muteNotificationsFailureMessage(mute, undefined, $_));
        }
    }

    // the row menu, in the app's words (the old row's menu)
    function menuFor(chat: ChatSummary, row: ChatListRow): MenuItem[] {
        const pinned = row.pinned;
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
                ? { label: $_("pinChat.unpinMenuItem"), onSelect: () => setPinned(chat.id, false) }
                : { label: $_("pinChat.menuItem"), onSelect: () => setPinned(chat.id, true) },
            {
                label: $_(muted ? "unmuteNotifications" : "muteNotifications"),
                onSelect: () => toggleMute(chat.id, !muted),
            },
        ];
        if ((row.unreadCount ?? 0) > 0) {
            items.push({ label: $_("markAllRead"), onSelect: () => client.markAllRead(chat) });
        }
        return items;
    }

    function select(id: string) {
        const chat = chats.find((c) => chatIdentifierToString(c.id) === id);
        if (chat !== undefined) navigate(routeForChatIdentifier(scope.kind, chat.id));
    }

    const community = $derived(
        scope.kind === "community" ? $selectedCommunitySummaryStore : undefined,
    );

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
    headerTitle={community?.name ??
        (scope.kind === "favourite" ? $_("communities.favourites") : undefined)}
    headerVisibility={community?.public === false ? "Private" : "Public"}
    headerMembers={community?.memberCount ?? 0}
    {onHeaderMenu}
    searchable
    onSearch={(q) => (query = q)}
    threadsAction={() => navigate(withQueryStringFlag("threads"), "overlay")}
    loading={!$chatsInitialisedStore} />
