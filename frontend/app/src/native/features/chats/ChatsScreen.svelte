<!-- The Chats tab's root (native design notes §3.2): the title row with the CHIT button and the
     kebab (New group, Mark all as read), the search field that lifts into a search, the compact
     filter, and the chats, pinned first. A row opens its conversation; a long-press opens its menu
     (Pin, Favourite, Mute, Mark as read, Archive, Leave group / Delete chat, the destructive ones
     with Undo). The FAB opens New chat, and fades out while the list scrolls down. It lists the
     scope it's the root of (Chats, or Favourites), whatever the route's scope is while another tab
     shows. -->
<script lang="ts">
    import {
        allChatsStore,
        allUsersStore,
        anonUserStore,
        bridgedUsersStore,
        canRemoveFromList,
        chatIdentifierToString,
        chatListOrder,
        chatsInitialisedStore,
        chatsInScope,
        chitStateStore,
        communitiesStore,
        currentUserIdStore,
        favouritesStore,
        i18nKey,
        latestSuccessfulUpdatesLoop,
        messagesRead,
        pinChatFailureMessage,
        pinnedChatsStore,
        routeForChatIdentifier,
        translationsStore,
        type ChatSummary,
        type DirectChatIdentifier,
        type LeaveOrDelete,
        type OpenChat,
    } from "@client";
    import { interpolate } from "@i18n/i18n";
    import ChatRow from "@openchat/ui/src/lib/components/ChatRow.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import VirtualList from "@openchat/ui/src/lib/virtual/VirtualList.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import LongPressMenu from "@openchat/ui/src/native/LongPressMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { longPress } from "@openchat/ui/src/native/longPress";
    import { chatWithRoute } from "@src/logic/appEvents/appEvents";
    import {
        chatRowActionLabel,
        chatRowMenu,
        type ChatRowAction,
    } from "@src/logic/chats/chatMenu";
    import {
        CHAT_LIST_FILTERS,
        chatListFilterFrom,
        passesChatListFilter,
    } from "@src/logic/chats/chatListFilter";
    import { chatRow, rowContext, type ChatListRow } from "@src/logic/chats/chatRow";
    import {
        matchingChats,
        newPeople,
        resultSection,
        searchTerm,
    } from "@src/logic/chats/chatSearch";
    import { muteChat } from "@src/logic/chats/muteChat";
    import { PeopleSearch } from "@src/logic/chats/peopleSearch.svelte";
    import { chitButton } from "@src/logic/chit/chitButton";
    import { chatListFilterStore, disableChit, hideChitIcon } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import ChatSearch, { SEARCH_LEAVE_MS, type SearchSection } from "./ChatSearch.svelte";
    import { removeWithUndo as removeChatWithUndo } from "./removeWithUndo";
    import {
        chatResult,
        HEADER_MENU_ACTIONS,
        headerMenuItems,
        nativeChatRow,
        personResult,
        rowMenuItems,
    } from "./chats.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "chats" }>> = $props();

    const client = getContext<OpenChat>("client");
    // the shell's, the same for the screen's life
    const overlays = untrack(() => context.overlays);

    const scope = $derived(screen.scope);

    // Leaving a group or deleting a DM can't be undone by the backend, so it waits for the Undo
    // (the shell's PendingRemovals, which outlast this screen; opening the chat takes it back)
    const removals = untrack(() => context.removals);

    // ---- the list: the scope's chats, pinned first, then the latest (chatListOrder, as
    // chatSummariesListStore has them for the route's scope)

    const chats = $derived(
        chatListOrder(
            $pinnedChatsStore.get(scope.kind) ?? [],
            chatsInScope(scope, $allChatsStore, $favouritesStore),
        ),
    );

    const rowCtx = $derived.by(() => {
        // read so unread counts follow messages being read
        void $messagesRead;
        return rowContext(client, {
            formatter: $_,
            me: $currentUserIdStore,
            users: $allUsersStore,
            translations: $translationsStore,
            bridgedUsers: { get: (key) => $bridgedUsersStore.get(key) },
            pinned: $pinnedChatsStore.get(scope.kind) ?? [],
        });
    });

    // a chat waiting to be left or deleted is gone already, from the list and the search alike
    const kept = $derived(chats.filter((chat) => !removals.has(chatIdentifierToString(chat.id))));

    type Listed = { chat: ChatSummary; row: ChatListRow; key: string };

    const listed = $derived(
        kept.flatMap((chat): Listed[] => {
            // archived chats show only in a search
            if (chat.membership.archived) return [];
            return [{ chat, row: chatRow(chat, rowCtx), key: chatIdentifierToString(chat.id) }];
        }),
    );

    const filter = $derived(chatListFilterFrom($chatListFilterStore));
    const shown = $derived(
        listed.filter(({ chat, row }) => passesChatListFilter(chat, filter, row.unreadCount)),
    );
    const anyUnread = $derived(listed.some(({ row }) => row.unreadCount > 0));

    const filterLabels = CHAT_LIST_FILTERS.map((f) => `ui.chatListPanel.filters.${f}`);
    const unreadIndex = CHAT_LIST_FILTERS.indexOf("unread");

    function selectFilter(i: number) {
        chatListFilterStore.set(CHAT_LIST_FILTERS[i] ?? "all");
    }

    function rowProps({ chat, row }: Listed) {
        return nativeChatRow(row, $favouritesStore.has(chat.id));
    }

    function open(chat: ChatSummary) {
        navigate(routeForChatIdentifier(scope.kind, chat.id));
    }

    // ---- the header: CHIT, and the kebab's menu

    const chit = $derived(
        chitButton(
            {
                chit: $chitStateStore,
                lastSync: $latestSuccessfulUpdatesLoop,
                disabled: $disableChit,
                now: $now500,
            },
            $hideChitIcon,
        ),
    );

    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );

    const menuItems = $derived(
        headerMenuItems((action) => $_(action === "new_group" ? "newGroup" : "markAllRead")),
    );

    function onHeaderMenu(id: string) {
        switch (HEADER_MENU_ACTIONS.find((a) => a === id)) {
            case "new_group":
                context.push({ kind: "new_group" });
                break;
            case "mark_all_read":
                // what the tab lists, whatever the route's scope
                for (const { chat } of listed) client.markAllRead(chat);
                context.toast(
                    $_(anyUnread ? "native.chats.toast.allRead" : "native.chats.toast.caughtUp"),
                );
                break;
        }
    }

    // ---- a row's long-press menu

    type Pressed = { listed: Listed; target: HTMLElement };
    let pressed = $state<Pressed | null>(null);
    let rowMenuOpen = $state(false);
    useOverlay(
        overlays,
        () => rowMenuOpen,
        () => (rowMenuOpen = false),
    );

    function pressRow(item: Listed, target: HTMLElement) {
        pressed = { listed: item, target };
        rowMenuOpen = true;
    }

    const pressedActions = $derived.by((): ChatRowAction[] => {
        if (pressed === null) return [];
        const { chat, row } = pressed.listed;
        const community =
            chat.kind === "channel"
                ? $communitiesStore.get({ kind: "community", communityId: chat.id.communityId })
                : undefined;
        return chatRowMenu(chat, {
            pinned: row.pinned,
            favourite: $favouritesStore.has(chat.id),
            unread: row.unreadCount,
            canLeave: chat.kind !== "direct_chat" && client.canLeaveGroup(chat.id),
            canRemove: canRemoveFromList(chat, community),
        });
    });

    const pressedItems = $derived.by(() => {
        const chat = pressed?.listed.chat;
        return chat === undefined
            ? []
            : rowMenuItems(pressedActions, (action) => actionLabel(action, chat));
    });

    // the words every tree's row menu has (chatRowActionLabel), but native's own "Mark as read"
    function actionLabel(action: ChatRowAction, chat: ChatSummary): string {
        return action === "mark_read"
            ? $_("native.chats.markRead")
            : interpolate($_, chatRowActionLabel(action, chat));
    }

    function onRowMenu(id: string) {
        const item = pressed?.listed;
        const action = pressedActions.find((a) => a === id);
        if (item !== undefined && action !== undefined) void act(action, item);
    }

    async function act(action: ChatRowAction, { chat, row, key }: Listed) {
        switch (action) {
            case "pin":
            case "unpin": {
                const pin = action === "pin";
                if (await (pin ? client.pinChat(chat.id) : client.unpinChat(chat.id))) {
                    context.toast(
                        $_(pin ? "native.chats.toast.pinned" : "native.chats.toast.unpinned"),
                    );
                } else {
                    toastStore.showFailureToast(pinChatFailureMessage(pin));
                }
                break;
            }
            case "favourite":
                await client.addToFavourites(chat.id);
                break;
            case "unfavourite":
                await client.removeFromFavourites(chat.id);
                break;
            case "mute":
            case "unmute": {
                const mute = action === "mute";
                const failed = await muteChat(client, chat.id, mute, undefined, $_);
                if (failed !== undefined) {
                    toastStore.showFailureToast(failed);
                } else {
                    context.toast(
                        $_(mute ? "native.chats.toast.muted" : "native.chats.toast.unmuted"),
                    );
                }
                break;
            }
            case "mark_read":
                client.markAllRead(chat);
                break;
            case "archive":
                if (await client.archiveChat(chat.id)) {
                    context.toast($_("native.chats.toast.archived"), () => void unarchive(chat));
                } else {
                    toastStore.showFailureToast(i18nKey("archiveChatFailed"));
                }
                break;
            case "unarchive":
                await unarchive(chat);
                break;
            case "leave":
                if (chat.kind !== "direct_chat") {
                    removeWithUndo(
                        key,
                        { kind: "leave", chatId: chat.id },
                        $_("native.chats.toast.left", { values: { name: row.title } }),
                    );
                }
                break;
            case "delete":
                if (chat.kind === "direct_chat") {
                    removeWithUndo(
                        key,
                        { kind: "delete_direct_chat", chatId: chat.id, blockUser: false },
                        $_("native.chats.toast.deleted"),
                    );
                }
                break;
            case "remove":
                client.removeFromList(chat);
                break;
        }
    }

    function removeWithUndo(key: string, action: LeaveOrDelete, message: string) {
        removeChatWithUndo(client, context, key, action, message);
    }

    async function unarchive(chat: ChatSummary) {
        if (!(await client.unarchiveChats([chat.id]))) {
            toastStore.showFailureToast(i18nKey("unarchiveChatFailed"));
        }
    }

    // ---- search: the user's chats that match, and people who aren't a chat yet

    let searchOpen = $state(false);
    // the list's field stays hidden while the search's moves back down onto it
    let fieldHidden = $state(false);
    let query = $state("");
    let expanded = $state<Record<string, boolean>>({});
    useOverlay(
        overlays,
        () => searchOpen,
        () => closeSearch(),
    );

    const people = new PeopleSearch((term) => client.searchUsers(term, 20));
    onDestroy(() => people.dispose());

    const term = $derived(searchTerm(query));

    function onQuery(next: string) {
        query = next;
        expanded = {};
        people.set(searchTerm(next));
    }

    function openSearch() {
        searchOpen = fieldHidden = true;
    }

    function closeSearch() {
        searchOpen = false;
        onQuery("");
        setTimeout(() => (fieldHidden = searchOpen), SEARCH_LEAVE_MS);
    }

    const CHATS_SHOWN = 3;
    const PEOPLE_SHOWN = 3;

    const chatResults = $derived(searchOpen ? matchingChats(kept, term, $allUsersStore) : []);
    const peopleFound = $derived.by(() => {
        const results = people.results;
        return results.kind === "found" && results.term === term
            ? newPeople(results.people, kept, $currentUserIdStore)
            : [];
    });

    const sections = $derived.by((): SearchSection[] => {
        const username = (userId: string) => $allUsersStore.get(userId)?.username;
        const chatRows = chatResults.map((chat) =>
            chatResult(chat, chatRow(chat, rowCtx), term, username),
        );
        const personRows = peopleFound.map((user) =>
            personResult(user, client.displayName(user), term),
        );
        const all = [
            {
                id: "chats",
                key: "native.chats.search.chatsCount",
                section: resultSection(chatRows, CHATS_SHOWN, expanded.chats ?? false),
            },
            {
                id: "people",
                key: "native.chats.search.peopleCount",
                section: resultSection(personRows, PEOPLE_SHOWN, expanded.people ?? false),
            },
        ];
        return all
            .filter(({ section }) => section.total > 0)
            .map(({ id, key, section }) => ({
                id,
                label: $_(key, { values: { count: section.total } }),
                rows: section.rows,
                more: section.more,
                expanded: expanded[id] ?? false,
            }));
    });

    const searchText = $derived({
        placeholder: $_("native.chats.search.placeholder"),
        cancel: $_("cancel"),
        clear: $_("native.chats.search.clear"),
        searchFor: $_("native.chats.search.searchFor"),
        kinds: [
            { label: $_("native.chats.search.chats"), icon: "chat" },
            { label: $_("native.chats.search.people"), icon: "user" },
        ],
        showAll: $_("native.chats.search.showAll"),
        showLess: $_("native.chats.search.showLess"),
        noResults: $_("native.chats.search.noResults", { values: { query: query.trim() } }),
        noResultsHint: $_("native.chats.search.noResultsHint"),
    });

    function onSearchSelect(sectionId: string, rowId: string) {
        if (sectionId === "chats") {
            const chat = chatResults.find((c) => chatIdentifierToString(c.id) === rowId);
            if (chat === undefined) return;
            closeSearch();
            open(chat);
        } else {
            // someone whose DM is waiting to be deleted: opening it takes the delete back (Shell)
            const chatId: DirectChatIdentifier = { kind: "direct_chat", userId: rowId };
            closeSearch();
            navigate(chatWithRoute(chatId, chats, scope));
        }
    }

    // ---- the FAB: New chat, out of the way while the list scrolls down

    let fabHidden = $state(false);
    let lastScroll = 0;

    function onListScroll(e: Event) {
        if (!(e.target instanceof HTMLElement)) return;
        const y = e.target.scrollTop;
        const delta = y - lastScroll;
        lastScroll = y;
        if (delta > 6 && y > 40) fabHidden = true;
        else if (delta < -6) fabHidden = false;
    }

    const fabShown = $derived(!fabHidden && !searchOpen);
