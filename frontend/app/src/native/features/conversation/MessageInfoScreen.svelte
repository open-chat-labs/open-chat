<!-- A message's info (native design notes §3.3), pushed from its long-press menu over the
     conversation: the message as the conversation shows it, on a panel of its own, then when it was
     sent, its status (a DM's own message: sending, sent, read, failed), whether it was forwarded or
     edited, and its reactions, each with who added it. Groups' "Read by" / "Delivered to" and an edit
     history aren't kept by the backend (GAPS.md, "Native conversation"). It follows the message as
     it changes (a reaction added, an edit), and holds what it showed while it slides out, or once
     the message is gone (deleted for good, disappeared). -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifiersEqual,
        chitStateStore,
        communitiesStore,
        cryptoLookup,
        currentUserIdStore,
        eventsStore,
        exchangeRatesLookupStore,
        failedMessagesStore,
        isDiamondStore,
        isLifetimeDiamondStore,
        isPreviewingOrLapsed,
        localUpdates,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedServerChatStore,
        unconfirmedReadByThem,
        unconfirmedStore,
        webhookUserIdsStore,
        type ChatSummary,
        type EventWrapper,
        type Message,
        type OpenChat,
    } from "@client";
    import Avatar, { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import MessageGroup from "@openchat/ui/src/lib/components/MessageGroup.svelte";
    import type { GroupMessage } from "@openchat/ui/src/lib/types";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { textAsMarkdown } from "@src/logic/conversation/messageHandlers";
    import {
        conversationContext,
        messageRow,
        messageStatus,
        readByThem,
        senderColor,
    } from "@src/logic/conversation/messageRow";
    import { lowBandwidth } from "@src/stores/settings";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { HeldWhileLeaving } from "./heldWhileLeaving";
    import { infoStatus, reactionRows } from "./messageInfo.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "message_info" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const me = $derived($currentUserIdStore);

    // the conversation under it keeps its chat selected; once that goes (Back from the
    // conversation), what was shown is held
    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, screen.chatId),
    );
    const live = $derived.by((): EventWrapper<Message> | undefined => {
        if (!selected) return undefined;
        for (const evt of $eventsStore) {
            if (evt.event.kind === "message" && evt.event.messageId === screen.messageId) {
                return evt as EventWrapper<Message>;
            }
        }
        return undefined;
    });
    const held = new HeldWhileLeaving<EventWrapper<Message> | undefined>(undefined);
    const evt = $derived(held.of(live !== undefined, live));
    const heldChat = new HeldWhileLeaving<ChatSummary | undefined>(undefined);
    const chat = $derived(heldChat.of(selected, $selectedChatSummaryStore));

    // whether it failed, and whether the backend has it yet (as the conversation's list says)
    const where = $derived({ chatId: screen.chatId });
    const failed = $derived.by(() => {
        void $failedMessagesStore;
        return evt !== undefined && localUpdates.isFailed(where, evt.event.messageId);
    });
    const accepted = $derived.by(() => {
        void $unconfirmedStore;
        return (
            evt !== undefined && !localUpdates.isPendingAcceptance(where, evt.event.messageId)
        );
    });

    // the message as the conversation draws it (logic/conversation/messageRow), without its controls
    const ctx = $derived(
        conversationContext({
            client,
            chat,
            me,
            formatter: $_,
            users: $allUsersStore,
            webhooks: $selectedChatWebhooksStore,
            webhookIds: $webhookUserIdsStore,
            detailsLoaded: $selectedServerChatStore !== undefined,
            lowBandwidth: $lowBandwidth,
            revealed: () => true,
            claimant: {
                previewingOrLapsed: chat !== undefined && isPreviewingOrLapsed(chat, $communitiesStore),
                diamond: $isDiamondStore,
                lifetimeDiamond: $isLifetimeDiamondStore,
                streak: $chitStateStore.streak,
                chitEarned: $chitStateStore.totalChitEarned,
            },
            tokens: $cryptoLookup,
            rates: () => exchangeRatesLookupStore.value,
            face: (userId) => AVATAR_GRADIENTS[senderColor(userId)],
            threads: false,
        }),
    );

    const theirsRead = $derived(
        evt !== undefined &&
            chat !== undefined &&
            readByThem(client, chat, evt.event, $unconfirmedReadByThem),
    );
    const status = $derived(messageStatus({ failed, accepted, readByThem: theirsRead }));
    const row = $derived(evt === undefined ? undefined : messageRow(evt, status, ctx));

    const mine = $derived(evt?.event.sender === me);
    const statusKey = $derived(
        chat?.kind === "direct_chat" && mine ? infoStatus(status) : undefined,
    );

    const reactions = $derived(
        evt === undefined
            ? []
            : reactionRows(evt.event.reactions, me, (userId) =>
                  userId === me
                      ? $_("native.conversation.info.you")
                      : client.displayName($allUsersStore.get(userId)),
              ),
    );

    // the users who reacted that aren't known yet
    $effect(() => {
        const missing = (evt?.event.reactions ?? [])
            .flatMap((r) => [...r.userIds])
            .filter((userId) => !$allUsersStore.has(userId));
        if (missing.length > 0) void client.getMissingUsers(missing);
    });
