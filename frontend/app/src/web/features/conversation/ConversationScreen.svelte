<!-- The middle column's conversation (region "conversation", phase 3b): the selected chat's header
     and its messages, read only (the composer is 3c). The list is the old UI's (ChatEventList: paging,
     deep links, marking read, keeping the scroll), one row per event, each message in a MessageGroup
     of its own that keeps its place in the sender's run (DATA.md, Conversation). -->
<script lang="ts">
    import { showInRightColumn } from "../app/rightPanel";
    import {
        allUsersStore,
        selectedServerChatStore,
        webhookUserIdsStore,
        anonUserStore,
        audioRecordingMimeType,
        blockedUsersStore,
        botState,
        bridgedUsersStore,
        byContext as typersByContext,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatsInitialisedStore,
        chatListScopeStore,
        chitStateStore,
        communitiesStore,
        communityPreviewOriginStore,
        cryptoBalanceStore,
        currentUserStore,
        cryptoLookup,
        currentUserIdStore,
        eventsStore,
        exchangeRatesLookupStore,
        externalWalletPayment,
        failedMessagesStore,
        favouritesStore,
        i18nKey,
        isDiamondStore,
        isLifetimeDiamondStore,
        isPreviewingOrLapsed,
        isPrivateCommunityPreview,
        localUpdates,
        MAX_MENTION_CANDIDATES_SHOWN,
        mentionCandidates,
        messageContextsEqual,
        maxMediaSizes,
        messageIndexStore,
        messagePermissionsForSelectedChatStore,
        messagesRead,
        prizeClaimCustomData,
        publish,
        screenWidth,
        selectedChatBlockedUsersStore,
        selectedChatMembersStore,
        selectedChatDraftMessageStore,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatPinnedMessagesStore,
        selectedChatWebhooksStore,
        selectedChatSummaryStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        suspendedUserStore,
        swapAcceptCost,
        swapActions,
        swapFailureMessage,
        swapOfferStep,
        threadOpenStore,
        throttleDeadline,
        TimelineGrouper,
        translationsStore,
        unconfirmedReadByThem,
        unconfirmedStore,
        undeletingMessagesStore,
        videoProcessingProgress,
        type AttachmentContent,
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
    import type {
        ComposerAttachKind,
        ComposerAttachment,
        GroupMessage,
    } from "@openchat/ui/src/lib/types";
    import {
        attachmentToSend,
        attachRefusal,
        canAttachNow,
        canRecordVoice,
        composerBuilders,
        draftAttachment,
        editStartText,
        entryBlock,
        entryNotice,
        entryPlaceholder,
        focusEntryOnOpen,
        MemberFinder,
        pickableAttachments,
        throttleCountdown,
        type ComposerBuilder,
    } from "@src/logic/composer/composer";
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";
    import {
        confirmMessageDeletion,
        dclickReply,
        enterSend,
        lowBandwidth,
    } from "@src/stores/settings";
    import { messageToForwardStore } from "@src/stores/messageToForward";
    import { quickReactions } from "@src/stores/quickReactions";
    import { composerBuildersOff, disableTipsFeature } from "@src/utils/features";
    import {
        composerPrize,
        composerSwapOffer,
        composerTransfer,
        type Translate,
    } from "../builders/builders.adapter";
    import { messageSwipeLeft } from "@src/utils/messageSwipe";
    import { messageDoubleClickAction } from "@src/logic/conversation/messageDoubleClick";
    import { getProxyAdjustedBlobUrl, microphoneDenied, saveFile } from "@src/utils/media";
    import { now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { detectMarkdown } from "@src/utils/detectMarkdown";
    import { isTouchOnlyDevice } from "@src/utils/devices";
    import { buildDisplayName } from "@src/utils/user";
    import {
        aggregateEventText,
        isTextEvent,
        timelineEventText,
        type EventTextContext,
    } from "@src/logic/conversation/timelineEventText";
    import { getContext, onMount, untrack, type ComponentProps, type Snippet } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import { chatMenuState, runChatMenuItem } from "./chatMenu";
    import Composer from "./Composer.svelte";
    import {
        composerAttachment,
        composerContext,
        composerMention,
        composerStartText,
        headerMenuItems,
        messageMenuItems,
    } from "./conversation.adapter";
    import {
        conversationContext,
        isMedia,
        mediaHeld,
        messageStatus,
        readByThem,
        senderColor,
        untilNextDay,
        withFields,
        type ConversationContext,
        type MediaContent,
        type MessageRow,
    } from "@src/logic/conversation/messageRow";
    import {
        quoteFor,
        quoteTarget,
        retryFor,
        textAsMarkdown,
        withHandlers,
        type MessageHandlers,
        type QuoteTarget,
    } from "@src/logic/conversation/messageHandlers";
    import { messageOffer } from "@src/logic/conversation/messageOffer";
    import { toggleReaction } from "@src/logic/conversation/reaction";
    import { observeRead } from "@src/core/observeRead";
    import { votePoll } from "@src/logic/conversation/pollVote";
    import {
        FirstUnread,
        firstUnreadOnOpen,
        MessageLink,
        othersTyping,
    } from "@src/logic/conversation/timeline";
    import MediaViewer from "@src/core/MediaViewer.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";
    import { deleteMessage, runMessageAction } from "./messageMenu";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { claimsStore } from "@src/stores/claims";
    import HumanCheckFrame from "@src/core/HumanCheckFrame.svelte";
    import { HumanChecks } from "@src/logic/prize/humanCheck.svelte";
    import { claimPrizeWithHumanCheck } from "@src/logic/prize/prizeClaim";
    import { interpolate } from "@i18n/i18n";
    import { VoicePlayer } from "@src/logic/conversation/voicePlayer.svelte";
    import { RowCache } from "@src/logic/conversation/rowCache";
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
        return conversationContext({
            client,
            chat,
            me,
            formatter: $_,
            users: $allUsersStore,
            webhooks: $selectedChatWebhooksStore,
            webhookIds: $webhookUserIdsStore,
            detailsLoaded: $selectedServerChatStore !== undefined,
            lowBandwidth: $lowBandwidth,
            revealed: (messageId) => revealed.has(messageId),
            claimant,
            tokens: $cryptoLookup,
            rates: () => exchangeRatesLookupStore.value,
        });
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
            origin: $communityPreviewOriginStore,
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
            : othersTyping($typersByContext.get({ chatId: chat.id }), me, (userId) =>
                  client.displayName($allUsersStore.get(userId)),
              ),
    );

    // too many messages a minute: a countdown until sending resumes (the old ThrottleCountdown);
    // the clock only ticks once there's a deadline
    const countdown = $derived(
        $throttleDeadline > 0 ? throttleCountdown($throttleDeadline, $now500) : undefined,
    );

    // the message being replied to or edited, above the composer's text (the chat's draft, which
    // the reply and the edit set); an edit starts from the message's text, with its mentions as
    // they were typed
    const draft = $derived($selectedChatDraftMessageStore);
    const composing = $derived(
        composerContext(
            draft,
            ctx,
            draft?.editingEvent === undefined
                ? undefined
                : editStartText(
                      draft.editingEvent.event.content,
                      $allUsersStore,
                      $selectedCommunityUserGroupsStore,
                  ),
        ),
    );

    // over the composer, the most pressing first: the throttle countdown, a video picked here
    // being prepared
    const notice = $derived.by(() => {
        const progress = $videoProcessingProgress;
        const shown = entryNotice({
            throttledSeconds: countdown?.seconds,
            videoProgress:
                chat !== undefined &&
                progress !== undefined &&
                messageContextsEqual(progress.context, { chatId: chat.id })
                    ? progress.progress
                    : undefined,
        });
        switch (shown?.kind) {
            case undefined:
                return undefined;
            case "throttled":
                return {
                    text: $_("throttleMessage", { values: { time: shown.seconds } }),
                    tone: "warning" as const,
                };
            case "video_processing":
                return {
                    text: $_("videoProcessingPercent", { values: { percent: shown.percent } }),
                    tone: "info" as const,
                };
        }
    });

    // the draft's photo, video or file, or a builder's payment (5d), staged above the text (only
    // what the composer shows is sent with it: a puzzle result isn't yet)
    // (none during an edit, when the draft holds the edited message's own content)
    const staged = $derived(
        composerAttachment(draftAttachment(draft), ctx) ?? stagedPayment(draftAttachment(draft)),
    );

    // a transfer, prize or swap offer as the composer's chip shows it, in tokens the registry
    // carries
    function stagedPayment(content: AttachmentContent | undefined): ComposerAttachment | null {
        const t: Translate = (key, values) => $_(key, { values });
        switch (content?.kind) {
            case "crypto_content": {
                const transfer = content.transfer;
                const token =
                    transfer.kind === "pending" ? $cryptoLookup.get(transfer.ledger) : undefined;
                if (transfer.kind !== "pending" || token === undefined) return null;
                return (
                    composerTransfer(
                        content,
                        token,
                        $exchangeRatesLookupStore.get(transfer.ledger)?.toUSD,
                        $allUsersStore.get(transfer.recipient),
                        t,
                    ) ?? null
                );
            }
            case "prize_content_initial": {
                const token = $cryptoLookup.get(content.transfer.ledger);
                return token === undefined ? null : (composerPrize(content, token, t) ?? null);
            }
            case "p2p_swap_content_initial": {
                const give = $cryptoLookup.get(content.token0.ledger);
                const get = $cryptoLookup.get(content.token1.ledger);
                if (give === undefined || get === undefined) return null;
                const prices = {
                    give: $exchangeRatesLookupStore.get(give.ledger)?.toUSD,
                    get: $exchangeRatesLookupStore.get(get.ledger)?.toUSD,
                };
                return composerSwapOffer(content, give, get, prices, t);
            }
            default:
                return null;
        }
    }

    // a direct chat with a bot takes text only (its direct-message command)
    const directBot = $derived(chat !== undefined && client.directChatWithBot(chat) !== undefined);

    // nothing is attached during an edit, or while a voice message is recorded or reviewed
    let voiceActive = $state(false);
    const attachable = $derived(
        !directBot &&
            canAttachNow({ editing: draft?.editingEvent !== undefined, voiceActive }),
    );

    // what the + menu offers (following the reader's permissions here): to pick from the device and
    // the builders, all while something can be attached (`canAttachNow`), the ones that send (a
    // poll, a meme) too: one sent mid-edit would reply to the edited message's reply
    const attachKinds = $derived.by((): ComposerAttachKind[] => {
        if (!attachable) return [];
        const permitted = $messagePermissionsForSelectedChatStore;
        return [
            ...pickableAttachments(permitted),
            ...composerBuilders(permitted, composerBuildersOff),
        ];
    });

    // a builder picked from the + menu opens its dialog
    function build(chatId: ChatIdentifier, builder: ComposerBuilder) {
        switch (builder) {
            case "poll":
                screen.dialogs.open({ kind: "poll_builder", chatId });
                break;
            case "prize":
                screen.dialogs.open({ kind: "prize_builder", chatId });
                break;
            case "swap":
                // only a Diamond member makes an offer: anyone else gets the Diamond dialog
                if (swapOfferStep($isDiamondStore, true) === "upgrade") {
                    publish("upgrade");
                } else {
                    screen.dialogs.open({ kind: "swap_offer", chatId });
                }
                break;
            case "memeFighter":
                screen.dialogs.open({ kind: "meme_fighter", chatId });
                break;
            case "crypto":
                // to the one being replied to, unless the user picks someone else
                screen.dialogs.open({
                    kind: "send_crypto",
                    chatId,
                    defaultReceiver: draft?.replyingTo?.sender?.userId,
                });
                break;
        }
    }

    // the chip's Edit opens the staged payment's builder again, to change it
    function editStaged(chatId: ChatIdentifier) {
        const content = draftAttachment(draft);
        switch (content?.kind) {
            case "crypto_content":
                screen.dialogs.open({ kind: "send_crypto", chatId, editing: content });
                break;
            case "prize_content_initial":
                screen.dialogs.open({ kind: "prize_builder", chatId, editing: content });
                break;
            case "p2p_swap_content_initial":
                screen.dialogs.open({ kind: "swap_offer", chatId, editing: content });
                break;
        }
    }

    // (the composer says "Add a caption" itself while there's an attachment)
    const placeholder = $derived(
        interpolate($_, entryPlaceholder({ canEnterText: true, attached: false, directBot })),
    );

    // a voice message is recorded in a format every device plays (no mic where the browser can't),
    // and stops at the size limit; no mic once the reader has turned the microphone down
    const voiceMimeType =
        typeof MediaRecorder === "undefined" ? undefined : audioRecordingMimeType();
    let micDenied = $state(false);
    onMount(async () => {
        micDenied = await microphoneDenied();
    });
    const canRecord = $derived(
        canRecordVoice({
            audioPermitted: $messagePermissionsForSelectedChatStore.has("audio"),
            recorderMimeType: voiceMimeType,
            micDenied,
            directBot,
        }),
    );
    // a Diamond member's voice messages may be longer
    const voiceMaxBytes = $derived(maxMediaSizes($isDiamondStore).audio);

    // sent as a reply to the draft's reply, if any; refused, the take stays to send again
    async function sendVoice(chatId: ChatIdentifier, recording: Blob, mimeType: string) {
        const outcome = await client.sendVoiceMessage(
            { chatId },
            await recording.arrayBuffer(),
            mimeType,
        );
        if (outcome.kind !== "posted") throw new Error(outcome.kind);
    }

    // the @mention picker: for the "@word" being typed, who in this chat can be mentioned (never
    // the reader; @everyone first), and, in a chat that holds only some of its members, those it
    // doesn't hold who match once two characters are typed
    let mentionQuery = $state<string | undefined>(undefined);
    const memberFinder = new MemberFinder((prefix) => client.findMembersToMention(prefix));
    $effect(() => () => memberFinder.cancel());

    function mentionQueried(query: string | undefined) {
        mentionQuery = query;
        memberFinder.typed(query);
    }

    const mentions = $derived.by(() => {
        if (mentionQuery === undefined || chat === undefined) return [];
        // what the lookup reads through `.value`: it changes as members not held are found
        void [$selectedChatMembersStore, $selectedCommunityMembersStore, $allUsersStore];
        return mentionCandidates(Object.values(client.getUserLookupForMentions()), mentionQuery, {
            me,
            mentionSelf: false,
            supportsUserGroups: true,
            usersOnly: false,
            keepUserOrder: false,
        })
            .slice(0, MAX_MENTION_CANDIDATES_SHOWN)
            .map((candidate) => composerMention(candidate, (user) => client.userAvatarUrl(user)));
    });

    // a file picked, pasted or dropped goes to the chat it was picked in, if it may be sent there
    async function attachFile(chatId: ChatIdentifier, file: File) {
        const outcome = await client.attachFile(file, { chatId });
        if (outcome.kind !== "attached") {
            toastStore.showFailureToast(attachRefusal(outcome, $_));
        }
    }

    // a file dragged over the conversation is attached when it's dropped (the old DropTarget),
    // where the composer takes files
    let dragging = $state(false);
    const droppable = $derived(chat !== undefined && block === undefined && attachable);

    // a file held over the conversation is never left to the browser, which would open it in
    // place of the app (as the old DropTarget): where nothing can be attached, it's refused
    function dragOver(e: DragEvent) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        if (droppable) {
            dragging = true;
        } else {
            e.dataTransfer.dropEffect = "none";
        }
    }

    function drop(chatId: ChatIdentifier, e: DragEvent) {
        dragging = false;
        if (e.dataTransfer === null || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        if (!droppable) return;
        const file = fileFromDataTransferItems([...e.dataTransfer.items]);
        if (file !== undefined) void attachFile(chatId, file);
    }

    // cancelling an edit puts back what was being written before it; a reply just goes
    function cancelComposing(chatId: ChatIdentifier) {
        if (draft?.editingEvent !== undefined) {
            localUpdates.draftMessages.endEditing({ chatId });
        } else {
            localUpdates.draftMessages.setReplyingTo({ chatId }, undefined);
        }
    }

    // the client puts the draft back as the edit goes out, and undoes the edit if it fails
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
        const taken = attachmentToSend(draftAttachment(draft), staged !== null);
        if (taken.kind === "payment_not_shown") throw new Error(taken.kind);
        const attachment = taken.attachment;
        // a payment from an external wallet would need that wallet's approval first, which this
        // tree doesn't ask for (its builders pay from the OpenChat wallet): never send it without,
        // which would take the funds from the OpenChat wallet instead (GAPS.md)
        if (externalWalletPayment(attachment) !== undefined) throw new Error("external_wallet");
        // the client mentions those typed as @username; the text captions an attachment
        const outcome = await client.sendMessage(
            context,
            text === "" ? undefined : text,
            detectMarkdown(text),
            attachment,
        );
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
    const firstUnreadMarker = new FirstUnread();
    const firstUnread = $derived.by(() => {
        const current = chat;
        if (current === undefined) return undefined;
        return firstUnreadMarker.of(current.id, () =>
            untrack(() =>
                firstUnreadOnOpen(current, (chatId, latest) =>
                    messagesRead.getFirstUnreadMessageIndex(chatId, latest),
                ),
            ),
        );
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
    const messageLink = new MessageLink();
    $effect(() => {
        void $threadOpenStore;
        const idx = $messageIndexStore;
        const chatId = $selectedChatIdStore;
        // until the list is there (the chat loading, a private preview), the link waits for it
        const current = list;
        if (current === undefined) return;
        const to = messageLink.next(chatId, idx, $chatsInitialisedStore);
        if (chatId !== undefined && to !== undefined) {
            untrack(() => current.scrollToMessageIndex({ chatId }, to, false));
        }
    });

    function status(evt: EventWrapper<Message>, args: ChatEventListArgs, failed: boolean) {
        return messageStatus({
            failed,
            accepted: args.isAccepted($unconfirmedStore, evt),
            readByThem:
                chat !== undefined && readByThem(client, chat, evt.event, $unconfirmedReadByThem),
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
        // kept between renders, so composed without reading a voice message's live fields
        // (withFields): a spread would freeze its playback
        const quoted =
            chat === undefined
                ? undefined
                : quoteTarget(evt.event, chat.id, $chatListScopeStore.kind);
        const messages = [
            withFields(message, {
                ...previewRemoval(evt),
                ...retryFor(row.message, offers.retry),
                ...quoteFor(row.message, quoted, goToQuote),
                menu: offers.menu,
                swipeLeft: offers.swipeLeft,
            }),
        ];
        groupMessages.set(row, { offers: key, messages });
        return messages;
    }

    // ── message actions ──

    // a reply's quote, clicked: its message in this chat, marked (loaded first if it's outside
    // what's loaded), or the chat or thread it's quoted from
    function goToQuote(target: QuoteTarget) {
        if (target.kind === "elsewhere") {
            navigate(target.url);
        } else if (chat !== undefined) {
            void list?.scrollToMessageIndex({ chatId: chat.id }, target.messageIndex, false);
        }
    }

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
        return messageOffer(client, current, evt, {
            me,
            bridgedUsers: $bridgedUsersStore,
            failed,
            confirmed,
            readonly,
            pinned: $selectedChatPinnedMessagesStore,
            translated: $translationsStore,
            undeleting: $undeletingMessagesStore,
            blocked: $selectedChatBlockedUsersStore,
            tipsEnabled: !disableTipsFeature,
        });
    }

    function rowOffers(
        chatId: ChatIdentifier,
        evt: EventWrapper<Message>,
        failed: boolean,
        offered: MessageMenu,
    ): RowOffers {
        return {
            menu: offered.menu,
            swipeLeft: messageSwipeLeft(evt.event.sender === me, offered.actions),
            retry: offered.actions.has("retry") ? () => run(chatId, "retry", evt, failed) : undefined,
        };
    }

    // the message whose menu (or emoji picker) is open, and its chat: what's picked acts there,
    // and the menu closes when another chat opens
    let menu = $state<{
        chatId: ChatIdentifier;
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
        menu = { chatId: current.id, evt, failed, offered, pos, pickerOnly };
    }

    $effect.pre(() => {
        void chatKey;
        untrack(() => (menu = undefined));
    });

    // the open menu's items, in the app's words
    const messageItems = $derived.by(() => {
        if (menu === undefined) return [];
        const { chatId, evt, failed } = menu;
        return messageMenuItems(menu.offered.actions).map((item) =>
            item.action === "separator"
                ? { label: "", variant: "separator" as const }
                : {
                      label: $_(item.label),
                      variant: item.variant,
                      mask: item.mask,
                      onSelect: () => run(chatId, item.action, evt, failed),
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

    // the message being deleted, once confirmed, and its chat (another may be open by then)
    let deleting = $state<{ chatId: ChatIdentifier; evt: EventWrapper<Message> }>();

    // an action on a message, in the chat it's in
    async function run(
        chatId: ChatIdentifier,
        action: MessageMenuAction,
        evt: EventWrapper<Message>,
        failed: boolean,
    ) {
        const dialog = await runMessageAction(action, {
            client,
            chatId,
            evt,
            failed,
            me,
            users: $allUsersStore,
            formatter: $_,
            locale: $locale,
            diamond: $isDiamondStore,
            confirmDelete: $confirmMessageDeletion,
        });
        if (dialog?.kind === "delete") deleting = { chatId, evt: dialog.evt };
        if (dialog?.kind === "forward") {
            screen.dialogs.open({ kind: "forward", message: dialog.evt.event });
        }
        if (dialog?.kind === "report") {
            screen.dialogs.open({
                kind: "report_message",
                chatId,
                messageId: dialog.evt.event.messageId,
                canDelete: client.canDeleteOtherUsersMessages(chatId),
            });
        }
        if (dialog?.kind === "remind") {
            screen.dialogs.open({
                kind: "remind_message",
                chatId,
                eventIndex: dialog.evt.index,
            });
        }
    }

    // a message forwarded here (ForwardDialogScreen) goes out as the chat opens, as in the old
    // trees, so the client can ask for its rules first
    $effect(() => {
        const current = chat;
        void chatKey;
        if (current === undefined) return;
        untrack(() => {
            const forwarding = $messageToForwardStore;
            if (forwarding === undefined) return;
            messageToForwardStore.set(undefined);
            client.forwardMessage({ chatId: current.id }, forwarding);
        });
    });

    function confirmDelete() {
        const confirmed = deleting;
        deleting = undefined;
        if (confirmed === undefined) return;
        void deleteMessage(client, confirmed.chatId, confirmed.evt);
    }

    // a reaction added or taken off (toggleReaction counts it towards the quick ones)
    function react(chatId: ChatIdentifier, evt: EventWrapper<Message>, emoji: string) {
        void toggleReaction(client, chatId, evt.event, emoji);
    }

    // double-click to edit your own message or reply to someone else's (the "double-click to reply"
    // setting), not on the hover bar or a control in the message
    function doubleClick(
        chatId: ChatIdentifier,
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
        if (action !== undefined) void run(chatId, action, evt, failed);
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

    // a rich kind's controls (withHandlers), and a voice message's playing state (read as it
    // renders, so playing doesn't redo the row)
    const handlers: MessageHandlers = {
        openMedia,
        openUrl: (url) => window.open(url, "_blank", "noopener"),
        swap: startSwap,
        claim,
        claiming: (messageId) => $claimsStore.has(messageId),
        vote,
        download,
        get voice() {
            return voice;
        },
    };

    function withActions(row: MessageRow, msg: Message): GroupMessage {
        return withHandlers(row, msg, handlers, $cryptoLookup);
    }

    // a file is saved under its own name (saveFile)
    function download(content: FileContent) {
        const url = getProxyAdjustedBlobUrl(content.blobUrl);
        if (url !== undefined) void saveFile(url, content.name);
    }

    // a poll vote, if the poll can take one (votePoll); the vote shows at once, as in the old trees
    async function vote(msg: Message, content: PollContent, next: number[]) {
        if (chat === undefined) return;
        if ((await votePoll(client, chat, me, msg, content, next)) === "failed") {
            toastStore.showFailureToast(i18nKey("poll.voteFailed"));
        }
    }

    // each prize's human check, which a claim click starts (HumanCheckFrame, under its card)
    const humanChecks = new HumanChecks();
    function humanCheckFor(messageId: bigint) {
        return humanChecks.for(messageId);
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

    function isMessage(evt: EventWrapper<ChatEvent>): evt is EventWrapper<Message> {
        return evt.event.kind === "message";
    }
</script>

{#if chat === undefined}
    <div class="state"><Spinner /></div>
{:else}
    <!-- svelte-ignore a11y_no_static_element_interactions (a file dropped anywhere on it) -->
    <div
        class="conversation"
        ondragover={dragOver}
        ondragleave={(e) => {
            // leaving the conversation, not moving between its parts
            const to = e.relatedTarget;
            if (!(to instanceof Node && e.currentTarget.contains(to))) dragging = false;
        }}
        ondrop={(e) => drop(chat.id, e)}>
        {#if dragging}
            <!-- TODO(design): no drop state in the design; the old DropTarget's words -->
            <div class="drop" aria-hidden="true">{$_("dropFile")}</div>
        {/if}
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
                                {@const offers = rowOffers(chat.id, evt, failed, offered)}
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
                                    ondblclick={(e) => doubleClick(chat.id, e, evt, failed, offered)}
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
                                            ? (_, emoji) => react(chat.id, evt, emoji)
                                            : undefined}
                                        onReactPicker={offered.react && offered.menu
                                            ? (_, pos) =>
                                                  openMenu(chat, evt, failed, confirmed, pos, true)
                                            : undefined}
                                        onReply={actions.has("reply")
                                            ? () => run(chat.id, "reply", evt, failed)
                                            : undefined}
                                        onEdit={actions.has("edit")
                                            ? () => run(chat.id, "edit", evt, failed)
                                            : undefined}
                                        onSwipeLeft={swipeLeft === undefined
                                            ? undefined
                                            : () => run(chat.id, swipeLeft, evt, failed)}
                                        messages={messagesFor(
                                            row,
                                            body,
                                            content.kind === "text_content" &&
                                                textAsMarkdown(content.text),
                                            evt,
                                            offers,
                                        )}
                                    />
                                    <!-- kept while a claim's check runs, even if the prize runs out meanwhile -->
                                    {#if row.message.kind === "prize" && (row.message.canClaim || humanChecks.running(msg.messageId))}
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
                draft={composerStartText($selectedChatDraftMessageStore)}
                {typingNames}
                {notice}
                {placeholder}
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
                attachment={staged}
                {attachKinds}
                onFile={attachable ? (file) => attachFile(chat.id, file) : undefined}
                onBuild={(builder) => build(chat.id, builder)}
                onEditAttachment={() => editStaged(chat.id)}
                onRemoveAttachment={() =>
                    localUpdates.draftMessages.setAttachment({ chatId: chat.id }, undefined)}
                onVoice={canRecord && voiceMimeType !== undefined
                    ? (recording) => sendVoice(chat.id, recording, voiceMimeType)
                    : undefined}
                {voiceMimeType}
                {voiceMaxBytes}
                onMentionQuery={mentionQueried}
                onVoiceActive={(active) => (voiceActive = active)}
                {mentions}
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
        onReact={(emoji) => menu !== undefined && react(menu.chatId, menu.evt, emoji)}
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
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // a file held over the conversation
    .drop {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: grid;
        place-items: center;
        pointer-events: none;
        background: var(--scrim);
        border: 2px dashed var(--accent);
        border-radius: var(--radius-lg);
        font: var(--weight-semibold) var(--text-lg) / 1.4 var(--font-sans);
        color: var(--ink);
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
