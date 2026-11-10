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
        directChatStatus,
        directChatSubtitle,
        favouritesStore,
        selectedChatPinnedMessagesStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type OpenChat,
    } from "@client";
    import ConversationHeader from "@openchat/ui/src/features/components/ConversationHeader.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import { chatMenuState, runChatMenuItem } from "./chatMenu";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { now } from "@src/stores/time";
    import { headerMenuItems } from "./conversation.adapter";
    import MessageArea from "./MessageArea.svelte";

    let { context: screen }: ScreenProps<Extract<MiddleRegion, { kind: "conversation" }>> =
        $props();

    const client = getContext<OpenChat>("client");

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

    // a DM's line under the name: when the other person was last online, following the app clock
    // ("Online now", "Last online 5 minutes ago"), or that their account is suspended; nothing for
    // a bot (directChatSubtitle, as the old trees' ChatSubtext)
    const them = $derived(
        chat?.kind === "direct_chat" ? $allUsersStore.get(chat.them.userId) : undefined,
    );
    const lastOnlineFor = $derived(
        chat?.kind === "direct_chat" && directChatStatus(them) === "last_online"
            ? chat.them.userId
            : undefined,
    );
    // asked again on each tick of the clock, as the old trees do (getLastOnlineDate batches and
    // caches it); kept with whose it is, so another DM's never shows
    let lastOnline = $state<{ userId: string; at: number | undefined }>();
    $effect(() => {
        const userId = lastOnlineFor;
        const at = $now;
        if (userId !== undefined) void loadLastOnline(userId, at);
    });
    async function loadLastOnline(userId: string, at: number) {
        const seen = await client.getLastOnlineDate(userId, at);
        lastOnline = { userId, at: seen };
    }
    const dmLine = $derived(
        chat?.kind === "direct_chat"
            ? directChatSubtitle(
                  $_,
                  them,
                  $now,
                  lastOnline?.userId === chat.them.userId ? lastOnline.at : undefined,
              )
            : undefined,
    );

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
              }),
    );
    const menuItems = $derived(menuState === undefined ? [] : headerMenuItems(menuState));
    const readonly = $derived(chat !== undefined && client.isChatReadOnly(chat.id));

    // TODO(4b): convert, import and the webhook (parts 4 and 5); the search action; calls are
    // phase 7
    function onMenu(id: string) {
        if (chat === undefined) return;
        runChatMenuItem(id, { client, chat, title, dialogs: screen.dialogs, formatter: $_ });
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
                online={dmLine?.online ?? false}
                presence={dmLine?.text ?? ""}
                statusFav={favourite}
                statusMuted={chat.membership.notificationsMuted}
                statusEveryone={chat.membership.atEveryoneMuted}
                isFavourite={favourite}
                showMenu={!readonly}
                showCall={false}
                actions={$selectedChatPinnedMessagesStore.size > 0
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
                onTogglePanel={() => screen.rightColumn.toggle()}
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