</script>

<div class="info">
    <NativePageHeader title={$_("native.conversation.info.title")} onBack={context.back} />
    <div class="body">
        {#if row !== undefined && evt !== undefined}
            {@const content = evt.event.content}
            {#snippet body()}
                {#if content.kind === "text_content"}
                    <Markdown text={content.text} inline={!evt.event.blockLevelMarkdown} />
                {/if}
            {/snippet}
            {@const message =
                content.kind === "text_content" && textAsMarkdown(content.text)
                    ? ({ ...row.message, body } as GroupMessage)
                    : row.message}
            <div class="panel" inert>
                <MessageGroup
                    side={row.side}
                    senderName={row.senderName}
                    color={row.color}
                    showAvatar={false}
                    showName={chat?.kind !== "direct_chat" && row.side === "received"}
                    avatarSize={28}
                    mirror
                    hoverBar={false}
                    messages={[message]}
                />
            </div>

            <SettingsGroup>
                <div class="settings-row line">
                    <span class="icon" style:mask="var(--icon-clock) center/contain no-repeat"
                    ></span>
                    <span class="label">{$_("native.conversation.info.sentAt")}</span>
                    <span class="value">
                        {client.toDatetimeString(new Date(Number(evt.timestamp)))}
                    </span>
                </div>
                {#if statusKey !== undefined}
                    <div class="settings-row line">
                        <span
                            class="icon"
                            style:mask="var(--icon-{status === 'delivered'
                                ? 'check-double'
                                : 'check'}) center/contain no-repeat"></span>
                        <span class="label">{$_("native.conversation.info.status")}</span>
                        <span class="value" class:read={status === "delivered"}>
                            {$_(statusKey)}
                        </span>
                    </div>
                {/if}
                {#if evt.event.forwarded}
                    <div class="settings-row line">
                        <span
                            class="icon"
                            style:mask="var(--icon-forward) center/contain no-repeat"></span>
                        <span class="label">{$_("native.conversation.info.forwarded")}</span>
                    </div>
                {/if}
                {#if evt.event.edited}
                    <div class="settings-row line">
                        <span class="icon" style:mask="var(--icon-edit) center/contain no-repeat"
                        ></span>
                        <span class="label">{$_("native.conversation.info.edited")}</span>
                    </div>
                {/if}
            </SettingsGroup>

            {#if reactions.length > 0}
                <SettingsGroup label={$_("native.conversation.info.reactions")}>
                    {#each reactions as reaction (`${reaction.userId}:${reaction.emoji}`)}
                        <div class="settings-row line person">
                            <Avatar size={32} color={senderColor(reaction.userId)} />
                            <span class="label">{reaction.name}</span>
                            <span class="emoji">{reaction.emoji}</span>
                        </div>
                    {/each}
                </SettingsGroup>
            {/if}
        {/if}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .info {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);
    }

    // the message on a panel of its own, as the chat shows it, and as unselectable
    .panel {
        flex: none;
        padding: var(--space-16) var(--space-12);
        border-radius: 16px;
        background: var(--overlay-1);
        --group-gap: 8px;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .line {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 52px;
        padding: 0 var(--space-16);

        &.person {
            min-height: 56px;
        }
    }

    .icon {
        flex: none;
        width: 19px;
        height: 19px;
        background: var(--ink-3);
    }

    .label {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .value {
        flex: none;
        max-width: 60%;
        font: var(--weight-medium) text-size(14px) / 1.3 var(--font-sans);
        color: var(--ink-3);
        text-align: end;

        &.read {
            color: var(--accent-bright);
        }
    }

    .emoji {
        flex: none;
        font-size: 22px;
        line-height: 1;
    }
</style>
