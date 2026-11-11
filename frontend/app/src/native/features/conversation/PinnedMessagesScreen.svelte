<!-- A group's or channel's pinned messages (native plan 04, "Pinned messages"), pushed from the
     conversation's pinned strip, on the chat's surface: the header ("3 pinned messages" / the chat's
     name, and for those who can pin, with two or more, ⋯ → Unpin all, after a confirmation), then
     the pinned messages as the chat draws them, oldest at the top under each day's chip, the list
     starting at the bottom. Received ones have their sender's avatar and name; your own are on the
     right. Beside each, for those who can pin, its pin button unpins it, with Undo (pinToasts). A
     tap goes back to the chat, to that message (jumpRequests); a long-press offers Go to message and
     Unpin. They are the conversation's (its PinnedMessages, through jumpRequests), and hold what
     they showed while the screen slides out. -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifierToString,
        chatIdentifiersEqual,
        chatListScopeStore,
        chitStateStore,
        communitiesStore,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        exchangeRatesLookupStore,
        isDiamondStore,
        isLifetimeDiamondStore,
        isPreviewingOrLapsed,
        messageReadByThem,
        routeForMessage,
        selectedChatPinnedMessagesStore,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunityUserGroupsStore,
        selectedServerChatStore,
        unconfirmedReadByThem,
        webhookUserIdsStore,
        type ChatSummary,
        type EventWrapper,
        type Message,
        type OpenChat,
    } from "@client";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import MessageGroup from "@openchat/ui/src/lib/components/MessageGroup.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import type { GroupMessage } from "@openchat/ui/src/lib/types";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import { haptic } from "@openchat/ui/src/native/haptics";
    import MessageLongPressMenu from "@openchat/ui/src/native/MessageLongPressMenu.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { NativeMenuItem } from "@openchat/ui/src/native/types";
    import Markdown from "@src/core/Markdown.svelte";
    import { textAsMarkdown } from "@src/logic/conversation/messageHandlers";
    import {
        conversationContext,
        messageRow,
        messageStatus,
        senderColor,
    } from "@src/logic/conversation/messageRow";
    import { PinnedMessages } from "@src/logic/pinned/pinnedMessages.svelte";
    import { lowBandwidth } from "@src/stores/settings";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { HeldWhileLeaving } from "./heldWhileLeaving";
    import { conversationPins, requestJump } from "./jumpRequests";
    import {
        offersUnpinAll,
        pinnedMenuActions,
        shownDays,
        unpinAllIndexes,
        unpinKey,
        type PinnedMenuAction,
    } from "./pinned.adapter";
    import { unpinWithUndo } from "./pinToasts";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "pinned_messages" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    // the shell's, the same for the screen's life
    const overlays = untrack(() => context.overlays);
    const chatId = untrack(() => screen.chatId);
    const chatKey = chatIdentifierToString(chatId);
    const me = $derived($currentUserIdStore);

    // the conversation under it keeps its chat selected; once that goes (Back from the
    // conversation), what was shown is held
    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, chatId),
    );
    const heldChat = new HeldWhileLeaving<ChatSummary | undefined>(undefined);
    const chat = $derived(heldChat.of(selected, $selectedChatSummaryStore));
    const group = $derived(chat !== undefined && chat.kind !== "direct_chat");
    const canPin = $derived(chat !== undefined && client.canPinMessages(chat.id));

    // ---- the pinned messages, oldest first by day, less those waiting out an unpin's Undo

    // the conversation under it has them loaded, and keeps them in step with the pins: the same
    // ones, not fetched (and marked read) again. Its own only if that conversation isn't there.
    const shared = conversationPins(chatKey);
    const pinned =
        shared ??
        new PinnedMessages(
            client,
            () => chatId,
            () =>
                chat !== undefined && chat.kind !== "direct_chat" ? chat.dateLastPinned : undefined,
        );
    $effect(() => {
        if (shared === undefined && selected) void pinned.sync();
    });

    const hidden = (messageIndex: number) => context.removals.has(unpinKey(chatKey, messageIndex));
    const heldDays = new HeldWhileLeaving<EventWrapper<Message>[][]>([]);
    const days = $derived(
        heldDays.of(
            selected && pinned.messages.kind === "success",
            pinned.messages.kind === "success" ? shownDays(pinned.messages.data, hidden) : [],
        ),
    );
    const shown = $derived(days.flat());
    const count = $derived(shown.length);
    // Unpin all's: every pin in the set, the ones that didn't load (deleted, out of reach) too
    const heldAll = new HeldWhileLeaving<number[]>([]);
    const allPins = $derived(
        heldAll.of(selected, unpinAllIndexes($selectedChatPinnedMessagesStore, hidden)),
    );
    const allCount = $derived(allPins.length);

    const title = $derived(
        count === 0
            ? $_("pinnedMessages")
            : $_("native.conversation.pinned.title", { values: { count } }),
    );
    const chatName = $derived(chat !== undefined && chat.kind !== "direct_chat" ? chat.name : "");

    // ---- the messages as the conversation draws them (logic/conversation/messageRow)

    const ctx = $derived(
        conversationContext({
            client,
            chat,
            me,
            formatter: $_,
            users: $allUsersStore,
            userGroups: $selectedCommunityUserGroupsStore,
            webhooks: $selectedChatWebhooksStore,
            webhookIds: $webhookUserIdsStore,
            detailsLoaded: $selectedServerChatStore !== undefined,
            lowBandwidth: $lowBandwidth,
            revealed: () => true,
            claimant: {
                previewingOrLapsed:
                    chat !== undefined && isPreviewingOrLapsed(chat, $communitiesStore),
                diamond: $isDiamondStore,
                lifetimeDiamond: $isLifetimeDiamondStore,
                streak: $chitStateStore.streak,
                chitEarned: $chitStateStore.totalChitEarned,
                accountCreated: Number($currentUserStore.dateCreated),
            },
            tokens: $cryptoLookup,
            rates: () => exchangeRatesLookupStore.value,
            face: (userId) => AVATAR_GRADIENTS[senderColor(userId)],
            threads: false,
        }),
    );

    function rowFor(evt: EventWrapper<Message>) {
        const readByThem =
            chat !== undefined && messageReadByThem(chat, evt.event, $unconfirmedReadByThem);
        return messageRow(evt, messageStatus({ failed: false, accepted: true, readByThem }), ctx);
    }

    function dateLabel(timestamp: bigint): string {
        return client.formatMessageDate(timestamp, $_("today"), $_("yesterday"));
    }

    // ---- going to a pin: back to the chat, which goes to it and marks it

    function goTo(evt: EventWrapper<Message>) {
        const index = evt.event.messageIndex;
        context.back?.();
        if (!requestJump(chatKey, index)) {
            navigate(routeForMessage($chatListScopeStore.kind, { chatId }, index));
        }
    }

    // a tap on a bubble goes to it; not the release of the long-press that opened its menu, nor a
    // link in it
    let menuOpenedAt = 0;
    function tapped(e: MouseEvent, evt: EventWrapper<Message>) {
        if (pressed !== undefined && menuOpen) return;
        if (Date.now() - menuOpenedAt < 700) return;
        if ((e.target as Element | null)?.closest?.("a")) return;
        goTo(evt);
    }

    // ---- unpinning, with Undo: one, or all of them after a confirmation

    function unpin(indexes: number[], message: string) {
        if (chat === undefined || chat.kind === "direct_chat" || indexes.length === 0) return;
        unpinWithUndo(client, context, chat.id, chatKey, indexes, message);
    }

    function unpinOne(evt: EventWrapper<Message>) {
        unpin([evt.event.messageIndex], $_("native.conversation.message.unpinned"));
    }

    let moreAnchor = $state<HTMLElement | null>(null);
    let confirming = $state(false);
    useOverlay(
        overlays,
        () => moreAnchor !== null,
        () => (moreAnchor = null),
    );
    useOverlay(
        overlays,
        () => confirming,
        () => (confirming = false),
    );

    const moreItems = $derived<NativeMenuItem[]>([
        {
            id: "unpin_all",
            label: $_("native.conversation.pinned.unpinAll", { values: { count: allCount } }),
            icon: "pin",
            danger: true,
        },
    ]);

    function unpinAll() {
        confirming = false;
        unpin(
            allPins,
            $_("native.conversation.pinned.unpinnedAll", { values: { count: allCount } }),
        );
    }

    // ---- a pin's long-press menu: Go to message, Unpin

    type Pressed = { evt: EventWrapper<Message>; el: HTMLElement; side: "received" | "sent" };
    let pressed = $state<Pressed>();
    let menuOpen = $state(false);
    useOverlay(
        overlays,
        () => menuOpen,
        () => (menuOpen = false),
    );

    const menuItems = $derived<NativeMenuItem[]>(
        pinnedMenuActions(canPin).map((action) =>
            action === "go_to"
                ? { id: action, label: $_("native.conversation.pinned.goTo"), icon: "arrow" }
                : { id: action, label: $_("unpinMessage"), icon: "pin" },
        ),
    );

    function openMenu(evt: EventWrapper<Message>, el: HTMLElement | undefined, side: Pressed["side"]) {
        if (el === undefined) return;
        if (!menuOpen) haptic("medium");
        menuOpenedAt = Date.now();
        pressed = { evt, el, side };
        menuOpen = true;
    }

    function onMenu(id: string) {
        const at = pressed;
        if (at === undefined) return;
        const action: PinnedMenuAction | undefined =
            id === "go_to" || id === "unpin" ? id : undefined;
        if (action === "go_to") goTo(at.evt);
        if (action === "unpin") unpinOne(at.evt);
    }
