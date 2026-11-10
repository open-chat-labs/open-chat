<!-- The left column's chat list (region "chats"): DMs and groups, favourites, or a community's channels,
     as the route's scope says (DATA.md, ChatListPanel rows). Picking a chat routes to it. -->
<script lang="ts">
    import {
        chatRowActionLabel,
        chatRowMenu,
        chatRowHasMenu,
        type ChatRowAction,
    } from "@src/logic/chats/chatMenu";
    import { muteChat } from "@src/logic/chats/muteChat";
    import { signInFirst } from "@src/logic/auth/guestPass";
    import {
        communityDetailsPermissions,
        communityMenuPermissions,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
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
        numberOfThreadsStore,
        pinChatFailureMessage,
        pinnedChatsStore,
        routeForChatIdentifier,
        selectedChatIdStore,
        translationsStore,
        selectedCommunitySummaryStore,
        type ChatSummary,
        type OpenChat,
        anonUserStore,
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
    import { communityHeaderMenu, type ChatListPanelRow } from "./chatList.adapter";
    import {
        chatRow,
        listed,
        rowContext,
        type ChatListRow,
        type RowContext,
    } from "@src/logic/chats/chatRow";

    let { region, context: screen }: ScreenProps<Extract<LeftRegion, { kind: "chats" }>> = $props();

    const client = getContext<OpenChat>("client");

    const scope = $derived(region.scope);
    const chats = $derived($chatSummariesListStore);
    // the panel's search text: the list searches itself (onSearch), so archived chats can show
    // while it's on
    let query = $state("");

    const context = $derived.by((): RowContext => {
        // read so unread counts follow messages being read
        void $messagesRead;
        return rowContext(client, {
            formatter: $_,
            me: $currentUserIdStore,
            users: $allUsersStore,
            translations: $translationsStore,
            bridgedUsers: { get: (key) => $bridgedUsersStore.get(key) },
            pinned: $pinnedChatsStore.get(scope.kind) ?? [],
            selected: $selectedChatIdStore,
        });
    });

    const listedRows = $derived(
        chats.flatMap((chat) => {
            const row = chatRow(chat, context);
            return listed(chat, query, $allUsersStore) ? [{ chat, row }] : [];
        }),
    );
    const rows = $derived(
        listedRows.map(
            ({ chat, row }): ChatListPanelRow => ({ ...row, menu: menuFor(chat, row) }),
        ),
    );

    async function setPinned(chatId: ChatSummary["id"], pin: boolean) {
        const success = await (pin ? client.pinChat(chatId) : client.unpinChat(chatId));
        if (!success) toastStore.showFailureToast(pinChatFailureMessage(pin));
    }

    async function toggleMute(chatId: ChatSummary["id"], mute: boolean) {
        const failed = await muteChat(client, chatId, mute, undefined, $_);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    }

    // the row menu, in the app's words (chatRowMenu); a preview's row has none, a guest's or
    // anyone's (chatRowHasMenu)
    function menuFor(chat: ChatSummary, row: ChatListRow): MenuItem[] {
        if (!chatRowHasMenu(chat)) return [];
        const actions = chatRowMenu(chat, {
            pinned: row.pinned,
            favourite: $favouritesStore.has(chat.id),
            unread: row.unreadCount,
            canLeave: chat.kind !== "direct_chat" && client.canLeaveGroup(chat.id),
            canRemove: canRemoveFromList(chat, chat.kind === "channel" ? community : undefined),
        });
        return actions.map((action) => menuItem(action, chat, row));
    }

    function menuItem(action: ChatRowAction, chat: ChatSummary, row: ChatListRow): MenuItem {
        const label = interpolate($_, chatRowActionLabel(action, chat));
        switch (action) {
            case "favourite":
                return { label, onSelect: () => client.addToFavourites(chat.id) };
            case "unfavourite":
                return { label, onSelect: () => client.removeFromFavourites(chat.id) };
            case "pin":
                return { label, onSelect: () => setPinned(chat.id, true) };
            case "unpin":
                return { label, onSelect: () => setPinned(chat.id, false) };
            case "mute":
            case "unmute":
                return { label, onSelect: () => toggleMute(chat.id, action === "mute") };
            case "mark_read":
                return { label, onSelect: () => client.markAllRead(chat) };
            case "archive":
                return { label, onSelect: () => archive(chat) };
            case "unarchive":
                // opening an archived chat un-archives it
                return { label, onSelect: () => select(row.id) };
            case "leave":
            case "delete":
                return { label, variant: "danger", onSelect: () => leaveOrDelete(chat, row.title) };
            case "remove":
                return { label, onSelect: () => client.removeFromList(chat) };
        }
    }

    // leaving a group or channel, or deleting a DM, asks first
    function leaveOrDelete(chat: ChatSummary, name: string) {
        screen.dialogs.open({
            kind: "leave_or_delete",
            action:
                chat.kind === "direct_chat"
                    ? { kind: "delete_direct_chat", chatId: chat.id, blockUser: false }
                    : { kind: "leave", chatId: chat.id },
            name,
        });
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
                  canManageUserGroups: communityDetailsPermissions(
                      client,
                      community,
                      $anonUserStore,
                  ).canManageUserGroups,
                  label: $_,
              }),
    );

    // a guest is asked to sign in first
    function createGroup() {
        if (signInFirst(client)) return;
        screen.dialogs.open({ kind: "create_group", level: "group" });
    }

    // TODO: the thread count (L1). TODO(4b): the community's stats and bot items
    function onHeaderMenu(item: string) {
        if (item === "markAllRead") {
            // a guest has read nothing: they're asked to sign in (logic/auth/guestPass)
            if (signInFirst(client)) return;
            client.markAllReadForCurrentScope();
            return;
        }
        if (community === undefined) return;
        switch (item) {
            case "members":
                screen.dialogs.open({ kind: "manage", target: community.id, section: "members" });
                break;
            case "newChannel":
            case "embedChannel":
                screen.dialogs.open({
                    kind: "new_channel",
                    communityId: community.id,
                    embedded: item === "embedChannel",
                });
                break;
            case "newUserGroup":
                screen.dialogs.open({
                    kind: "user_group",
                    communityId: community.id,
                    mode: "create",
                });
                break;
            case "invite":
                screen.dialogs.open({ kind: "manage", target: community.id, section: "invite" });
                break;
            case "editCommunity":
                screen.dialogs.open({ kind: "manage", target: community.id, section: "main" });
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
    {headerMenuItems}
    {onHeaderMenu}
    onCreateGroup={createGroup}
    onHeaderDetails={community &&
        (() => screen.dialogs.open({ kind: "manage", target: community.id, section: "main" }))}
    searchable
    onSearch={(q) => (query = q)}
    showThreads={$numberOfThreadsStore > 0}
    threadsAction={() => navigate(withQueryStringFlag("threads"), "overlay")}
    loading={!$chatsInitialisedStore}
/>
