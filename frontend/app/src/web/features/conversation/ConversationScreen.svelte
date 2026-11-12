<!-- The middle column's conversation (region "conversation", phase 3b): the selected chat's header,
     its messages and its composer. The messages and the composer are MessageArea's, which a
     thread's panel (4c) shows its replies through too. -->
<script lang="ts">
    import { showInRightColumn } from "../app/rightPanel";
    import {
        allUsersStore,
        anonUserStore,
        blockedUsersStore,
        chatIdentifierToString,
        favouritesStore,
        platformModeratorStore,
        selectedChatPinnedMessagesStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type OpenChat,
    } from "@client";
    import ConversationHeader from "@openchat/ui/src/features/components/ConversationHeader.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { interpolate } from "@src/i18n/i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import { chatMenuState, runChatMenuItem } from "./chatMenu";
    import { LastOnline } from "@src/logic/conversation/lastOnline.svelte";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { now } from "@src/stores/time";
    import { chatAvatarUrl, groupAvatarLookups } from "@src/logic/chats/chatRow";
    import { headerMenuItems, moderationMenuItems } from "./conversation.adapter";
    import MessageArea from "./MessageArea.svelte";
    import { getPendingToastHost } from "@openchat/ui/src/lib/toasts.svelte";

    let { context: screen }: ScreenProps<Extract<MiddleRegion, { kind: "conversation" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const pendingToasts = getPendingToastHost();

    // the route's chat, once the client has selected it (Router: setSelectedChat)
    const chat = $derived($selectedChatSummaryStore);

    // ── the header ──

    const title = $derived(
        chat === undefined
            ? ""
            : chat.kind === "direct_chat"
              ? client.displayName($allUsersStore.get(chat.them.userId))
              : chat.name,
    );
    const favourite = $derived(chat !== undefined && $favouritesStore.has(chat.id));
    // the chat's own picture, as its chat list row has it: its swatch without one (2026-11-10)
    const avatarUrl = $derived(
        chat === undefined
            ? undefined
            : chatAvatarUrl(
                  chat,
                  $allUsersStore,
                  groupAvatarLookups(client, $selectedCommunitySummaryStore),
              ),
    );

    // a DM's line under the name: when the other person was last online, following the app clock
    // ("Online now", "Last online 5 minutes ago"), or that their account is suspended; nothing for
    // a bot (LastOnline, as the old trees' ChatSubtext). TODO(design): web/05 doesn't say
    // what the presence line says; the old words
    const them = $derived(
        chat?.kind === "direct_chat" ? $allUsersStore.get(chat.them.userId) : undefined,
    );
    const dmLine = new LastOnline(client, {
        userId: () => (chat?.kind === "direct_chat" ? chat.them.userId : undefined),
        user: () => them,
        now: () => $now,
        formatter: () => $_,
    });

    const headerKind = $derived(
        chat?.kind === "direct_chat" ? "user" : chat?.kind === "group_chat" ? "group" : "channel",
    );
    const menuState = $derived(
        chat === undefined
            ? undefined
            : chatMenuState(client, chat, {
                  favourite,
                  blocked: $blockedUsersStore,
                  users: $allUsersStore,
                  community: $selectedCommunitySummaryStore,
                  anon: $anonUserStore,
                  unblockLabel: $_("unblockUser"),
                  platformModerator: $platformModeratorStore,
                  translate: (key) => interpolate($_, key),
              }),
    );
    const readonly = $derived(chat !== undefined && client.isChatReadOnly(chat.id));
    // a preview (read only) has no menu, but a platform moderator's items (freeze), as the old
    // preview footer's button
    const menuItems = $derived(
        menuState === undefined
            ? []
            : readonly
              ? moderationMenuItems(menuState)
              : headerMenuItems(menuState),
    );

    // TODO(4b): convert, import and the webhook (parts 4 and 5); the search action; calls are
    // phase 7
    function onMenu(id: string) {
        if (chat === undefined) return;
        runChatMenuItem(id, {
            client,
            chat,
            title,
            dialogs: screen.dialogs,
            formatter: $_,
            pendingToasts,
        });
    }

    // a group's or channel's name opens Manage (the About page for someone who can't edit it), a
    // DM's the other person's profile, with the DM's own settings on its This chat tab
    function openDetails() {
        if (chat === undefined) return;
        if (chat.kind === "direct_chat") {
            screen.dialogs.open({
                kind: "user",
                userId: chat.them.userId,
                chatButton: false,
                inGlobalContext: true,
                dmTab: "profile",
            });
        } else {
            screen.dialogs.open({ kind: "manage", target: chat.id, section: "main" });
        }
    }
</script>

{#if chat === undefined}
    <div class="state"><Spinner /></div>
{:else}
    <MessageArea {chat} thread={undefined} {screen}>
        {#snippet frame(list, composer)}
            <ConversationHeader
                {title}
                kind={headerKind}
                {avatarUrl}
                color={senderColor(
                    chat.kind === "direct_chat" ? chat.them.userId : chatIdentifierToString(chat.id),
                )}
                verified={chat.kind === "group_chat" && chat.verified}
                visibility={chat.kind === "direct_chat"
                    ? undefined
                    : chat.public
                      ? "Public"
                      : "Private"}
                memberCount={chat.kind === "direct_chat" ? 0 : chat.memberCount}
                online={dmLine.online}
                presence={dmLine.text}
                statusFav={favourite}
                statusMuted={chat.membership.notificationsMuted}
                statusEveryone={chat.membership.atEveryoneMuted}
                isFavourite={favourite}
                showMenu={menuItems.length > 0}
                showCall={false}
                actions={screen.hasRightColumn && $selectedChatPinnedMessagesStore.size > 0
                    ? [
                          {
                              icon: "pin",
                              onPress: () =>
                                  showInRightColumn(screen.rightColumn, { kind: "show_pinned" }),
                          },
                      ]
                    : []}
                {menuItems}
                {onMenu}
                onLeave={() => onMenu("leave")}
                {openDetails}
                titleChevron={chat.kind !== "direct_chat"}
                titleHint={chat.kind === "direct_chat"
                    ? "ui.dmPanel.viewProfile"
                    : menuState?.canEdit
                      ? `ui.conversationHeader.menu.manage${chat.kind === "channel" ? "Channel" : "Group"}`
                      : `ui.conversationHeader.menu.${chat.kind === "channel" ? "channel" : "group"}Details`}
                onTogglePanel={screen.hasRightColumn
                    ? () => screen.rightColumn.toggle()
                    : undefined}
                panelOpen={screen.rightColumn.open}
            />
            {@render list()}
            {@render composer()}
        {/snippet}
    </MessageArea>
{/if}

<style lang="scss">
    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
