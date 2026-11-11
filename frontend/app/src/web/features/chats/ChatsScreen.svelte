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
        publish,
        routeForChatIdentifier,
        scopeUnreadCounts,
        selectedChatIdStore,
        translationsStore,
        selectedCommunitySummaryStore,
        serverDirectChatsStore,
        byContext as typersByContext,
        unreadCommunityChannelCountsStore,
        unreadCountShown,
        unreadDirectAndGroupCountsStore,
        unreadFavouriteCountsStore,
        ownUserAvatarUrl,
        type ChatListSearchResults,
        type ChatSummary,
        type OpenChat,
        anonUserStore,
    } from "@client";
    import ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
    import type { MenuItem } from "@openchat/ui/src/lib/types";
    import { interpolate } from "@i18n/i18n";
    import { now } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { withQueryStringFlag } from "@src/utils/urls";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import {
        communityHeaderMenu,
        foundRows,
        type ChatListPanelRow,
        type FoundTarget,
    } from "./chatList.adapter";
    import {
        chatRow,
        listed,
        liveRow,
        rowContext,
        type ChatListRow,
        type RowContext,
    } from "@src/logic/chats/chatRow";
    import { botAvatarUrl, outsideList, searchTerm } from "@src/logic/chats/chatSearch";
    import { OnlineUsers } from "@src/logic/chats/onlineUsers.svelte";
    import { TermSearch } from "@src/logic/chats/termSearch.svelte";

    let { region, context: screen }: ScreenProps<Extract<LeftRegion, { kind: "chats" }>> = $props();

    const client = getContext<OpenChat>("client");

    const scope = $derived(region.scope);
    const chats = $derived($chatSummariesListStore);
    const community = $derived(
        scope.kind === "community" ? $selectedCommunitySummaryStore : undefined,
    );

    // the list's scope: the search is the scope's, so it starts again empty in another scope
    const scopeKey = $derived(scope.kind === "community" ? scope.id.communityId : scope.kind);
    // the panel's search text: the list searches itself (onSearch), so archived chats can show
    // while it's on. The panel's field follows it. A change of scope empties it (a writable
    // derived: back to "" whenever the scope changes, onSearch sets it in between), so coming
    // back to a scope doesn't bring its old search back
    let query = $derived.by(() => {
        void scopeKey;
        return "";
    });
    // people and bots on OpenChat, outside the list (the client's searchChatList)
    const found = new TermSearch<ChatListSearchResults>((term) => client.searchChatList(term));
    onDestroy(() => found.dispose());
    // and the people found go with it: a new scope starts with nothing looked up
    $effect(() => {
        void scopeKey;
        untrack(() => found.set(""));
    });

    function onSearch(text: string) {
        query = text;
        found.set(searchTerm(text));
    }

    const context = $derived.by((): RowContext => {
        // read so unread counts and mentions follow messages being read
        void $messagesRead;
        return rowContext(client, {
            formatter: $_,
            me: $currentUserIdStore,
            users: $allUsersStore,
            translations: $translationsStore,
            bridgedUsers: { get: (key) => $bridgedUsersStore.get(key) },
            pinned: $pinnedChatsStore.get(scope.kind) ?? [],
            selected: $selectedChatIdStore,
            community,
            withMentionsAndAvatars: true,
        });
    });

    const listedRows = $derived(
        chats.flatMap((chat) => {
            const row = chatRow(chat, context);
            return listed(chat, query, $allUsersStore) ? [{ chat, row }] : [];
        }),
    );

    // a DM's online dot, looked up on the app's clock: only this follows the clock, and its set
    // changes only when someone comes online or goes offline, so the rows aren't built again on
    // every tick (as the old list, ec9b75ac59)
    const onlineUsers = new OnlineUsers((userId, at) => client.getUserStatus(userId, at));
    onDestroy(() => onlineUsers.dispose());
    // joined, so a list rebuilt with the same DMs (a keystroke, a message read) looks nobody up
    // again: only a change to the DM set or the clock does
    const dmUserIds = $derived(
        listedRows
            .flatMap(({ chat }) => (chat.kind === "direct_chat" ? [chat.them.userId] : []))
            .join(" "),
    );
    $effect(() => {
        const userIds = dmUserIds === "" ? [] : dmUserIds.split(" ");
        const at = $now;
        // only the users and the clock: nothing the look-up reads along the way
        untrack(() => void onlineUsers.refresh(userIds, at));
    });

    // who's typing and who's online go over the built rows (liveRow), with each row's menu
    const chatRows = $derived(
        listedRows.map(
            ({ chat, row }): ChatListPanelRow => ({
                ...row,
                ...liveRow(chat, {
                    formatter: $_,
                    users: $allUsersStore,
                    typers: $typersByContext,
                    online: onlineUsers.online,
                }),
                menu: menuFor(chat, row),
            }),
        ),
    );

    // the people and bots the search found that aren't in the list: the panel's People
    const searchRows = $derived.by(() => {
        const term = searchTerm(query);
        const results = found.results;
        if (term === "" || results.kind !== "found" || results.term !== term) return [];
        return foundRows({
            // the user's DMs in every scope, not just this one's list: someone they already have
            // a DM with isn't new in a community or in Favourites either
            found: outsideList(
                results.found,
                [...chats, ...$serverDirectChatsStore.values()],
                $currentUserIdStore,
            ),
            userName: (user) => client.displayName(user),
            // their own pictures, else the rows' swatches, as the list's chats
            userAvatar: ownUserAvatarUrl,
            botAvatar: botAvatarUrl,
        });
    });
    const foundTargets = $derived(new Map(searchRows.map(({ row, target }) => [row.id, target])));
    const people = $derived(searchRows.map(({ row }) => row));

    // the route scope's thread replies: the unmuted count, else the muted one (unreadCountShown)
    const threadCount = $derived(
        unreadCountShown(
            scopeUnreadCounts(scope, {
                directAndGroup: $unreadDirectAndGroupCountsStore,
                favourite: $unreadFavouriteCountsStore,
                communityChannels: $unreadCommunityChannelCountsStore,
            }).threads,
        ).count,
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
        const target = foundTargets.get(id);
        if (target !== undefined) {
            pickFound(target);
            return;
        }
        const chat = chats.find((c) => chatIdentifierToString(c.id) === id);
        if (chat !== undefined) navigate(routeForChatIdentifier(scope.kind, chat.id));
    }

    // a person or bot: a chat with them (appEvents' chatWith opens it, or the DM there is)
    function pickFound(target: FoundTarget) {
        publish("chatWith", { kind: "direct_chat", userId: target.userId });
    }

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

    // TODO(4b): the community's stats and bot items
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

<!-- a new scope starts the panel again: an empty field, the filter back to All -->
{#key scopeKey}
    <ChatListPanel
        rows={chatRows}
        {people}
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
        {query}
        {onSearch}
        showThreads={$numberOfThreadsStore > 0}
        {threadCount}
        threadsAction={() => navigate(withQueryStringFlag("threads"), "overlay")}
        loading={!$chatsInitialisedStore}
    />
{/key}