</script>

<div class="chats">
    <NativePageHeader
        title={scope.kind === "favourite" ? $_("communities.favourites") : $_("native.tabs.chats")}
        size="lg"
        onMore={(anchor) => (menuAnchor = anchor)}
        moreLabel={$_("native.chats.options")}>
        {#if chit.shown && !$anonUserStore}
            <button
                type="button"
                class="chit"
                class:claimable={chit.claimable}
                aria-label={$_(
                    chit.claimable ? "native.chats.chitClaimable" : "native.chats.chit",
                )}
                onclick={() => context.push({ kind: "chit" })}>
                <span class="chit-icon"></span>
            </button>
        {/if}
    </NativePageHeader>

    <div class="search-slot" class:hidden={fieldHidden}>
        <button type="button" class="search-field" onclick={openSearch}>
            <span class="search-icon"></span>
            <span class="search-placeholder">{$_("native.chats.search.placeholder")}</span>
        </button>
    </div>

    <div class="filters">
        <SegmentedTabs
            size="sm"
            labels={filterLabels}
            selectedIndex={CHAT_LIST_FILTERS.indexOf(filter)}
            dotIndexes={anyUnread ? [unreadIndex] : []}
            onSelect={selectFilter} />
    </div>

    <div class="list" onscrollcapture={onListScroll}>
        {#if !$chatsInitialisedStore}
            <div class="state"><Spinner /></div>
        {:else if listed.length === 0}
            <div class="state">
                <EmptyState
                    preset="no-conversations"
                    body={$_("native.chats.empty")}
                    actionLabel="" />
            </div>
        {:else if shown.length === 0}
            <div class="state">
                <EmptyState
                    preset="no-results"
                    title={$_("native.chats.noneMatch")}
                    body=" "
                    actionLabel={$_("native.chats.showAllChats")}
                    actionHandler={() => selectFilter(0)} />
            </div>
        {:else}
            <VirtualList items={shown} keyFn={(item) => item.key}>
                {#snippet children(item)}
                    <div class="row" use:longPress={(el) => pressRow(item, el)}>
                        <ChatRow {...rowProps(item)} onClick={() => open(item.chat)} />
                    </div>
                {/snippet}
            </VirtualList>
        {/if}
    </div>

    <button
        type="button"
        class="fab"
        class:hidden={!fabShown}
        aria-label={$_("newChat")}
        aria-hidden={fabShown ? undefined : "true"}
        tabindex={fabShown ? 0 : -1}
        onclick={() => context.push({ kind: "new_chat" })}>
        <span class="fab-icon"></span>
    </button>

    <ChatSearch
        open={searchOpen}
        {query}
        {sections}
        searching={people.results.kind === "searching"}
        text={searchText}
        {onQuery}
        onCancel={closeSearch}
        onToggle={(id) => (expanded = { ...expanded, [id]: !(expanded[id] ?? false) })}
        onSelect={onSearchSelect} />
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={menuItems}
    label={$_("native.chats.options")}
    onSelect={onHeaderMenu}
    onClose={() => (menuAnchor = null)} />

<LongPressMenu
    open={rowMenuOpen}
    target={pressed?.target ?? null}
    items={pressedItems}
    label={$_("native.chats.rowOptions", { values: { name: pressed?.listed.row.title ?? "" } })}
    onSelect={onRowMenu}
    onClose={() => (rowMenuOpen = false)}>
    {#snippet row()}
        {#if pressed !== null}
            <ChatRow {...rowProps(pressed.listed)} />
        {/if}
    {/snippet}
</LongPressMenu>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .chats {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // CHIT: the bolt in CHIT's colour, with a dot while today's claim is there to make
    .chit {
        position: relative;
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .chit-icon {
        position: relative;
        @include icon(zap, 20px, var(--ink-3));

        .claimable & {
            background: var(--status-chit);
        }
    }

    .claimable::after {
        content: "";
        position: absolute;
        top: calc(50% - 12px);
        inset-inline-end: calc(50% - 14px);
        width: 8px;
        height: 8px;
        border-radius: var(--radius-circle);
        background: var(--accent);
        box-shadow: 0 0 0 2.5px var(--surface-0);
    }

    .search-slot {
        flex: none;
        padding: 10px var(--space-16) 0;

        // the field has lifted into the search
        &.hidden {
            visibility: hidden;
        }
    }

    .search-field {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-10);
        width: 100%;
        height: 44px;
        padding: 0 var(--space-14);
        border: 0;
        border-radius: var(--radius-md);
        background: var(--overlay-1);
        color: var(--ink-4);
        text-align: start;
        cursor: text;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .search-icon {
        @include icon(search, 16px, var(--ink-4));
    }

    .search-placeholder {
        flex: 1;
        min-width: 0;
        font: var(--weight-medium) text-size(15px) / 1 var(--font-sans);
        @include truncate;
    }

    .filters {
        flex: none;
        padding: var(--space-12) var(--space-16) var(--space-14);
    }

    .list {
        position: relative;
        flex: 1;
        min-height: 0;

        // the list scrolls clear of the FAB (notes §3.2: 104px at the end)
        :global(svelte-virtual-list-viewport) {
            position: absolute;
            inset: 0;
            padding: 0 var(--space-6) 104px;
            scrollbar-width: none;
        }
    }

    .state {
        display: grid;
        place-items: center;
        height: 100%;
        padding: var(--space-24) var(--space-16) 104px;
    }

    .fab {
        position: absolute;
        inset-inline-end: var(--space-16);
        bottom: var(--space-16);
        z-index: 2;
        width: 56px;
        height: 56px;
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-xl);
        background: var(--accent);
        box-shadow: var(--shadow-fab);
        cursor: pointer;
        transition: opacity 0.2s ease;
        -webkit-tap-highlight-color: transparent;

        &.hidden {
            opacity: 0;
            pointer-events: none;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .fab-icon {
        @include icon(plus, 24px, var(--on-accent));
    }

    @include reduced-motion {
        .fab {
            transition: none;
        }
    }
</style>
