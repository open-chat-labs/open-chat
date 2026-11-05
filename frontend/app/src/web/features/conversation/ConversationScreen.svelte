<!-- The middle column's conversation (region "conversation", phase 3b): the selected chat's header
     and its messages, read only (the composer is 3c). The list is the old UI's (ChatEventList: paging,
     deep links, marking read, keeping the scroll), one row per event, each message in a MessageGroup
     of its own that keeps its place in the sender's run (DATA.md, Conversation). -->
<script lang="ts">
    import { showInRightColumn } from "../app/rightPanel";
    import {
        allUsersStore,
        isDeletedWebhook,
        selectedServerChatStore,
        webhookUserIdsStore,
        formatClock,
        anonUserStore,
        blockedUsersStore,
        botState,
        bridgedUsersStore,
        buildTransactionUrl,
        byContext as typersByContext,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatsInitialisedStore,
        chitStateStore,
        communitiesStore,
        communityPreviewOriginStore,
        cryptoBalanceStore,
        currentUserStore,
        cryptoLookup,
        currentUserIdStore,
        eventsStore,
        exchangeRatesLookupStore,
        failedMessagesStore,
        favouritesStore,
        formatTokens,
        getConvertedBalances,
        i18nKey,
        isDiamondStore,
        isLifetimeDiamondStore,
        isOwnMessage,
        isPreviewingOrLapsed,
        isPrivateCommunityPreview,
        localUpdates,
        messageIndexStore,
        messageMenu,
        messagesRead,
        pollVoteChange,
        prizeClaimCustomData,
        publish,
        screenWidth,
        selectedChatBlockedUsersStore,
        selectedChatDraftMessageStore,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatPinnedMessagesStore,
        selectedChatWebhooksStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        suspendedUserStore,
        swapAcceptCost,
        swapActions,
        swapFailureMessage,
        threadOpenStore,
        throttleDeadline,
        TimelineGrouper,
        translationsStore,
        unconfirmedReadByThem,
        unconfirmedStore,
        undeletingMessagesStore,
        type ChatEvent,
        type ChatIdentifier,
        type ChatSummary,
        type EventWrapper,
        type FileContent,
        type Message,
        type MessageMenu,
        type MessageMenuAction,
        type OpenChat,
        type P2PSwapContent,
        type PollContent,
    } from "@client";
    import ConversationHeader from "@openchat/ui/src/features/components/ConversationHeader.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import MessageActions from "@openchat/ui/src/lib/components/MessageActions.svelte";
    import MessageGroup from "@openchat/ui/src/lib/components/MessageGroup.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import UnreadDivider from "@openchat/ui/src/lib/components/UnreadDivider.svelte";
    import ChatEventList, { type ChatEventListArgs } from "@src/core/ChatEventList.svelte";
    import { TimelineFlattener, type FlatChatItem } from "@src/core/flatChatItems";
    import Markdown from "@src/core/Markdown.svelte";
    import type { GroupMessage } from "@openchat/ui/src/lib/types";
    import {
        entryBlock,
        focusEntryOnOpen,
        throttleCountdown,
    } from "@src/logic/composer/composer";
    import {
        confirmMessageDeletion,
        dclickReply,
        enterSend,
        lowBandwidth,
    } from "@src/stores/settings";
    import { quickReactions } from "@src/stores/quickReactions";
    import { disableTipsFeature } from "@src/utils/features";
    import { messageSwipeLeft } from "@src/utils/messageSwipe";
    import { canShareMessage } from "@src/utils/share";
    import { messageDoubleClickAction } from "@src/logic/conversation/messageDoubleClick";
    import { getProxyAdjustedBlobUrl } from "@src/utils/media";
    import { now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { formatConvertedValue } from "@src/logic/wallet/walletState.svelte";
    import { detectMarkdown } from "@src/utils/detectMarkdown";
    import { isTouchOnlyDevice } from "@src/utils/devices";
    import { isSingleEmoji } from "@src/utils/emojis";
    import { buildDisplayName, findUser } from "@src/utils/user";
    import {
        aggregateEventText,
        isTextEvent,
        timelineEventText,
        type EventTextContext,
    } from "@src/logic/conversation/timelineEventText";
    import { getContext, untrack, type ComponentProps, type Snippet } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import { chatMenuState, runChatMenuItem } from "./chatMenu";
    import Composer from "./Composer.svelte";
    import {
        composerContext,
        headerMenuItems,
        isMedia,
        mediaHeld,
        messageMenuItems,
        messageStatus,
        senderColor,
        untilNextDay,
        type ConversationContext,
        type MediaContent,
        type MessageRow,
    } from "./conversation.adapter";
    import MediaViewer from "./MediaViewer.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";
    import { deleteMessage, runMessageAction } from "./messageMenu";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import HumanCheckFrame from "@src/core/HumanCheckFrame.svelte";
    import { HumanCheck } from "@src/logic/prize/humanCheck.svelte";
    import { claimPrizeWithHumanCheck } from "@src/logic/prize/prizeClaim";
    import { interpolate } from "@i18n/i18n";
    import { VoicePlayer, type VoiceSpeed } from "./voicePlayer.svelte";
    import { RowCache } from "./rowCache";
    import { profileClickedEvent } from "@src/web-components/profileLink";
    import { navigate } from "@src/utils/navigation";
    import { isJoining, type JoinTarget } from "@src/logic/join/joinFlow.svelte";
    import { previewBar, type PreviewBar } from "@src/logic/join/previewBar";
    import { join } from "../join/join";
    import { previewBarProps } from "../join/previewBar.adapter";

    let { context: screen }: ScreenProps<Extract<MiddleRegion, { kind: "conversation" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the route's chat, once the client has selected it (Router: setSelectedChat)
    const chat = $derived($selectedChatSummaryStore);
    const me = $derived($currentUserIdStore);

    // the day, which changes at midnight, so "Today" and "Yesterday" are worked out again then
    let day = $state(new Date().toDateString());
    $effect(() => {
        void day;
        const timer = setTimeout(
            () => (day = new Date().toDateString()),
            untilNextDay(new Date()) + 1000,
        );
        return () => clearTimeout(timer);
    });

    // what a prize's requirements ask of the reader; rows are made again when it changes (joining
    // a previewed chat offers its prizes' Claim)
    const claimant = $derived({
        previewingOrLapsed: chat !== undefined && isPreviewingOrLapsed(chat, $communitiesStore),
        diamond: $isDiamondStore,
        lifetimeDiamond: $isLifetimeDiamondStore,
        streak: $chitStateStore.streak,
        chitEarned: $chitStateStore.totalChitEarned,
    });

    // the exchange rates load after the first rows; once they do, rows are made again (below)
    const ratesLoaded = $derived($exchangeRatesLookupStore.size > 0);

    const ctx = $derived.by((): ConversationContext => {
        void day;
        // a revealed image redoes its row (the cache is cleared with it), as do the token registry
        // and the exchange rates arriving: rows are made again from this, so it has to change too
        void rowsVersion;
        void $cryptoLookup;
        void ratesLoaded;
        const users = $allUsersStore;
        const webhooks = $selectedChatWebhooksStore;
        const webhookIds = $webhookUserIdsStore;
        const detailsLoaded = $selectedServerChatStore !== undefined;
        return {
            me,
            you: $_("you"),
            // a webhook's messages are sent as it, named as the old timeline names them (findUser)
            userName: (userId) =>
                isDeletedWebhook(userId, webhooks, webhookIds, detailsLoaded)
                    ? $_("webhook.deleted")
                    : client.displayName(findUser(userId, users, webhooks)),
            contentText: (content) => client.getContentAsText($_, content),
            time: (timestamp) => client.toShortTimeString(new Date(Number(timestamp))),
            date: (timestamp) =>
                client.formatMessageDate(timestamp, $_("today"), $_("yesterday"), true, true),
            media: {
                lowBandwidth: $lowBandwidth,
                revealed: (messageId) => revealed.has(messageId),
                url: getProxyAdjustedBlobUrl,
            },
            direct: chat?.kind === "direct_chat",
            readonly: chat !== undefined && client.isChatReadOnly(chat.id),
            now: Date.now(),
            claimant,
            text: (key) => interpolate($_, key),
            token: (ledger) => {
                const token = $cryptoLookup.get(ledger);
                if (token === undefined) return undefined;
                return {
                    symbol: token.symbol,
                    logo: token.logo,
                    amount: (e8s) => formatTokens(e8s, token.decimals),
                    usd: (e8s) => {
                        const { dollarBalance } = getConvertedBalances(
                            exchangeRatesLookupStore.value,
                            e8s,
                            token.decimals,
                            ledger,
                        );
                        return dollarBalance === undefined
                            ? ""
                            : formatConvertedValue("usd", dollarBalance);
                    },
                };
            },
        };
    });

    // ── media ──

    // what the reader asked to see full size in low bandwidth (5a invariant 1), and what's open
    // in the viewer
    const revealed = new Set<bigint>();
    let viewing = $state<MediaContent>();

    function openMedia(msg: Message) {
        if (!isMedia(msg.content)) return;
        if (mediaHeld(msg.content, msg.messageId, ctx.media)) {
            // the first click shows it in the bubble; the next opens it
            revealed.add(msg.messageId);
            rows.clear();
            rowsVersion += 1;
        } else {
            viewing = msg.content;
        }
    }

    const level = $derived(chat?.kind === "channel" ? "channel" : "group");
    const eventCtx = $derived.by((): EventTextContext => {
        const users = $allUsersStore;
        return {
            formatter: $_,
            me,
            users,
            displayName: (userId, kind) => buildDisplayName(users, userId, kind),
            level,
            canInvite: chat !== undefined && client.canInviteUsers(chat.id),
            botName: (botId) => botState.externalBots.get(botId)?.name,
        };
    });

    // ── the header ──

    const title = $derived(
        chat === undefined
            ? ""
            : chat.kind === "direct_chat"
              ? client.displayName($allUsersStore.get(chat.them.userId))
              : chat.name,
    );
    const favourite = $derived(chat !== undefined && $favouritesStore.has(chat.id));

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

    // ── the composer ──

    const block = $derived(
        chat === undefined
            ? undefined
            : entryBlock({
                  suspended: $suspendedUserStore,
                  frozen: client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore),
                  blocked: chat.kind === "direct_chat" && $blockedUsersStore.has(chat.them.userId),
                  previewing: chat.kind !== "direct_chat" && client.isPreviewing(chat.id),
                  lapsed: client.isLapsed(chat.id),
                  direct: chat.kind === "direct_chat",
                  externalContent: chat.kind === "channel" && chat.externalUrl !== undefined,
                  anonymous: $anonUserStore,
                  canSend: client.canSendMessage(chat.id, "message", "text"),
                  thread: false,
              }),
    );

    // a preview's bar in place of the composer (8b): the community's while the community is
    // previewed, else the group's or channel's (logic/join/previewBar)
    const preview = $derived.by(() => {
        if (block?.kind !== "preview" || chat === undefined || chat.kind === "direct_chat") {
            return undefined;
        }
        const community = $selectedCommunitySummaryStore;
        // what the client's calls below read through `.value`, so the bar follows it: a lapse or a
        // join (the communities), Diamond bought or CHIT earned (the user), a top-up (balances)
        void [$communitiesStore, $currentUserStore, $cryptoBalanceStore];
        const bar = previewBar({
            chat,
            community,
            lapsed: client.isLapsed(chat.id),
            // as joining asks for them: those an invitation bypasses left out
            gates: client.accessGatesForChat(chat, true),
            guest: $anonUserStore,
            originCommunityId: $communityPreviewOriginStore?.communityId,
            meets: (gate) => client.doesUserMeetAccessGate(gate),
        });
        const avatarUrl =
            bar.community !== undefined
                ? client.communityAvatarUrl(bar.community.id.communityId, bar.community.avatar)
                : client.groupAvatarUrl(chat, community);
        return { bar, props: previewBarProps(bar, avatarUrl, (key) => interpolate($_, key)) };
    });

    // "You joined …" names what the bar does
    function joinPreviewed(bar: PreviewBar) {
        void join(client, bar.target, screen.dialogs, bar.name);
    }

    // cancels the preview: back where it was opened from (Explore), else the list
    function leavePreview(target: JoinTarget) {
        navigate(
            client.cancelPreview(
                target.kind === "community" ? target.community.id : target.chat.id,
            ),
        );
    }

    // the others in this chat who are typing
    const typingNames = $derived(
        chat === undefined
            ? []
            : [...($typersByContext.get({ chatId: chat.id }) ?? [])]
                  .filter((userId) => userId !== me)
                  .map((userId) => client.displayName($allUsersStore.get(userId))),
    );

    // too many messages a minute: a countdown until sending resumes (the old ThrottleCountdown);
    // the clock only ticks once there's a deadline
    const countdown = $derived(
        $throttleDeadline > 0 ? throttleCountdown($throttleDeadline, $now500) : undefined,
    );
    const throttled = $derived(
        countdown !== undefined
            ? $_("throttleMessage", { values: { time: countdown.seconds } })
            : "",
    );

    // the message being replied to or edited, above the composer's text (the chat's draft, which
    // the reply and the edit set)
    const draft = $derived($selectedChatDraftMessageStore);
    const composing = $derived(composerContext(draft, ctx));

    // cancelling an edit drops the draft, as the old composer did; a reply just goes
    function cancelComposing(chatId: ChatIdentifier) {
        if (draft?.editingEvent !== undefined) {
            localUpdates.draftMessages.delete({ chatId });
        } else {
            localUpdates.draftMessages.setReplyingTo({ chatId }, undefined);
        }
    }

    // the client drops the draft as the edit goes out, and undoes the edit if it fails
    async function submitEdit(chatId: ChatIdentifier, text: string) {
        const editing = draft?.editingEvent;
        if (editing === undefined) return;
        const edited = await client.editMessage({ chatId }, text, detectMarkdown(text), editing);
        if (!edited) toastStore.showFailureToast(i18nKey("errorEditingMessage"));
    }

    // the message replied to or edited, if it's in this chat (a private reply quotes another's)
    const composingIndex = $derived.by(() => {
        if (chat === undefined) return undefined;
        if (draft?.editingEvent !== undefined) return draft.editingEvent.event.messageIndex;
        const reply = draft?.replyingTo;
        return reply !== undefined &&
            chatIdentifiersEqual(reply.sourceContext.chatId, chat.id) &&
            reply.sourceContext.threadRootMessageIndex === undefined
            ? reply.messageIndex
            : undefined;
    });

    function jumpToComposing(chatId: ChatIdentifier, index: number) {
        list?.scrollToMessageIndex({ chatId }, index, false);
    }

    // done once the message shows in the chat; refused (throttled, the rules or the PIN turned
    // down, a send already on its way, a bot that takes no direct messages), it rejects
    async function send(chat: ChatSummary, text: string): Promise<void> {
        const context = { chatId: chat.id };
        // a direct chat with a bot sends what was typed as the bot's direct-message command
        // TODO(design): the old UI's command selector ("/") and its warning when the bot takes no
        // direct messages (GAPS.md)
        if (client.directChatWithBot(chat) !== undefined) {
            const outcome = client.sendDirectBotMessage(context, text, detectMarkdown(text));
            if (outcome.kind !== "sent") throw new Error(outcome.kind);
            return;
        }
        // the client mentions those typed as @username
        const outcome = await client.sendMessage(context, text, detectMarkdown(text), undefined);
        if (outcome.kind !== "posted") throw new Error(outcome.kind);
    }

    // ── what can be shown ──

    // a private chat or community that isn't joined shows no messages (as the old UI)
    const privatePreview = $derived.by(() => {
        if (chat === undefined) return false;
        return (
            isPrivateCommunityPreview($selectedCommunitySummaryStore) ||
            client.maskChatMessages(chat)
        );
    });
    const readonly = $derived(chat !== undefined && client.isChatReadOnly(chat.id));
    const levelText = $derived($_(`level.${level}`).toLowerCase());

    // ── the timeline ──

    const grouper = new TimelineGrouper();
    const flattener = new TimelineFlattener();
    const items = $derived.by((): FlatChatItem[] => {
        if (chat === undefined) return [];
        const timeline = grouper.group(
            $eventsStore,
            me,
            chat.kind === "channel" && chat.public,
            $selectedChatExpandedDeletedMessageStore,
            undefined,
            true,
        );
        return flattener.flatten(timeline);
    });

    // The first unread message when the chat was opened: the unread divider stays above it while
    // the chat is open, as messages are read. Worked out with the chat, so a new chat never shows
    // the last one's
    let firstUnreadFor: { key: string; index: number | undefined } | undefined;
    const firstUnread = $derived.by(() => {
        const current = chat;
        if (current === undefined) return undefined;
        const key = chatIdentifierToString(current.id);
        if (firstUnreadFor?.key !== key) {
            firstUnreadFor = {
                key,
                index: untrack(() =>
                    messagesRead.getFirstUnreadMessageIndex(
                        current.id,
                        current.latestMessage?.event.messageIndex,
                    ),
                ),
            };
        }
        return firstUnreadFor.index;
    });

    // Go to the route's message (a deep link), as the old list does: when it changes, and when the
    // chat does
    let list: ChatEventList | undefined = $state();
    let initialised = $state(false);

    // A new chat's list starts uninitialised, as the old UI's did, unless the chat has nothing to
    // load
    const chatKey = $derived(chat && chatIdentifierToString(chat.id));
    let initialisedFor: string | undefined;
    $effect.pre(() => {
        const key = chatKey;
        if (key === initialisedFor) return;
        initialisedFor = key;
        initialised = untrack(() => chat !== undefined && chat.latestEventIndex <= 0);
    });
    let previousChatId: ChatIdentifier | undefined;
    let previousMessageIndex: number | undefined;
    $effect(() => {
        void $threadOpenStore;
        const idx = $messageIndexStore;
        const chatId = $selectedChatIdStore;
        // until the list is there (the chat loading, a private preview), the link waits for it
        const current = list;
        if (current === undefined) return;
        const sameChat = chatIdentifiersEqual(chatId, previousChatId);
        if (
            $chatsInitialisedStore &&
            chatId !== undefined &&
            idx !== undefined &&
            (!sameChat || idx !== previousMessageIndex)
        ) {
            untrack(() => current.scrollToMessageIndex({ chatId }, idx, false));
        }
        previousChatId = chatId;
        previousMessageIndex = idx;
    });

    function status(evt: EventWrapper<Message>, args: ChatEventListArgs, failed: boolean) {
        const msg = evt.event;
        return messageStatus({
            failed,
            accepted: args.isAccepted($unconfirmedStore, evt),
            readByThem:
                chat?.kind === "direct_chat" &&
                (client.messageIsReadByThem(chat.id, msg.messageIndex) ||
                    $unconfirmedReadByThem.has(msg.messageId)),
        });
    }

    // rows kept per event (RowCache), and their messages with them, so user and other chat
    // updates don't redo every bubble; started again for a new chat, wording or day
    const rows = new RowCache();
    const groupMessages = new WeakMap<MessageRow, { offers: string; messages: GroupMessage[] }>();
    // bumped when a revealed image needs its row redone
    let rowsVersion = $state(0);
    $effect.pre(() => {
        void chatKey;
        void $_;
        void day;
        // rows don't key on the media view or the token registry (a transfer shows as text until
        // its ledger is known), so a change to either starts them again
        void $lowBandwidth;
        void $cryptoLookup;
        // nor the exchange rates: they're redone once the rates first load (a dollar value would be
        // missing), not at every five-minute refresh
        void ratesLoaded;
        void claimant;
        rows.clear();
    });

    // a date pill's label, worked out again when the day changes
    function dateLabel(timestamp: bigint): string {
        void day;
        return client.formatMessageDate(timestamp, $_("today"), $_("yesterday"));
    }

    function messagesFor(
        row: MessageRow,
        body: Snippet,
        withBody: boolean,
        evt: EventWrapper<Message>,
        offers: RowOffers,
    ): GroupMessage[] {
        const key = `${offers.menu}|${offers.swipeLeft}|${offers.retry !== undefined}`;
        const kept = groupMessages.get(row);
        if (kept?.offers === key) return kept.messages;
        const message = withBody
            ? ({ ...row.message, body } as GroupMessage)
            : withActions(row, evt.event);
        const messages = [
            {
                ...message,
                ...previewRemoval(evt),
                ...retryFor(row.message, offers.retry),
                menu: offers.menu,
                swipeLeft: offers.swipeLeft,
            } as GroupMessage,
        ];
        groupMessages.set(row, { offers: key, messages });
        return messages;
    }

    // ── message actions ──

    type MenuPos = Parameters<NonNullable<ComponentProps<typeof MessageGroup>["onMessageMenu"]>>[1];

    // what a row's message offers that's part of how it shows (its menu, its swipe, Retry)
    type RowOffers = {
        menu: boolean;
        swipeLeft: "edit" | "reply" | "forward" | undefined;
        retry: (() => void) | undefined;
    };

    // what a message offers (messageMenu, as the old trees decide it): read as it renders, so a
    // row follows the chat's permissions and the message's state
    function offeredFor(
        current: ChatSummary,
        evt: EventWrapper<Message>,
        failed: boolean,
        confirmed: boolean,
    ): MessageMenu {
        const msg = evt.event;
        const chatId = current.id;
        return messageMenu({
            message: msg,
            userId: me,
            showAsMe: isOwnMessage(msg, me, $bridgedUsersStore),
            chatKind: current.kind,
            publicGroup: current.kind !== "direct_chat" && current.public,
            confirmed,
            failed,
            collapsed: false,
            readonly,
            ephemeral: localUpdates.isEphemeral({ chatId }, msg.messageId),
            pinned: $selectedChatPinnedMessagesStore.has(msg.messageIndex),
            translated: $translationsStore.has(msg.messageId),
            undeleting: $undeletingMessagesStore.has(msg.messageId),
            now: Date.now(),
            // TODO(4c): the thread's own list
            thread: undefined,
            supportsEdit: true,
            supportsReply: true,
            shareable: canShareMessage(msg.content),
            // TODO(phase 5, 5b): tipping
            tipRecipient: undefined,
            tipsEnabled: !disableTipsFeature,
            permissions: {
                send: client.canSendMessage(chatId, "message"),
                react: client.canReactToMessages(chatId),
                pin: client.canPinMessages(chatId),
                tip: client.canTipMessages(chatId),
                deleteOthers: client.canDeleteOtherUsersMessages(chatId),
                blockSender:
                    client.canBlockUsers(chatId) && !$selectedChatBlockedUsersStore.has(msg.sender),
                startThread: client.canSendMessage(chatId, "thread"),
            },
        });
    }

    function rowOffers(
        evt: EventWrapper<Message>,
        failed: boolean,
        offered: MessageMenu,
    ): RowOffers {
        const swipeLeft = messageSwipeLeft(evt.event.sender === me, offered.actions);
        return {
            menu: offered.menu,
            // TODO(phase 5, 5b): forwarding
            swipeLeft: swipeLeft === "forward" ? undefined : swipeLeft,
            retry: offered.actions.has("retry") ? () => run("retry", evt, failed) : undefined,
        };
    }

    // a failed message's Retry, where its kind has one (a text bubble's line, a file or media
    // tile's button)
    function retryFor(message: GroupMessage, retry: (() => void) | undefined) {
        if (retry === undefined) return {};
        switch (message.kind) {
            case undefined:
            case "text":
                return { retryAction: retry };
            case "image":
            case "video":
            case "gif":
            case "file":
                return { onRetry: retry };
            default:
                return {};
        }
    }

    // the message whose menu (or emoji picker) is open
    let menu = $state<{
        evt: EventWrapper<Message>;
        failed: boolean;
        offered: MessageMenu;
        pos: MenuPos;
        pickerOnly: boolean;
    }>();

    function openMenu(
        current: ChatSummary,
        evt: EventWrapper<Message>,
        failed: boolean,
        confirmed: boolean,
        pos: MenuPos,
        pickerOnly: boolean,
    ) {
        const offered = offeredFor(current, evt, failed, confirmed);
        if (pickerOnly ? !offered.react : !offered.menu) return;
        menu = { evt, failed, offered, pos, pickerOnly };
    }

    // the open menu's items, in the app's words
    const messageItems = $derived.by(() => {
        if (menu === undefined) return [];
        const { evt, failed } = menu;
        return messageMenuItems(menu.offered.actions).map((item) =>
            item.action === "separator"
                ? { label: "", variant: "separator" as const }
                : {
                      label: $_(item.label),
                      variant: item.variant,
                      mask: item.mask,
                      onSelect: () => run(item.action, evt, failed),
                  },
        );
    });

    // the user's own reactions on the message whose menu is open
    const menuSelected = $derived(
        menu === undefined
            ? []
            : menu.evt.event.reactions
                  .filter((r) => r.userIds.has(me))
                  .map((r) => r.reaction),
    );

    // the message being deleted, once confirmed
    let deleting = $state<EventWrapper<Message>>();

    async function run(action: MessageMenuAction, evt: EventWrapper<Message>, failed: boolean) {
        if (chat === undefined) return;
        const dialog = await runMessageAction(action, {
            client,
            chatId: chat.id,
            evt,
            failed,
            me,
            users: $allUsersStore,
            formatter: $_,
            locale: $locale,
            diamond: $isDiamondStore,
            confirmDelete: $confirmMessageDeletion,
        });
        if (dialog?.kind === "delete") deleting = dialog.evt;
    }

    function confirmDelete() {
        const evt = deleting;
        deleting = undefined;
        if (chat === undefined || evt === undefined) return;
        void deleteMessage(client, chat.id, evt);
    }

    // a reaction added or taken off. The library's picker keeps no favourites of its own (the old
    // trees' picker counted its picks), so every reaction added counts towards the quick ones
    async function react(evt: EventWrapper<Message>, emoji: string) {
        if (chat === undefined) return;
        const toggled = await client.toggleReaction({ chatId: chat.id }, evt.event, emoji);
        if (toggled === "added") {
            quickReactions.incrementFavourite(emoji);
            quickReactions.reload();
        }
    }

    // double-click to edit your own message or reply to someone else's (the "double-click to reply"
    // setting), not on the hover bar or a control in the message
    function doubleClick(
        e: MouseEvent,
        evt: EventWrapper<Message>,
        failed: boolean,
        offered: MessageMenu,
    ) {
        const target = e.target;
        if (
            target instanceof Element &&
            target.closest("[data-msg-acts],a,button,input,textarea,[role=button]") !== null
        ) {
            return;
        }
        const action = messageDoubleClickAction(
            $dclickReply,
            { mine: evt.event.sender === me, deleted: evt.event.deleted },
            offered.actions,
        );
        if (action !== undefined) void run(action, evt, failed);
    }

    // the message replied to or edited, tinted in the list
    const composingId = $derived(
        draft?.editingEvent?.event.messageId ?? draft?.replyingTo?.messageId,
    );

    // ── link previews ──

    // the sender can remove a preview from their own text message, once they've confirmed it, as
    // in the old trees
    let removingPreview = $state<{ evt: EventWrapper<Message>; url: string }>();

    function previewRemoval(evt: EventWrapper<Message>) {
        const msg = evt.event;
        if (msg.sender !== me || msg.content.kind !== "text_content" || msg.ogPreviews.length === 0)
            return {};
        return {
            onRemovePreview: (index: number) => {
                const url = msg.ogPreviews[index]?.url;
                if (url !== undefined) removingPreview = { evt, url };
            },
        };
    }

    async function removePreview() {
        const removing = removingPreview;
        removingPreview = undefined;
        if (chat === undefined || removing === undefined) return;
        const removed = await client.hideLinkPreview(
            { chatId: chat.id },
            removing.evt,
            removing.url,
        );
        if (!removed) toastStore.showFailureToast(i18nKey("errorRemovingLinkPreview"));
    }

    // a rich kind's handlers, and a voice message's playing state (read as it renders, so playing
    // doesn't redo the row)
    function withActions(row: MessageRow, msg: Message): GroupMessage {
        const content = msg.content;
        if (isMedia(content)) {
            return { ...row.message, onOpen: () => openMedia(msg) } as GroupMessage;
        }
        if (content.kind === "crypto_content") {
            const url = buildTransactionUrl(content.transfer, $cryptoLookup);
            return url === undefined
                ? row.message
                : ({
                      ...row.message,
                      onOpen: () => window.open(url, "_blank", "noopener"),
                  } as GroupMessage);
        }
        if (content.kind === "p2p_swap_content") {
            return {
                ...row.message,
                onAccept: () => startSwap(msg, content, "accept"),
                onCancel: () => startSwap(msg, content, "cancel"),
            } as GroupMessage;
        }
        if (content.kind === "prize_content") {
            return {
                ...row.message,
                onClaim: (e: MouseEvent) => claim(msg, e),
            } as GroupMessage;
        }
        if (content.kind === "poll_content") {
            return {
                ...row.message,
                onVote: (next: number[]) => vote(msg, content, next),
            } as GroupMessage;
        }
        if (content.kind === "file_content") {
            return { ...row.message, onDownload: () => download(content) } as GroupMessage;
        }
        if (content.kind === "audio_content") {
            const key = row.message.id ?? "";
            const url = getProxyAdjustedBlobUrl(content.blobUrl);
            const length = Number(content.durationMs) / 1000;
            return {
                ...row.message,
                get playing() {
                    return voice.playing(key);
                },
                get progress() {
                    return length > 0 ? voice.time(key) / length : 0;
                },
                get elapsed() {
                    return formatClock(voice.time(key));
                },
                get speed() {
                    return voice.speed;
                },
                onPlay: () => voice.play(key, url),
                onPause: () => voice.pause(key),
                onSeek: (fraction: number) => voice.seek(key, url, fraction * length),
                onSpeedChange: (speed: VoiceSpeed) => voice.setSpeed(speed),
            } as GroupMessage;
        }
        return row.message;
    }

    // a file is saved under its own name. The blob is on the canister's own origin, where a
    // link's download attribute is ignored (the tab would go to the file), so it's fetched and
    // saved from here; if that fails it opens in a new tab, as the old trees do
    async function download(content: FileContent) {
        const url = getProxyAdjustedBlobUrl(content.blobUrl);
        if (url === undefined) return;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`status ${resp.status}`);
            const local = URL.createObjectURL(await resp.blob());
            const link = document.createElement("a");
            link.href = local;
            link.download = content.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(local), 60_000);
        } catch (err) {
            console.warn("Couldn't download a file, opening it instead", err);
            window.open(url, "_blank", "noopener");
        }
    }

    // a poll vote, if the poll can take one (5a invariant 4, pollVoteChange); the vote shows at once,
    // as in the old trees
    async function vote(msg: Message, content: PollContent, next: number[]) {
        if (chat === undefined || chat.kind === "direct_chat") return;
        const change = pollVoteChange(
            content,
            {
                me,
                sender: msg.sender,
                direct: false,
                readonly: client.isChatReadOnly(chat.id),
            },
            next,
        );
        if (change === undefined) return;
        const voted = await client.registerPollVote(
            chat.id,
            undefined,
            msg.messageId,
            msg.messageIndex,
            change.answerIndex,
            change.type,
        );
        if (!voted) toastStore.showFailureToast(i18nKey("poll.voteFailed"));
    }

    // each claimable prize's human check, run as it shows (HumanCheckFrame, under its card) so a
    // claim needn't wait for it
    const humanChecks = new Map<bigint, HumanCheck>();
    function humanCheckFor(messageId: bigint): HumanCheck {
        let check = humanChecks.get(messageId);
        if (check === undefined) {
            check = new HumanCheck();
            humanChecks.set(messageId, check);
        }
        return check;
    }

    // a prize claim, from the reader's own click (claimPrize refuses any other), with the token of
    // the prize's human check
    async function claim(msg: Message, e: MouseEvent) {
        if (chat === undefined || chat.kind === "direct_chat") return;
        const failure = await claimPrizeWithHumanCheck(
            client,
            humanCheckFor(msg.messageId),
            chat.id,
            msg.messageId,
            e,
        );
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    // accepting someone's swap offer (Diamond only: anyone else is offered the upgrade, as in the
    // old trees) or cancelling your own, once confirmed; only while it's open (swapActions). The
    // accept pays from the OpenChat wallet; the client asks for the PIN
    let swapping = $state<{ msg: Message; content: P2PSwapContent; action: "accept" | "cancel" }>();

    function startSwap(msg: Message, content: P2PSwapContent, action: "accept" | "cancel") {
        if (chat === undefined) return;
        const { canAccept, canCancel } = swapActions(content, {
            mine: msg.sender === me,
            now: Date.now(),
            readonly: client.isChatReadOnly(chat.id),
        });
        if (action === "accept" ? !canAccept : !canCancel) return;
        if (action === "accept" && !$isDiamondStore) {
            publish("upgrade");
            return;
        }
        swapping = { msg, content, action };
    }

    async function settleSwap() {
        const swap = swapping;
        swapping = undefined;
        if (chat === undefined || swap === undefined) return;
        const { msg, content, action } = swap;
        const resp =
            action === "accept"
                ? await client.acceptP2PSwap(
                      chat.id,
                      undefined,
                      msg.messageId,
                      content.token1,
                      content.token1Amount,
                  )
                : await client.cancelP2PSwap(chat.id, undefined, msg.messageId);
        if (resp.kind === "success") {
            // the accept paid token1; a cancel returns token0
            client.refreshAccountBalance(
                action === "accept" ? content.token1.ledger : content.token0.ledger,
            );
        } else if ($pinNumberErrorMessageStore !== undefined) {
            toastStore.showFailureToast($pinNumberErrorMessageStore);
        } else {
            toastStore.showFailureToast(swapFailureMessage(action === "accept"));
        }
    }

    // one voice message plays at a time, and none once the chat is left
    const voice = new VoicePlayer();
    $effect(() => {
        void chatKey;
        return () => voice.stop();
    });

    // a lone native emoji shows as the bubble's own, large; anything else (a custom emoji too)
    // goes through the markdown
    function withMarkdown(text: string): boolean {
        return !isSingleEmoji(text) || /^!emoji\(/.test(text);
    }

    // a row the reader hasn't read is watched until it has been on screen long enough (the list's
    // observer reads data-index / data-id)
    function observeRead(
        node: HTMLElement,
        args: { observer?: IntersectionObserver; read: boolean },
    ) {
        let observer = args.observer;
        if (!args.read) observer?.observe(node);
        return {
            update(next: { observer?: IntersectionObserver; read: boolean }) {
                if (next.read || next.observer !== observer) observer?.unobserve(node);
                observer = next.observer;
                if (!next.read) observer?.observe(node);
            },
            destroy: () => observer?.unobserve(node),
        };
    }

    function isMessage(evt: EventWrapper<ChatEvent>): evt is EventWrapper<Message> {
        return evt.event.kind === "message";
    }
</script>

{#if chat === undefined}
    <div class="state"><Spinner /></div>
{:else}
    <div class="conversation">
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

        {#if privatePreview}
            <div class="state">
                <EmptyState
                    preset="no-conversations"
                    title={$_("group.privateGroup", { values: { level: levelText } })}
                    body={$_("group.privateGroupInfo", { values: { level: levelText } })}
                    actionLabel=""
                />
            </div>
        {:else}
            <div class="messages">
                <ChatEventList
                    bind:this={list}
                    rootSelector="conversation"
                    {chat}
                    threadRootEvent={undefined}
                    {items}
                    {readonly}
                    maintainScroll
                    visible
                    bind:initialised
                    viewportClass="conversation-list"
                >
                    {#snippet row(item, args)}
                        {#if item.kind === "timeline_date"}
                            <div class="date">
                                <UnreadDivider tone="neutral" label={dateLabel(item.timestamp)} />
                            </div>
                        {:else if item.kind === "event"}
                            {@const evt = item.event}
                            {#if isMessage(evt)}
                                {@const msg = evt.event}
                                {@const failed = args.isFailed($failedMessagesStore, evt)}
                                {@const row = rows.row(
                                    item.key,
                                    evt,
                                    status(evt, args, failed),
                                    ctx,
                                )}
                                {@const content = msg.content}
                                {@const confirmed = args.isConfirmed($unconfirmedStore, evt)}
                                {@const offered = offeredFor(chat, evt, failed, confirmed)}
                                {@const actions = offered.actions}
                                {@const offers = rowOffers(evt, failed, offered)}
                                {@const swipeLeft = offers.swipeLeft}
                                <!-- a text message's text as the old UI renders it: markdown, mentions,
                                     links, custom emoji (a lone emoji is the bubble's own, large) -->
                                {#snippet body()}
                                    {#if content.kind === "text_content"}
                                        <Markdown
                                            text={content.text}
                                            inline={!msg.blockLevelMarkdown}
                                        />
                                    {/if}
                                {/snippet}
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="row"
                                    class:starts={item.first}
                                    ondblclick={(e) => doubleClick(e, evt, failed, offered)}
                                    data-index={failed ? "" : msg.messageIndex}
                                    data-id={failed ? "" : msg.messageId}
                                    use:observeRead={{
                                        observer: args.messageObserver,
                                        read: args.isReadByMe($messagesRead, evt),
                                    }}
                                >
                                    {#if firstUnread === msg.messageIndex && msg.sender !== me}
                                        <div class="unread"><UnreadDivider /></div>
                                    {/if}
                                    <MessageGroup
                                        side={row.side}
                                        senderName={row.senderName}
                                        color={row.color}
                                        showAvatar={item.first}
                                        showName={item.first &&
                                            row.side === "received" &&
                                            chat.kind !== "direct_chat"}
                                        avatarSpace
                                        endsRun={item.last}
                                        onSenderClick={(el) =>
                                            el.dispatchEvent(profileClickedEvent(msg.sender))}
                                        marked={(args.focusIndex === msg.messageIndex && !failed) ||
                                        menu?.evt.event.messageId === msg.messageId ||
                                        composingId === msg.messageId
                                            ? 0
                                            : -1}
                                        activeMenu={menu !== undefined &&
                                        menu.evt.event.messageId === msg.messageId
                                            ? 0
                                            : -1}
                                        recentReactions={$quickReactions}
                                        onMessageMenu={offered.menu
                                            ? (_, pos) =>
                                                  openMenu(chat, evt, failed, confirmed, pos, false)
                                            : undefined}
                                        onReact={offered.react
                                            ? (_, emoji) => react(evt, emoji)
                                            : undefined}
                                        onReactPicker={offered.react && offered.menu
                                            ? (_, pos) =>
                                                  openMenu(chat, evt, failed, confirmed, pos, true)
                                            : undefined}
                                        onReply={actions.has("reply")
                                            ? () => run("reply", evt, failed)
                                            : undefined}
                                        onEdit={actions.has("edit")
                                            ? () => run("edit", evt, failed)
                                            : undefined}
                                        onSwipeLeft={swipeLeft === undefined
                                            ? undefined
                                            : () => run(swipeLeft, evt, failed)}
                                        messages={messagesFor(
                                            row,
                                            body,
                                            content.kind === "text_content" &&
                                                withMarkdown(content.text),
                                            evt,
                                            offers,
                                        )}
                                    />
                                    {#if row.message.kind === "prize" && row.message.canClaim}
                                        <HumanCheckFrame
                                            check={humanCheckFor(msg.messageId)}
                                            customData={prizeClaimCustomData(me, msg.messageId)}
                                        />
                                    {/if}
                                </div>
                            {:else if evt.event.kind === "aggregate_common_events"}
                                {@const text = aggregateEventText(evt.event, eventCtx)}
                                {@const deleted = evt.event.messagesDeleted}
                                {#if text.joined !== undefined || text.deleted !== undefined || text.rolesChanged.length > 0}
                                    <!-- TODO(design): no event line in the design; the old UI's -->
                                    <div
                                        class="event"
                                        data-index={deleted.length > 0
                                            ? deleted.join(" ")
                                            : undefined}
                                        use:observeRead={{
                                            observer: args.messageObserver,
                                            read:
                                                deleted.length === 0 ||
                                                args.isReadByMe($messagesRead, evt),
                                        }}
                                    >
                                        {#if text.joined !== undefined}
                                            <p class="event-line">
                                                <Markdown
                                                    oneLine
                                                    suppressLinks
                                                    text={text.joined}
                                                />
                                            </p>
                                        {/if}
                                        {#if text.deleted !== undefined}
                                            <p class="event-line">
                                                <button
                                                    class="expand"
                                                    title={$_("expandDeletedMessages")}
                                                    onclick={() =>
                                                        client.expandDeletedMessages(
                                                            new Set(deleted),
                                                        )}
                                                >
                                                    {text.deleted}
                                                </button>
                                            </p>
                                        {/if}
                                        {#each text.rolesChanged as line}
                                            <p class="event-line">
                                                <Markdown suppressLinks text={line} />
                                            </p>
                                        {/each}
                                    </div>
                                {/if}
                            {:else if isTextEvent(evt.event)}
                                {@const text = timelineEventText(evt.event, eventCtx)}
                                {#if text !== undefined}
                                    <div class="event">
                                        <p class="event-line">
                                            <Markdown suppressLinks {text} />
                                        </p>
                                    </div>
                                {/if}
                            {/if}
                        {/if}
                    {/snippet}
                    {#snippet fabs({ showGoToBottom, scrollToLast })}
                        {#if showGoToBottom}
                            <div class="to-bottom">
                                <IconButton
                                    icon="arrow-down"
                                    label={$_("goToLatestMessage")}
                                    onClick={scrollToLast}
                                />
                            </div>
                        {/if}
                    {/snippet}
                </ChatEventList>
            </div>
        {/if}

        <!-- one composer per chat: it starts from that chat's draft -->
        {#key chatIdentifierToString(chat.id)}
            <Composer
                {block}
                preview={preview === undefined
                    ? undefined
                    : {
                          ...preview.props,
                          busy: isJoining(preview.bar.target),
                          onJoin: () => joinPreviewed(preview.bar),
                          // the bar shows Back whenever there's an onBack
                          onBack: preview.props.showBack
                              ? () => leavePreview(preview.bar.target)
                              : undefined,
                      }}
                draft={$selectedChatDraftMessageStore?.textContent ?? ""}
                {typingNames}
                {throttled}
                enterSends={$enterSend}
                autofocus={focusEntryOnOpen($screenWidth, isTouchOnlyDevice)}
                onDraft={(text) =>
                    localUpdates.draftMessages.setTextContent({ chatId: chat.id }, text)}
                onStartTyping={() => client.startTyping(chat.id, me)}
                onStopTyping={() => client.stopTyping(chat.id, me)}
                onSend={(text) => send(chat, text)}
                context={composing}
                onCancelContext={() => cancelComposing(chat.id)}
                onSubmitEdit={(text) => submitEdit(chat.id, text)}
                onJumpContext={composingIndex === undefined
                    ? undefined
                    : () => jumpToComposing(chat.id, composingIndex)}
            />
        {/key}
    </div>
{/if}

{#if menu !== undefined}
    {@const pos = menu.pos}
    <MessageActions
        open
        items={messageItems}
        point={pos.point ?? null}
        anchor={pos.anchor ?? null}
        align={pos.align ?? "end"}
        focus={pos.touch ?? false}
        focusRect={pos.rect}
        focusEl={pos.el ?? null}
        focusFirst={pos.keyboard ?? false}
        reactions={menu.offered.react && !pos.fromBar}
        pickerOnly={menu.pickerOnly}
        recent={$quickReactions}
        selected={menuSelected}
        onReact={(emoji) => menu !== undefined && react(menu.evt, emoji)}
        onClose={() => (menu = undefined)} />
{/if}
{#if deleting !== undefined}
    <!-- TODO(design): no delete confirm in the design; the old one's words -->
    <ConfirmDialog
        title={$_("deleteMessageConfirm")}
        confirmLabel={$_("deleteMessage")}
        onConfirm={confirmDelete}
        onClose={() => (deleting = undefined)}>
        <Toggle
            label={$_("install.dontShow")}
            on={!$confirmMessageDeletion}
            onChange={(on) => confirmMessageDeletion.set(!on)} />
    </ConfirmDialog>
{/if}
{#if removingPreview !== undefined}
    <ConfirmDialog
        title={$_("removePreviewQuestion")}
        confirmLabel={$_("remove")}
        onConfirm={removePreview}
        onClose={() => (removingPreview = undefined)}
    />
{/if}
{#if swapping !== undefined}
    {@const content = swapping.content}
    {#if swapping.action === "accept"}
        {@const cost = swapAcceptCost(content.token1Amount, content.token1.fee)}
        {@const short = ($cryptoBalanceStore.get(content.token1.ledger) ?? 0n) < cost.total}
        {@const amount = client.formatTokens(cost.total, content.token1.decimals)}
        {@const fees = client.formatTokens(cost.fees, content.token1.decimals)}
        <ConfirmDialog
            title={$_("p2pSwap.accept")}
            message={short
                ? $_("p2pSwap.insufficientBalanceMessage", {
                      values: { amount, token: content.token1.symbol, fees },
                  })
                : $_("p2pSwap.confirmAccept", {
                      values: {
                          amount,
                          token: content.token1.symbol,
                          fees,
                          amountOther: client.formatTokens(
                              content.token0Amount,
                              content.token0.decimals,
                          ),
                          tokenOther: content.token0.symbol,
                      },
                  })}
            confirmLabel={$_("p2pSwap.accept")}
            disabled={short}
            onConfirm={settleSwap}
            onClose={() => (swapping = undefined)}
        />
    {:else}
        <ConfirmDialog
            title={$_("p2pSwap.cancelOfferQuestion")}
            message={$_("p2pSwap.confirmCancel", {
                values: {
                    amount: client.formatTokens(content.token0Amount, content.token0.decimals),
                    token: content.token0.symbol,
                },
            })}
            confirmLabel={$_("p2pSwap.cancelOffer")}
            cancelLabel={$_("p2pSwap.keepOffer")}
            onConfirm={settleSwap}
            onClose={() => (swapping = undefined)}
        />
    {/if}
{/if}
{#if viewing !== undefined}
    <MediaViewer content={viewing} onClose={() => (viewing = undefined)} />
{/if}

<style lang="scss">
    .conversation {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .state {
        flex: 1;
        display: grid;
        place-items: center;
        height: 100%;
    }

    .messages {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    :global(.vcl-viewport.conversation-list) {
        flex: auto;
        padding: 0 var(--space-24);
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        scrollbar-width: thin;
    }

    /* a message continuing its sender's run sits close under the one before it; a new run, a
       date or an event line stands apart */
    .row {
        padding-block-start: var(--space-6);
    }

    .row.starts,
    .event,
    .date {
        padding-block-start: var(--space-16);
    }

    /* the old UI's markdown, inside the bubble's own text: no outer spacing */
    .row :global(.markdown-wrapper > p:first-child),
    .row :global(.markdown-wrapper > ul:first-child),
    .row :global(.markdown-wrapper > ol:first-child) {
        margin-block-start: 0;
    }

    .row :global(.markdown-wrapper > :last-child) {
        margin-block-end: 0;
    }

    .unread {
        padding-block-end: var(--space-12);
    }

    .event-line {
        margin: 0;
        text-align: center;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    /* the deleted messages' line, which shows them */
    .expand {
        all: unset;
        cursor: pointer;
    }

    .expand:hover {
        text-decoration: underline;
    }

    .to-bottom {
        position: absolute;
        inset-block-end: var(--space-16);
        inset-inline-end: var(--space-24);
    }
</style>