</script>

<!-- data-chat-surface: in native light, the off-white chat with white bubbles (tokens.css) -->
<div class="pinned" data-chat-surface>
    <NativePageHeader
        {title}
        sub={chatName}
        onBack={context.back}
        onMore={offersUnpinAll(canPin, allCount) ? (anchor) => (moreAnchor = anchor) : undefined}
        moreLabel={$_("native.conversation.pinned.options")}
        divider
    />

    {#if pinned.messages.kind === "error" && count === 0}
        <div class="state">
            <p class="state-title">{$_("native.conversation.pinned.loadFailed")}</p>
        </div>
    {:else if count === 0 && (pinned.messages.kind === "success" || !selected)}
        <!-- the plan's words, under the pin (TODO(design): the plan has no picture for it) -->
        <div class="state">
            <span class="state-icon" style:mask="var(--icon-pin) center/contain no-repeat"></span>
            <p class="state-title">{$_("native.conversation.pinned.emptyTitle")}</p>
            <p class="state-body">{$_("native.conversation.pinned.emptyBody")}</p>
        </div>
    {:else if count === 0}
        <div class="waiting"><Spinner size={20} /></div>
    {:else}
        <!-- column-reverse: the list starts at the bottom, and stays there as images come in -->
        <div class="scroller">
            <div class="list">
                {#each days as day (day[0].event.messageIndex)}
                    <div class="date"><span class="pill">{dateLabel(day[0].timestamp)}</span></div>
                    {#each day as evt (evt.event.messageId)}
                        {@const row = rowFor(evt)}
                        {@const content = evt.event.content}
                        {@const received = row.side === "received"}
                        {#snippet body()}
                            {#if content.kind === "text_content"}
                                <Markdown
                                    text={content.text}
                                    inline={!evt.event.blockLevelMarkdown}
                                />
                            {/if}
                        {/snippet}
                        {@const message =
                            content.kind === "text_content" && textAsMarkdown(content.text)
                                ? ({ ...row.message, body } as GroupMessage)
                                : row.message}
                        <div class="pin" class:sent={!received} class:room={!canPin}>
                            <!-- a tap goes to it (the long-press is its menu) -->
                            <div
                                class="bubble"
                                role="button"
                                tabindex="0"
                                onclick={(e) => tapped(e, evt)}
                                onkeydown={(e) => e.key === "Enter" && goTo(evt)}
                            >
                                <MessageGroup
                                    side={row.side}
                                    senderName={row.senderName}
                                    color={row.color}
                                    avatarUrl={row.avatarUrl}
                                    showAvatar={group && received}
                                    showName={group && received}
                                    avatarSize={28}
                                    mirror
                                    hoverBar={false}
                                    pressVibration={false}
                                    onMessageMenu={(_, pos) => openMenu(evt, pos.el, row.side)}
                                    messages={[message]}
                                />
                            </div>
                            {#if canPin}
                                <button
                                    type="button"
                                    class="unpin"
                                    aria-label={$_("native.conversation.pinned.unpin")}
                                    title={$_("native.conversation.pinned.unpin")}
                                    onclick={() => unpinOne(evt)}
                                >
                                    <span class="circle">
                                        <span
                                            class="icon"
                                            style:mask="var(--icon-pin) center/contain no-repeat"
                                        ></span>
                                    </span>
                                </button>
                            {/if}
                        </div>
                    {/each}
                {/each}
            </div>
        </div>
    {/if}
</div>

<AnchoredMenu
    anchor={moreAnchor}
    items={moreItems}
    label={$_("native.conversation.pinned.options")}
    onSelect={() => (confirming = true)}
    onClose={() => (moreAnchor = null)}
/>

<NativeAlert
    open={confirming}
    title={$_("native.conversation.pinned.unpinAllTitle", { values: { count: allCount } })}
    message={$_("native.conversation.pinned.unpinAllBody")}
    confirmLabel={$_("native.conversation.pinned.unpinAllConfirm")}
    danger
    onConfirm={unpinAll}
    onClose={() => (confirming = false)}
/>

<MessageLongPressMenu
    open={menuOpen}
    target={pressed?.el ?? null}
    side={pressed?.side ?? "received"}
    items={menuItems}
    label={$_("native.conversation.message.options")}
    onSelect={onMenu}
    onClose={() => (menuOpen = false)}
/>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .pinned {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: var(--surface-0);
    }

    .state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-8);
        padding: var(--space-24) var(--space-32);
        text-align: center;
    }

    .state-icon {
        width: 28px;
        height: 28px;
        margin-block-end: var(--space-4);
        background: var(--ink-4);
    }

    .state-title {
        margin: 0;
        font: var(--weight-semibold) text-size(16px) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .state-body {
        margin: 0;
        max-width: 280px;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .waiting {
        display: flex;
        justify-content: center;
        padding-block-start: var(--space-12);
    }

    // starts at the bottom (column-reverse), as a chat does
    .scroller {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column-reverse;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        scrollbar-width: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    // the chat's 12px sides; the safe area and 24px under the last (04)
    .list {
        display: flex;
        flex-direction: column;
        padding: var(--space-4) var(--space-12) calc(var(--safe-bottom) + var(--space-24));
    }

    .date {
        display: flex;
        justify-content: center;
        padding-block: var(--space-16) var(--space-4);
    }

    .pill {
        padding: var(--space-6) var(--space-12);
        border-radius: var(--radius-pill);
        background: var(--overlay-1);
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    // a pin: its bubble, and the pin button on its open side (after a received one, before your
    // own); without the button, its room is kept, as the chat leaves it
    .pin {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding-block-start: var(--space-12);

        &.sent {
            flex-direction: row-reverse;
        }

        &.room {
            padding-inline-end: 44px;
        }

        &.room.sent {
            padding-inline: 60px 0;
        }
    }

    // as wide as the bubble, so the button sits beside it
    .bubble {
        flex: 0 1 auto;
        min-width: 0;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        --group-gap: 8px;
        --group-ring: transparent;
    }

    // a 30px circle in a 44px tap area (04)
    .unpin {
        all: unset;
        flex: none;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible .circle {
            outline: 2px solid var(--accent);
        }
    }

    .circle {
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border-radius: var(--radius-circle);
        background: var(--overlay-1);
    }

    .icon {
        width: 14px;
        height: 14px;
        background: var(--accent-bright);
    }

    /* the old UI's markdown, inside the bubble's own text: no outer spacing */
    .bubble :global(.markdown-wrapper > :first-child) {
        margin-block-start: 0;
    }

    .bubble :global(.markdown-wrapper > :last-child) {
        margin-block-end: 0;
    }

    // a sent bubble's text in the light chat: orange's white needs a shadow to read (04)
    .pinned :global([data-bubble-sent]) {
        text-shadow: var(--bubble-text-shadow);
    }

    :global([data-mode="light"]) .pinned :global([data-bubble-sent] a) {
        color: var(--bubble-link);
    }
</style>
