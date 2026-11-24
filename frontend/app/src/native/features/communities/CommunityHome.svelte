<!-- A community's page for its members (native plan 12, Design Notes §3.8): the Communities tab's root at
     /community/x. The header (its 42px avatar, name and "Public · 1,284 members", which open the community's
     details, and the kebab: Invite people, Mute all channels, Mark all as read, Manage, Leave); the Threads row,
     which pushes the threads followed in its channels (?threads); its channels as ChatRows, the user's (a tap opens
     one, a long-press its menu) and then those they're not in ("Not joined · tap to read": a tap opens it to read
     with the join bar); and the switcher at the bottom (CommunitySwitcher: the strip of the user's communities, which
     grows into the sheet). All avatars sit 18px from the edge. -->
<script lang="ts">
    import {
        allChatsStore,
        allUsersStore,
        bridgedUsersStore,
        canRemoveFromList,
        chatIdentifierToString,
        chatListOrder,
        chatsInScope,
        currentUserIdStore,
        favouritesStore,
        failedMessagesStore,
        messagesRead,
        pinnedChatsStore,
        queuedMessagesStore,
        routeForChatIdentifier,
        sortedCommunitiesStore,
        translationsStore,
        unconfirmedStore,
        unreadCommunityChannelCountsStore,
        userGroupSummariesStore,
        usersLoadingStore,
        type ChannelMatch,
        type ChatListScope,
        type ChatSummary,
        type CommunityIdentifier,
        type CommunitySummary,
        type OpenChat,
    } from "@client";
    import { interpolateNewUi } from "@i18n/i18n";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import ChatRow from "@openchat/ui/src/lib/components/ChatRow.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import LongPressMenu from "@openchat/ui/src/native/LongPressMenu.svelte";
    import { longPress } from "@openchat/ui/src/native/longPress";
    import Markdown from "@src/core/Markdown.svelte";
    import { chatRowActionLabel, chatRowMenu, type ChatRowAction } from "@src/logic/chats/chatMenu";
    import { chatRow, rowContext, type ChatListRow } from "@src/logic/chats/chatRow";
    import {
        latestUnsentByChat,
        orderWithUnsent,
        unsentFor,
    } from "@src/logic/chats/unsentMessages";
    import { communityMenuPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { previewingCommunity } from "@src/logic/join/previewBar";
    import { swatchFor } from "@src/logic/swatch";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import { nativeChatRow, rowMenuItems as chatMenuItems } from "../chats/chats.adapter";
    import { sendAfterUndo } from "../chats/removeWithUndo";
    import { runRowAction } from "../chats/rowActions";
    import {
        channelsNotJoined,
        communityAction,
        communityKey,
        headerMenuItems,
        nextCommunity,
        notJoinedRow,
        rowMenuItems,
        switcherCommunities,
        type CommunityAction,
        type SwitcherCommunity,
    } from "./community.adapter";
    import CommunitySwitcher from "./CommunitySwitcher.svelte";

    type Props = { community: CommunitySummary; context: ScreenContext };

    let { community, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    // the shell's, the same for the screen's life
    const overlays = untrack(() => context.overlays);
    const removals = untrack(() => context.removals);

    const scope = $derived<ChatListScope>({ kind: "community", id: community.id });

    // ---- the channels the user is in: pinned first, then the latest (chatListOrder), as the
    // Chats tab lists its chats, whatever the route's scope is while another tab shows

    const unsent = $derived(
        latestUnsentByChat($unconfirmedStore, $failedMessagesStore, $queuedMessagesStore),
    );
    const pinned = $derived($pinnedChatsStore.get("community") ?? []);
    const channels = $derived(
        orderWithUnsent(
            chatListOrder(pinned, chatsInScope(scope, $allChatsStore, $favouritesStore)),
            new Set(pinned.map(chatIdentifierToString)),
            unsent,
        ).filter((chat) => !removals.has(chatIdentifierToString(chat.id))),
    );

    const rowCtx = $derived.by(() => {
        // read so unread counts follow messages being read
        void $messagesRead;
        return rowContext(client, {
            formatter: $_,
            me: $currentUserIdStore,
            users: $allUsersStore,
            userGroups: { get: (id) => $userGroupSummariesStore.get(id) },
            translations: $translationsStore,
            bridgedUsers: { get: (key) => $bridgedUsersStore.get(key) },
            pinned,
            community,
            usersLoading: $usersLoadingStore,
        });
    });

    type Listed = { chat: ChatSummary; row: ChatListRow; key: string };

    const listed = $derived(
        channels.map(
            (chat): Listed => ({
                chat,
                row: chatRow(chat, rowCtx, undefined, unsentFor(chat, unsent)),
                key: chatIdentifierToString(chat.id),
            }),
        ),
    );

    function rowProps({ chat, row }: Listed) {
        return nativeChatRow(row, $favouritesStore.has(chat.id));
    }

    function open(chat: ChatSummary) {
        navigate(routeForChatIdentifier("community", chat.id));
    }

    // ---- the channels the user isn't in, which they can read: found once per community (the old
    // lists' first page), and listed while they're still not in them

    // keyed on the id's string: the summary is a new object whenever it's rebuilt (a message in
    // one of its channels, a reorder), which isn't another community
    const communityId = $derived(community.id.communityId);
    let found = $state<ChannelMatch[]>([]);
    $effect(() => {
        const id: CommunityIdentifier = { kind: "community", communityId };
        let current = true;
        found = [];
        void (async () => {
            const response = await client.exploreChannels(id, undefined, 0, 100);
            if (current && response.kind === "success") found = response.matches;
        })();
        return () => {
            current = false;
        };
    });
    const notJoined = $derived(channelsNotJoined(found, $allChatsStore).map(notJoinedRow));
    const foundById = $derived(new Map(found.map((c) => [notJoinedRow(c).key, c])));

    function openNotJoined(key: string) {
        const channel = foundById.get(key);
        if (channel !== undefined) navigate(routeForChatIdentifier("community", channel.id));
    }

    // ---- the Threads row: its badge, the community's unread threads

    const threadsUnread = $derived(
        $unreadCommunityChannelCountsStore.get(community.id)?.threads.unmuted ?? 0,
    );

    function openThreads() {
        navigate(`/community/${community.id.communityId}?threads`);
    }

    // ---- the header's kebab, and a community's long-press menu in the switcher

    function menuState(c: CommunitySummary) {
        const permissions = communityMenuPermissions(client, c);
        const own = chatsInScope({ kind: "community", id: c.id }, $allChatsStore, $favouritesStore);
        return {
            canInvite: permissions.canInvite,
            canManage: permissions.canEdit,
            canLeave: permissions.canLeave,
            allMuted:
                own.size > 0 && [...own.values()].every((chat) => chat.membership.notificationsMuted),
        };
    }

    function actionLabel(action: CommunityAction): string {
        switch (action) {
            case "move_to_top":
                return $_("native.community.menu.moveToTop");
            case "invite":
                return $_("native.community.menu.invite");
            case "mute_all":
                return $_("communities.muteAllChannels");
            case "mark_all_read":
                return $_("markAllRead");
            case "manage":
                return $_("native.community.menu.manage");
            case "leave":
                return $_("communities.leave");
        }
    }

    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );
    const headerItems = $derived(headerMenuItems(menuState(community), actionLabel));

    function onHeaderMenu(id: string) {
        const action = communityAction(id);
        if (action !== undefined) void act(action, community);
    }

    async function act(action: CommunityAction, target: CommunitySummary) {
        switch (action) {
            case "move_to_top": {
                const order = switcher.map((c) => c.id.communityId);
                const at = order.indexOf(target.id.communityId);
                if (at > 0) reorder([switcher[at], ...switcher.filter((_, i) => i !== at)]);
                break;
            }
            case "invite":
                context.push({
                    kind: "community_settings",
                    communityId: target.id,
                    page: "invite",
                });
                break;
            case "mute_all":
                // said once it has gone through (the client shows the mute meanwhile)
                context.toast(
                    $_(
                        (await client.muteAllChannels(target.id, false))
                            ? "native.community.toast.mutedAll"
                            : "native.community.toast.muteFailed",
                    ),
                );
                break;
            case "mark_all_read": {
                const own = chatsInScope(
                    { kind: "community", id: target.id },
                    $allChatsStore,
                    $favouritesStore,
                );
                for (const chat of own.values()) client.markAllRead(chat);
                context.toast($_("native.chats.toast.allRead"));
                break;
            }
            case "manage":
                context.push({ kind: "community_details", communityId: target.id });
                break;
            case "leave":
                leave(target);
                break;
        }
    }

    // Leaving with Undo (notes §1): it goes from the switcher at once, the tab moving on to the next
    // community if it's the one showing, and the leave is sent once the toast has gone (the shell's
    // PendingRemovals); Undo sends nothing and puts it back
    function leave(target: CommunitySummary) {
        const key = communityKey(target.id);
        if (target.id.communityId === community.id.communityId) {
            const next = nextCommunity(switcher, target.id);
            navigate(next === undefined ? "/communities" : `/community/${next.communityId}`);
        }
        sendAfterUndo(
            context,
            key,
            $_("native.community.toast.left", { values: { name: target.name } }),
            async () =>
                toastStore.showOutcome(
                    await client.leaveOrDelete({ kind: "leave_community", id: target.id }, true),
                ),
        );
    }

    // ---- a channel's long-press menu: the Chats tab's (chatRowMenu, runRowAction)

    type PressedRow =
        | { kind: "channel"; listed: Listed; target: HTMLElement }
        | { kind: "community"; community: SwitcherCommunity; target: HTMLElement };
    let pressed = $state<PressedRow | null>(null);
    let pressOpen = $state(false);
    useOverlay(
        overlays,
        () => pressOpen,
        () => (pressOpen = false),
    );

    function pressChannel(item: Listed, target: HTMLElement) {
        pressed = { kind: "channel", listed: item, target };
        pressOpen = true;
    }

    function pressCommunity(item: SwitcherCommunity, target: HTMLElement) {
        pressed = { kind: "community", community: item, target };
        pressOpen = true;
    }

    const channelActions = $derived.by((): ChatRowAction[] => {
        if (pressed?.kind !== "channel") return [];
        const { chat, row } = pressed.listed;
        return chatRowMenu(chat, {
            pinned: row.pinned,
            favourite: $favouritesStore.has(chat.id),
            unread: row.unreadCount,
            canLeave: chat.kind !== "direct_chat" && client.canLeaveGroup(chat.id),
            canRemove: canRemoveFromList(chat, community),
        });
    });

    const pressedItems = $derived.by(() => {
        if (pressed === null) return [];
        if (pressed.kind === "channel") {
            const chat = pressed.listed.chat;
            return chatMenuItems(channelActions, (action) =>
                action === "mark_read"
                    ? $_("native.chats.markRead")
                    : interpolateNewUi($_, chatRowActionLabel(action, chat)),
            );
        }
        const held = pressed.community;
        const target = $sortedCommunitiesStore.find(
            (c) => c.id.communityId === held.id.communityId,
        );
        return target === undefined
            ? []
            : rowMenuItems(menuState(target), switcher[0]?.key === held.key, actionLabel);
    });

    const pressedLabel = $derived(
        pressed === null
            ? ""
            : $_("native.chats.rowOptions", {
                  values: {
                      name: pressed.kind === "channel" ? pressed.listed.row.title : pressed.community.name,
                  },
              }),
    );

    function onPressMenu(id: string) {
        const now = pressed;
        if (now === null) return;
        if (now.kind === "channel") {
            const action = channelActions.find((a) => a === id);
            const { chat, row, key } = now.listed;
            if (action !== undefined) {
                void runRowAction(action, { chat, title: row.title, key }, client, context, $_);
            }
            return;
        }
        const action = communityAction(id);
        const target = $sortedCommunitiesStore.find(
            (c) => c.id.communityId === now.community.id.communityId,
        );
        if (action !== undefined && target !== undefined) void act(action, target);
    }

    // ---- the switcher: the user's communities, less those previewed or waiting to be left

    const switcher = $derived(
        switcherCommunities(
            $sortedCommunitiesStore,
            community.id,
            $unreadCommunityChannelCountsStore,
            previewingCommunity,
            (key) => removals.has(key),
            (c) =>
                $_("native.conversation.members", {
                    values: {
                        visibility: $_(c.public ? "access.public" : "access.private"),
                        count: c.memberCount,
                    },
                }),
        ),
    );

    function pick(target: SwitcherCommunity) {
        if (target.id.communityId !== community.id.communityId) {
            navigate(`/community/${target.id.communityId}`);
        }
    }

    // the new order, kept by the client (its index per community, as the old lists' drag)
    function reorder(order: SwitcherCommunity[]) {
        const byId = new Map($sortedCommunitiesStore.map((c) => [c.id.communityId, c]));
        client.updateCommunityIndexes(
            order.flatMap((c) => {
                const summary = byId.get(c.id.communityId);
                return summary === undefined ? [] : [summary];
            }),
        );
    }

    // ---- the header

    const sub = $derived(
        $_("native.conversation.members", {
            values: {
                visibility: $_(community.public ? "access.public" : "access.private"),
                count: community.memberCount,
            },
        }),
    );
    const avatarColor = $derived(swatchFor(community.id.communityId));

    function openDetails() {
        context.push({ kind: "community_details", communityId: community.id });
    }
</script>

<!-- the latest message's markdown, on one line, as the Chats tab's rows render it -->
{#snippet previewText(text: string)}
    <Markdown {text} oneLine suppressLinks />
{/snippet}

<div class="community">
    <header class="header">
        <button
            type="button"
            class="heading"
            aria-label={$_("native.community.details")}
            onclick={openDetails}
        >
            <Avatar
                size={42}
                shape="squircle"
                color={avatarColor}
                url={community.avatar.blobUrl}
            />
            <span class="texts">
                <span class="name">{community.name}</span>
                <span class="sub">{sub}</span>
            </span>
        </button>
        <button
            type="button"
            class="kebab"
            aria-label={$_("native.community.options")}
            aria-haspopup="menu"
            onclick={(e) => (menuAnchor = e.currentTarget)}
        >
            <span class="more-icon"></span>
        </button>
    </header>

    <button type="button" class="threads" onclick={openThreads}>
        <span class="threads-mark"><span class="threads-icon"></span></span>
        <span class="threads-label">{$_("native.community.threads")}</span>
        <span class="chevron"></span>
        {#if threadsUnread > 0}
            <span class="badge">{threadsUnread}</span>
        {/if}
    </button>

    <div class="list">
        {#each listed as item (item.key)}
            <div class="row" use:longPress={(el) => pressChannel(item, el)}>
                <ChatRow {...rowProps(item)} {previewText} onClick={() => open(item.chat)} />
            </div>
        {/each}
        {#each notJoined as channel (channel.key)}
            <div class="row">
                <ChatRow
                    title={channel.title}
                    preview={$_("native.community.notJoined")}
                    time=""
                    kind="channel"
                    color={channel.color}
                    avatarUrl={channel.avatarUrl}
                    locked={channel.locked}
                    onClick={() => openNotJoined(channel.key)}
                />
            </div>
        {/each}
    </div>

    <CommunitySwitcher
        communities={switcher}
        {overlays}
        onPick={pick}
        onPress={pressCommunity}
        onReorder={reorder}
        onExplore={() => navigate("/communities")}
        onCreate={() => context.push({ kind: "new_community" })}
    />
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={headerItems}
    label={$_("native.community.options")}
    onSelect={onHeaderMenu}
    onClose={() => (menuAnchor = null)}
/>

<LongPressMenu
    open={pressOpen}
    target={pressed?.target ?? null}
    items={pressedItems}
    label={pressedLabel}
    onSelect={onPressMenu}
    onClose={() => (pressOpen = false)}
>
    {#snippet row()}
        {#if pressed?.kind === "channel"}
            <ChatRow {...rowProps(pressed.listed)} {previewText} />
        {/if}
    {/snippet}
</LongPressMenu>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .community {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // the avatar 18px from the edge, as the channels' (notes §3.8)
    .header {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: calc(var(--safe-top) + var(--space-8)) var(--space-4) var(--space-10) 18px;
    }

    .heading {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .name {
        font: var(--weight-bold) text-size(17px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
        @include glyph-room;
    }

    .kebab {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        color: var(--ink);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    // horizontal dots on iOS, vertical on Android (notes §2), as the kit's header
    .more-icon {
        @include icon(more, 20px);

        :global([data-os="android"]) & {
            mask: var(--icon-kebab) center/contain no-repeat;
        }
    }

    // no background, its icon in the avatars' column (notes §3.8)
    .threads {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        height: 48px;
        margin: 0 var(--space-16) var(--space-8);
        padding: 0 2px;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .threads-mark {
        flex: none;
        width: 42px;
        display: flex;
        justify-content: center;
    }

    .threads-icon {
        @include icon(threads, 18px, var(--ink-3));
    }

    .threads-label {
        flex: 1;
        font: var(--weight-semibold) text-size(14.5px) / 1 var(--font-sans);
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));
    }

    .badge {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        box-sizing: border-box;
        border-radius: 9px;
        background: var(--accent);
        color: var(--on-accent);
        font: var(--weight-bold) text-size(10.5px) / 18px var(--font-sans);
        text-align: center;
    }

    // the strip's room at the end, so the last channel scrolls clear of it
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        padding: 0 var(--space-6) 96px;
    }
</style>
