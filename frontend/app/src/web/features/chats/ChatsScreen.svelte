<!-- The left column's chat list (region "chats"): DMs and groups, favourites, or a community's channels,
     as the route's scope says (DATA.md, ChatListPanel rows). Picking a chat routes to it. -->
<script lang="ts">
    import { chatMenuActions } from "@src/logic/chats/chatMenu";
    import { muteChat } from "@src/logic/chats/muteChat";
    import { communityMenuPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        allUsersStore,
        bridgedUsersStore,
        canRemoveFromList,
        chatIdentifierToString,
        chatsInitialisedStore,
        chatSummariesListStore,
        currentUserIdStore,
        favouritesStore,
        i18nKey,
        messagesRead,
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
    import { interpolate } from "@i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { withQueryStringFlag } from "@src/utils/urls";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { showInRightColumn } from "../app/rightPanel";
    import {
        chatRow,
        communityHeaderMenu,
        listed,
        type ChatListRow,
        type RowContext,
    } from "./chatList.adapter";
    import { latestMessagePreview } from "@src/logic/chats/latestMessagePreview";
    import { buildDisplayName } from "@src/utils/user";

    let { region, context: screen }: ScreenProps<Extract<LeftRegion, { kind: "chats" }>> =
        $props();

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
                    bridgedUsers: { get: (key) => $bridgedUsersStore.get(key) },
                    users,
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

    async function setPinned(chatId: ChatSummary["id"], pin: boolean) {
        const success = await (pin ? client.pinChat(chatId) : client.unpinChat(chatId));
        if (!success) toastStore.showFailureToast(pinChatFailureMessage(pin));
    }

    async function toggleMute(chatId: ChatSummary["id"], mute: boolean) {
        const failed = await muteChat(client, chatId, mute, undefined, $_);
        if (failed !== undefined) toastStore.showFailureToast(failed);
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
        items.push(
            chat.membership.archived
                ? // opening an archived chat un-archives it
                  { label: $_("unarchiveChat"), onSelect: () => select(row.id) }
                : { label: $_("archiveChat"), onSelect: () => archive(chat) },
        );
        const actions = chatMenuActions(chat, {
            canLeave: chat.kind !== "direct_chat" && client.canLeaveGroup(chat.id),
            blocked: false,
            isBot: false,
        });
        if (actions.includes("leave") && chat.kind !== "direct_chat") {
            items.push({
                label: interpolate($_, i18nKey("leaveGroup", undefined, chat.level, true)),
                variant: "danger",
                onSelect: () =>
                    screen.dialogs.open({
                        kind: "leave_or_delete",
                        action: { kind: "leave", chatId: chat.id },
                        name: row.title,
                    }),
            });
        }
        if (actions.includes("delete") && chat.kind === "direct_chat") {
            items.push({
                label: $_("deleteChat"),
                variant: "danger",
                onSelect: () =>
                    screen.dialogs.open({
                        kind: "leave_or_delete",
                        action: { kind: "delete_direct_chat", chatId: chat.id, blockUser: false },
                        name: row.title,
                    }),
            });
        }
        if (canRemoveFromList(chat, chat.kind === "channel" ? community : undefined)) {
            items.push({ label: $_("removeChat"), onSelect: () => client.removeFromList(chat) });
        }
        return items;
    }

    async function archive(chat: ChatSummary) {
        if (!(await client.archiveChat(chat.id))) {
            toastStore.showFailureToast(i18nKey("archiveChatFailed"));
        }
    }

    function select(id: string) {
        const chat = chats.find((c) => chatIdentifierToString(c.id) === id);
        if (chat !== undefined) navigate(routeForChatIdentifier(scope.kind, chat.id));
    }

    const community = $derived(
        scope.kind === "community" ? $selectedCommunitySummaryStore : undefined,
    );

    const communityMenu = $derived(
        community === undefined ? undefined : communityMenuPermissions(client, community),
    );
    const headerMenuItems = $derived(
        community === undefined || communityMenu === undefined
            ? undefined
            : communityHeaderMenu({
                  ...communityMenu,
                  allMuted: chats.every((c) => c.membership.notificationsMuted),
                  everyoneMuted: chats.every((c) => c.membership.atEveryoneMuted),
                  label: $_,
              }),
    );

    // TODO: the thread count (L1). TODO(4b): the community's edit, invite and new channel items
    // (parts 2 to 4)
    function onHeaderMenu(item: string) {
        if (item === "markAllRead") {
            client.markAllReadForCurrentScope();
            return;
        }
        if (community === undefined) return;
        switch (item) {
            case "details":
                showInRightColumn(screen.rightColumn, { kind: "community_details" });
                break;
            case "members":
                showInRightColumn(screen.rightColumn, { kind: "show_community_members" });
                break;
            case "muteAll":
            case "muteAllEveryone":
                client.muteAllChannels(community.id, item === "muteAllEveryone");
                break;
            case "delete":
            case "leave":
                screen.dialogs.open({
                    kind: "leave_or_delete",
                    action: {
                        kind: item === "delete" ? "delete_community" : "leave_community",
                        id: community.id,
                    },
                    name: community.name,
                });
                break;
        }
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
    headerMenuItems={headerMenuItems}
    {onHeaderMenu}
    searchable
    onSearch={(q) => (query = q)}
    threadsAction={() => navigate(withQueryStringFlag("threads"), "overlay")}
    loading={!$chatsInitialisedStore} />
