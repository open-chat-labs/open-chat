<!-- A chat's messages and its composer, or a thread's (4c): the conversation and the thread panel
     both show their messages through this, so a thread's replies are listed, acted on and written
     as the conversation's are. The list is the old UI's (ChatEventList: paging, deep links, marking
     read, keeping the scroll), one row per event, each message in a MessageGroup of its own that
     keeps its place in the sender's run (DATA.md, Conversation). `thread` is the open thread's
     root, or none for the chat itself; the host lays out the list and the composer (`frame`)
     with whatever goes round them (a header, the thread panel), over a drop target for files. -->
<script lang="ts">
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
        chatListScopeStore,
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
        i18nKey,
        isDiamondStore,
        isLifetimeDiamondStore,
        isPreviewingOrLapsed,
        isPrivateCommunityPreview,
        localUpdates,
        messageContextsEqual,
        messageReadByThem,
        maxMediaSizes,
        messageIndexStore,
        messagePermissionsForSelectedChatStore,
        messagesRead,
        publish,
        screenWidth,
        selectedChatBlockedUsersStore,
        selectedChatMembersStore,
        selectedChatRecipientStore,
        selectedChatDraftMessageStore,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatPinnedMessagesStore,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        selectedThreadDraftMessageStore,
        suspendedUserStore,
        swapAcceptCost,
        swapActions,
        ownGroupAvatarUrl,
        ownUserAvatarUrl,
        swapFailureMessage,
        swapOfferStep,
        threadEventsStore,
        threadOpenStore,
        threadPermissionsForSelectedChatStore,
        threadsFollowedByMeStore,
        throttleDeadline,
        TimelineGrouper,
        toLongDatetimeString,
        translationsStore,
        unconfirmedReadByThem,
        unconfirmedStore,
        undeletingMessagesStore,
        videoProcessingProgress,
        type AttachmentContent,
        type ChatEvent,
        type ChatSummary,
        type EventWrapper,
        type FileContent,
        type Message,
        type MessageContext,
        type MessageMenu,
        type MessageMenuAction,
        type OpenChat,
        type P2PSwapContent,
        type PollContent,
    } from "@client";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import MessageActions from "@openchat/ui/src/lib/components/MessageActions.svelte";
    import MessageGroup from "@openchat/ui/src/lib/components/MessageGroup.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import TypingIndicator from "@openchat/ui/src/lib/components/TypingIndicator.svelte";
    import UnreadDivider from "@openchat/ui/src/lib/components/UnreadDivider.svelte";
    import ChatEventList, { type ChatEventListArgs } from "@src/core/ChatEventList.svelte";
    import { TimelineFlattener, type FlatChatItem } from "@src/core/flatChatItems";
    import Markdown from "@src/core/Markdown.svelte";
    import { groupAvatarLookups } from "@src/logic/chats/chatRow";
    import type {
        ComposerAttachKind,
        ComposerAttachment,
        GroupMessage,
    } from "@openchat/ui/src/lib/types";
    import {
        attachRefusal,
        canAttachNow,
        canRecordVoice,
        chatEntryState,
        composerBuilders,
        draftAttachment,
        editStartText,
        entryBlock,
        entryNotice,
        entryNoticeText,
        entryPermitted,
        entryPlaceholder,
        focusEntryOnOpen,
        MemberFinder,
        mentionsFor,
        pickableAttachments,
        composerAnswer,
        sendComposed,
        sendVoiceRecording,
        throttleCountdown,
        type ComposerBuilder,
        type EntryPermissions,
    } from "@src/logic/composer/composer";
    import {
        composerAttachment,
        composerContext,
        composerMention,
        composerStartText,
    } from "@src/logic/composer/composerProps";
    import {
        cancelComposing,
        composingMessageIndex,
        submitEdit,
    } from "@src/logic/conversation/draftActions";
    import {
        followsThread,
        rowMessageContext,
        threadEventReadByMe,
        threadReplyEvents,
    } from "@src/logic/conversation/threadTimeline";
    import { openThreadInColumn } from "../app/rightPanel";
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
    import { webMessageSwipeLeft } from "@src/utils/messageSwipe";
    import { messageDoubleClickAction } from "@src/logic/conversation/messageDoubleClick";
    import { getProxyAdjustedBlobUrl, microphoneDenied, saveFile } from "@src/utils/media";
    import { now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { isTouchOnlyDevice } from "@src/utils/devices";
    import { buildDisplayName } from "@src/utils/user";
    import {
        aggregateEventText,
        isTextEvent,
        timelineEventText,
        type EventTextContext,
    } from "@src/logic/conversation/timelineEventText";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount, untrack, type ComponentProps, type Snippet } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { ScreenContext } from "../app/screens";
    import Composer from "./Composer.svelte";
    import { messageMenuItems } from "./conversation.adapter";
    import {
        conversationContext,
        isMedia,
        mediaHeld,
        messageStatus,
        senderColor,
        showsSenderName,
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
    import {
        canRemovePreviews,
        previewLink,
        removeLinkPreview,
    } from "@src/logic/conversation/linkPreview";
    import { guestMessageAction, messageOffer } from "@src/logic/conversation/messageOffer";
    import { toggleReaction } from "@src/logic/conversation/reaction";
    import { askToSignIn, signInFirst } from "@src/logic/auth/guestPass";
    import { observeRead } from "@src/core/observeRead";
    import { stickyDateTop } from "@src/core/stickyDateTop";
    import { votePoll } from "@src/logic/conversation/pollVote";
    import {
        FirstUnread,
        firstUnreadOnOpen,
        MessageLink,
        othersTyping,
        typingPlacement,
    } from "@src/logic/conversation/timeline";
    import MediaViewer from "@src/core/MediaViewer.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";
    import { deleteMessage, runMessageAction } from "./messageMenu";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { claimsStore } from "@src/stores/claims";
    import { claimPrizeFromClick } from "@src/logic/prize/prizeClaim";
    import { interpolate } from "@i18n/i18n";
    import { VoicePlayer } from "@src/logic/conversation/voicePlayer.svelte";
    import { RowCache } from "@src/logic/conversation/rowCache";
    import { profileClickedEvent } from "@src/web-components/profileLink";
    import { isJoining, type JoinTarget } from "@src/logic/join/joinFlow.svelte";
    import { previewBar, type PreviewBar } from "@src/logic/join/previewBar";
    import { join } from "../join/join";
    import { previewBarProps } from "../join/previewBar.adapter";
    import { bottomAnchorFor } from "../../shell/bottomAnchors.svelte";

    type Props = {
        /** The chat (the selected one). */
        chat: ChatSummary;
        /** The open thread's root message: the thread's replies and composer. None for the chat. */
        thread: EventWrapper<Message> | undefined;
        /** The app's dialogs and right column. */
        screen: ScreenContext;
        /** Lays out the list and the composer, with whatever goes round them. */
        frame: Snippet<[list: Snippet, composer: Snippet]>;
    };

    let { chat, thread, screen, frame }: Props = $props();

    const client = getContext<OpenChat>("client");

    const me = $derived($currentUserIdStore);

    // where the messages are: the chat itself, or the thread in it
    const rootIndex = $derived(thread?.event.messageIndex);
    const context = $derived<MessageContext>(
        rootIndex === undefined
            ? { chatId: chat.id }
            : { chatId: chat.id, threadRootMessageIndex: rootIndex },
    );
    // where a row's message is, which its actions go to: in a thread, the root is the chat's
    function rowContext(evt: EventWrapper<Message>): MessageContext {
        return rowMessageContext(chat.id, thread?.event, evt.event);
    }
    const contextKey = $derived(
        `${chatIdentifierToString(chat.id)}${rootIndex === undefined ? "" : `/${rootIndex}`}`,
    );
    // a thread's replies don't show as unread unless the reader follows it (4c invariant 2)
    const following = $derived(
        thread !== undefined && followsThread(thread.event, $threadsFollowedByMeStore.get(chat.id)),
    );

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
        previewingOrLapsed: isPreviewingOrLapsed(chat, $communitiesStore),
        diamond: $isDiamondStore,
        lifetimeDiamond: $isLifetimeDiamondStore,
        streak: $chitStateStore.streak,
        chitEarned: $chitStateStore.totalChitEarned,
        accountCreated: Number($currentUserStore.dateCreated),
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
        // a thread's unread replies ("· N new" on its link) follow what's read
        void $messagesRead;
        // the thread open beside the chat (the route's), its link on the accent; rows key on it
        // (RowCache), so opening another redoes only the two it concerns
        const openThread = thread === undefined && $threadOpenStore ? $messageIndexStore : undefined;
        return conversationContext({
            client,
            chat,
            me,
            openThread,
            formatter: $_,
            users: $allUsersStore,
            userGroups: $selectedCommunityUserGroupsStore,
            webhooks: $selectedChatWebhooksStore,
            webhookIds: $webhookUserIdsStore,
            detailsLoaded: $selectedServerChatStore !== undefined,
            lowBandwidth: $lowBandwidth,
            revealed: (messageId) => revealed.has(messageId),
            claimant,
            tokens: $cryptoLookup,
            rates: () => exchangeRatesLookupStore.value,
            face: (userId) => AVATAR_GRADIENTS[senderColor(userId)],
            threads: true,
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

    const level = $derived(chat.kind === "channel" ? "channel" : "group");
    const eventCtx = $derived.by((): EventTextContext => {
        const users = $allUsersStore;
        return {
            formatter: $_,
            me,
            users,
            displayName: (userId, kind) => buildDisplayName(users, userId, kind),
            level,
            canInvite: client.canInviteUsers(chat.id),
            botName: (botId) => botState.externalBots.get(botId)?.name,
        };
    });

    // ── the composer ──

    // what the reader may send here: a thread has its own permissions
    const permissions = $derived<EntryPermissions>({
        message: $messagePermissionsForSelectedChatStore,
        thread: $threadPermissionsForSelectedChatStore,
    });
    const permitted = $derived(entryPermitted(permissions, thread !== undefined));

    // read only: suspended, or previewing the chat
    const readonly = $derived(client.isChatReadOnly(chat.id));
    // a thread's composer isn't there at all where the chat is read only, as in the old trees
    const composerShown = $derived(thread === undefined || !readonly);

    // why the reader can't send here; a thread's "can't send" says it's the thread that's read
    // only (entryBlock)
    const block = $derived(
        entryBlock(
            chatEntryState(client, chat, thread !== undefined, {
                suspended: $suspendedUserStore,
                anonymous: $anonUserStore,
                blockedUsers: $blockedUsersStore,
                community: $selectedCommunitySummaryStore,
                recipient: $selectedChatRecipientStore,
                permissions,
            }),
        ),
    );

    // a preview's bar in place of the composer (8b): the community's while the community is
    // previewed, else the group's or channel's (logic/join/previewBar)
    const preview = $derived.by(() => {
        if (block?.kind !== "preview" || chat.kind === "direct_chat") {
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
        // its own picture, else its swatch (as everywhere in the new web UI, 2026-11-10)
        const avatarUrl =
            bar.community !== undefined
                ? bar.community.avatar.blobUrl
                : ownGroupAvatarUrl(chat, groupAvatarLookups(client, community));
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

    // the others in this chat or thread who are typing: a bubble at the end of a DM's messages, a
    // strip resting on the composer in a group, a channel or a thread (native plan 04's rule)
    const typingNames = $derived(
        othersTyping($typersByContext.get(context), me, (userId) =>
            client.displayName($allUsersStore.get(userId)),
        ),
    );
    // a DM's bubble goes only after the latest message: at the end of a stretch of history loaded
    // from further back it'd be out of place, so who's typing shows on the strip until the latest
    // are loaded (the items are read so it follows them loading)
    const newerMessagesToLoad = $derived.by(() => {
        void items;
        return client.moreNewMessagesAvailable(chat.id, thread);
    });
    const typingAt = $derived(typingPlacement(chat.kind, rootIndex, newerMessagesToLoad));
    // a DM's bubble is the other person's, with their face as their messages have it (web 05,
    // "Typing": avatar and three dots)
    const typingBubble = $derived.by(() => {
        if (typingAt !== "bubble" || typingNames.length === 0 || chat.kind !== "direct_chat") {
            return undefined;
        }
        const them = chat.them.userId;
        return { avatarUrl: ctx.avatar(them), color: senderColor(them) };
    });

    // too many messages a minute: a countdown until sending resumes (the old ThrottleCountdown);
    // the clock only ticks once there's a deadline
    const countdown = $derived(
        $throttleDeadline > 0 ? throttleCountdown($throttleDeadline, $now500) : undefined,
    );

    // the message being replied to or edited, above the composer's text (the draft, which the
    // reply and the edit set); an edit starts from the message's text, with its mentions as they
    // were typed
    const draft = $derived(
        thread === undefined ? $selectedChatDraftMessageStore : $selectedThreadDraftMessageStore,
    );
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
                progress !== undefined && messageContextsEqual(progress.context, context)
                    ? progress.progress
                    : undefined,
        });
        if (shown === undefined) return undefined;
        const words = entryNoticeText(shown);
        return { text: interpolate($_, words.key), tone: words.tone };
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
    const directBot = $derived(thread === undefined && client.directChatWithBot(chat) !== undefined);

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
        return [...pickableAttachments(permitted), ...composerBuilders(permitted, composerBuildersOff)];
    });

    // a builder picked from the + menu opens its dialog, for this chat or thread
    function build(context: MessageContext, builder: ComposerBuilder) {
        switch (builder) {
            case "poll":
                screen.dialogs.open({ kind: "poll_builder", context });
                break;
            case "prize":
                screen.dialogs.open({ kind: "prize_builder", context });
                break;
            case "swap":
                // only a Diamond member makes an offer: anyone else gets the Diamond dialog
                if (swapOfferStep($isDiamondStore, true) === "upgrade") {
                    publish("upgrade");
                } else {
                    screen.dialogs.open({ kind: "swap_offer", context });
                }
                break;
            case "memeFighter":
                screen.dialogs.open({ kind: "meme_fighter", context });
                break;
            case "crypto":
                // to the one being replied to, unless the user picks someone else
                screen.dialogs.open({
                    kind: "send_crypto",
                    context,
                    defaultReceiver: draft?.replyingTo?.sender?.userId,
                });
                break;
        }
    }

    // the chip's Edit opens the staged payment's builder again, to change it
    function editStaged(context: MessageContext) {
        const content = draftAttachment(draft);
        switch (content?.kind) {
            case "crypto_content":
                screen.dialogs.open({ kind: "send_crypto", context, editing: content });
                break;
            case "prize_content_initial":
                screen.dialogs.open({ kind: "prize_builder", context, editing: content });
                break;
            case "p2p_swap_content_initial":
                screen.dialogs.open({ kind: "swap_offer", context, editing: content });
                break;
        }
    }

    // (the composer says "Add a caption" itself while there's an attachment); a thread's says who
    // it replies to, as the design's thread panel does
    const rootAuthor = $derived(
        thread === undefined ? undefined : ctx.userName(thread.event.sender).split(" ")[0],
    );
    const placeholder = $derived(
        rootAuthor !== undefined
            ? $_("ui.threadPanel.replyTo", { values: { name: rootAuthor } })
            : interpolate($_, entryPlaceholder({ canEnterText: true, attached: false, directBot })),
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
            audioPermitted: permitted.has("audio"),
            recorderMimeType: voiceMimeType,
            micDenied,
            directBot,
        }),
    );
    // a Diamond member's voice messages may be longer
    const voiceMaxBytes = $derived(maxMediaSizes($isDiamondStore).audio);

    // sent as a reply to the draft's reply, if any; refused, the take stays to send again (quietly
    // when the rules were turned down)
    async function sendVoice(
        context: MessageContext,
        recording: Blob,
        mimeType: string,
    ): Promise<false | undefined> {
        return composerAnswer(await sendVoiceRecording(client, context, recording, mimeType));
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
        if (mentionQuery === undefined) return [];
        // what the lookup reads through `.value`: it changes as members not held are found
        void [$selectedChatMembersStore, $selectedCommunityMembersStore, $allUsersStore];
        return mentionsFor(client, mentionQuery, me).map((candidate) =>
            composerMention(candidate, ownUserAvatarUrl),
        );
    });

    // a file picked, pasted or dropped goes to the chat or thread it was picked in, if it may be
    // sent there
    async function attachFile(context: MessageContext, file: File) {
        const outcome = await client.attachFile(file, context);
        if (outcome.kind !== "attached") {
            toastStore.showFailureToast(attachRefusal(outcome, $_));
        }
    }

    // a file dragged over the messages is attached when it's dropped (the old DropTarget), where
    // the composer takes files
    let dragging = $state(false);
    const droppable = $derived(composerShown && block === undefined && attachable);

    // a file held over the messages is never left to the browser, which would open it in place of
    // the app (as the old DropTarget): where nothing can be attached, it's refused
    function dragOver(e: DragEvent) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        if (droppable) {
            dragging = true;
        } else {
            e.dataTransfer.dropEffect = "none";
        }
    }

    function drop(context: MessageContext, e: DragEvent) {
        dragging = false;
        if (e.dataTransfer === null || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        if (!droppable) return;
        const file = fileFromDataTransferItems([...e.dataTransfer.items]);
        if (file !== undefined) void attachFile(context, file);
    }

    // the client puts the draft back as the edit goes out, and undoes the edit if it fails
    async function saveEdit(context: MessageContext, text: string) {
        if (!(await submitEdit(client, context, draft, text))) {
            toastStore.showFailureToast(i18nKey("errorEditingMessage"));
        }
    }

    // the message replied to or edited, if it's here (a private reply quotes another chat's)
    const composingIndex = $derived(composingMessageIndex(draft, context));

    function jumpToComposing(context: MessageContext, index: number) {
        list?.scrollToMessageIndex(context, index, false);
    }

    // done once the message shows here; the rules or the PIN turned down, the composer keeps the
    // draft quietly (false); refused (throttled, a send already on its way, a bot that takes no
    // direct messages), it rejects and the composer keeps the draft and says so (logic/composer's
    // sendComposed, which a thread sends to the thread with)
    async function send(context: MessageContext, text: string): Promise<false | undefined> {
        return composerAnswer(
            await sendComposed(client, chat, context, text, {
                content: draftAttachment(draft),
                shown: staged !== null,
            }),
        );
    }

    // ── what can be shown ──

    // a private chat or community that isn't joined shows no messages (as the old UI)
    const privatePreview = $derived(
        thread === undefined &&
            (isPrivateCommunityPreview($selectedCommunitySummaryStore) ||
                client.maskChatMessages(chat)),
    );
    const levelText = $derived($_(`level.${level}`).toLowerCase());

    // ── the timeline ──

    // one grouper per list, so a cosmetic update doesn't regroup (memoised)
    const grouper = new TimelineGrouper();
    const flattener = new TimelineFlattener();
    // a thread's: its replies alone, under the panel's card of its root (4c invariant 3)
    const events = $derived(
        thread === undefined ? $eventsStore : threadReplyEvents(thread, $threadEventsStore),
    );
    const items = $derived.by((): FlatChatItem[] => {
        const timeline = grouper.group(
            events,
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
    // the last one's. A thread has none, as in the old trees
    const firstUnreadMarker = new FirstUnread();
    const firstUnread = $derived.by(() => {
        if (thread !== undefined) return undefined;
        const current = chat;
        return firstUnreadMarker.of(current.id, () =>
            untrack(() =>
                firstUnreadOnOpen(current, (chatId, latest) =>
                    messagesRead.getFirstUnreadMessageIndex(chatId, latest),
                ),
            ),
        );
    });

    // Go to the route's message (a deep link), as the old list does: when it changes, and when the
    // chat does. A thread's own deep link (`/:tmi`) is loaded by the client as it opens
    let list: ChatEventList | undefined = $state();
    let initialised = $state(false);

    // A new chat's list starts uninitialised, as the old UI's did, unless the chat has nothing to
    // load
    let initialisedFor: string | undefined;
    $effect.pre(() => {
        const key = contextKey;
        if (key === initialisedFor) return;
        initialisedFor = key;
        initialised = untrack(() => thread === undefined && chat.latestEventIndex <= 0);
    });
    const messageLink = new MessageLink();
    $effect(() => {
        if (thread !== undefined) return;
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

    // the conversation goes to a message the right column asks for (the thread's "Jump to
    // message"), once
    $effect(() => {
        if (thread !== undefined) return;
        const jump = screen.jumps.wanted;
        const current = list;
        if (jump === undefined || current === undefined) return;
        if (!chatIdentifiersEqual(jump.chatId, chat.id)) return;
        untrack(() => {
            screen.jumps.done(jump);
            current.scrollToMessageIndex({ chatId: jump.chatId }, jump.messageIndex, false);
        });
    });

    // a thread's list shows a spinner until its replies start to come in, as the old one did
    const loading = $derived(
        thread !== undefined &&
            !initialised &&
            $threadEventsStore.length === 0 &&
            thread.event.thread !== undefined,
    );

    function status(evt: EventWrapper<Message>, args: ChatEventListArgs, failed: boolean) {
        return messageStatus({
            failed,
            accepted: args.isAccepted($unconfirmedStore, evt),
            readByThem: messageReadByThem(chat, evt.event, $unconfirmedReadByThem),
        });
    }

    // whether the reader has read an event: in a thread, its root and the replies of a thread
    // they don't follow always count as read (4c invariant 2)
    function readByMe(evt: EventWrapper<ChatEvent>, args: ChatEventListArgs): boolean {
        const read = args.isReadByMe($messagesRead, evt);
        return thread === undefined
            ? read
            : threadEventReadByMe(evt, thread.event.messageId, following, read);
    }

    // rows kept per event (RowCache), and their messages with them, so user and other chat
    // updates don't redo every bubble; started again for a new chat or thread, wording or day
    const rows = new RowCache();
    const groupMessages = new WeakMap<MessageRow, { offers: string; messages: GroupMessage[] }>();
    // bumped when a revealed image needs its row redone
    let rowsVersion = $state(0);
    $effect.pre(() => {
        void contextKey;
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

    // the day of the messages at the top of the list, pinned there while it scrolls through that
    // day (the list says which: VirtualChatList's sticky date), as web/05 asks and the old lists
    // do. Where it sits is core/stickyDateTop's, as native's. The list hands the day back to its
    // own pill while that pill's row starts less than 32px above where it's told the pinned one
    // is; a day's pill sits 16px into its row (.date), so it's told 16px lower, and the two swap
    // just as the day's own pill reaches the pinned one's place. That pill, scrolled on up under
    // the pinned one, is hidden, so a date never shows twice
    const STICKY_HANDOFF_OFFSET = 16;
    let stickyTop = $state<number>();
    let stickyDate = $state<bigint>();

    // the chat's first mention of the reader they haven't read, which the list goes to, as the old
    // CurrentChat works it out: again as messages are read, so it goes once that one is. None in
    // a thread or where the chat is read only, as in the old trees
    const firstUnreadMention = $derived.by(() => {
        if (thread !== undefined || readonly) return undefined;
        void $messagesRead;
        return client.getFirstUnreadMention(chat);
    });

    function messagesFor(
        row: MessageRow,
        body: Snippet,
        withBody: boolean,
        evt: EventWrapper<Message>,
        offers: RowOffers,
    ): GroupMessage[] {
        const key = `${offers.menu}|${offers.retry !== undefined}`;
        const kept = groupMessages.get(row);
        if (kept?.offers === key) return kept.messages;
        const where = rowContext(evt);
        const message = withBody
            ? ({ ...row.message, body } as GroupMessage)
            : withActions(where, row, evt.event);
        // kept between renders, so composed without reading a voice message's live fields
        // (withFields): a spread would freeze its playback
        const quoted = quoteTarget(evt.event, chat.id, $chatListScopeStore.kind, rootIndex);
        const messages = [
            withFields(message, {
                ...previewRemoval(where, evt),
                ...retryFor(row.message, offers.retry),
                ...threadLink(evt),
                ...quoteFor(row.message, quoted, goToQuote),
                menu: offers.menu,
            }),
        ];
        groupMessages.set(row, { offers: key, messages });
        return messages;
    }

    // a message's "N replies" opens its thread in the right column (shown even if it was closed),
    // keeping the list of threads open; inside a thread its root shows none (the old trees'
    // `canReplyInThread`)
    function threadLink(evt: EventWrapper<Message>): Partial<GroupMessage> {
        if (thread !== undefined) return { threadCount: 0 };
        const index = evt.event.messageIndex;
        return {
            onOpenThread: () =>
                openThreadInColumn(screen.rightColumn, $chatListScopeStore.kind, chat.id, index),
        };
    }

    // ── message actions ──

    // a reply's quote, clicked: its message in this chat or thread, marked (loaded first if it's
    // outside what's loaded), or the chat or thread it's quoted from
    function goToQuote(target: QuoteTarget) {
        if (target.kind === "elsewhere") {
            navigate(target.url);
        } else {
            void list?.scrollToMessageIndex(context, target.messageIndex, false);
        }
    }

    type MenuPos = Parameters<NonNullable<ComponentProps<typeof MessageGroup>["onMessageMenu"]>>[1];

    // what a row's message offers that's part of how it shows (its menu, Retry)
    type RowOffers = {
        menu: boolean;
        retry: (() => void) | undefined;
    };

    // what a message offers (messageMenu, as the old trees decide it): read as it renders, so a
    // row follows the chat's permissions and the message's state. In a thread, its root can't be
    // edited or replied to there, and nothing is pinned
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
            guest: $anonUserStore,
            pinned: $selectedChatPinnedMessagesStore,
            translated: $translationsStore,
            undeleting: $undeletingMessagesStore,
            blocked: $selectedChatBlockedUsersStore,
            tipsEnabled: !disableTipsFeature,
            thread: thread === undefined ? undefined : { root: thread.event, following },
        });
    }

    function rowOffers(
        context: MessageContext,
        evt: EventWrapper<Message>,
        failed: boolean,
        offered: MessageMenu,
    ): RowOffers {
        return {
            menu: offered.menu,
            retry: offered.actions.has("retry") ? () => run(context, "retry", evt, failed) : undefined,
        };
    }

    // the message whose menu (or emoji picker) is open, and where it is: what's picked acts there,
    // and the menu closes when another chat or thread opens
    let menu = $state<{
        context: MessageContext;
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
        // a guest's reaction asks them to sign in, before they pick one
        if (pickerOnly && signInFirst(client)) return;
        menu = { context: rowContext(evt), evt, failed, offered, pos, pickerOnly };
    }

    $effect.pre(() => {
        void contextKey;
        untrack(() => (menu = undefined));
    });

    // the open menu's items, in the app's words
    const messageItems = $derived.by(() => {
        if (menu === undefined) return [];
        const { context, evt, failed } = menu;
        return messageMenuItems(menu.offered.actions).map((item) =>
            item.action === "separator"
                ? { label: "", variant: "separator" as const }
                : {
                      label: $_(item.label),
                      variant: item.variant,
                      mask: item.mask,
                      onSelect: () => run(context, item.action, evt, failed),
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

    // the message being deleted, once confirmed, and where it is (another chat may be open by then)
    let deleting = $state<{ context: MessageContext; evt: EventWrapper<Message> }>();

    // an action on a message, where it is
    // a guest is asked to sign in for what needs an account, and stays here (guestMessageAction)
    async function run(
        context: MessageContext,
        action: MessageMenuAction,
        evt: EventWrapper<Message>,
        failed: boolean,
    ) {
        if ($anonUserStore && guestMessageAction(action) === "sign_in") {
            askToSignIn(client);
            return;
        }
        const { chatId, threadRootMessageIndex } = context;
        const dialog = await runMessageAction(action, {
            client,
            context,
            threadRoot: thread?.event,
            openThread: (index) =>
                openThreadInColumn(screen.rightColumn, $chatListScopeStore.kind, chat.id, index),
            evt,
            failed,
            me,
            users: $allUsersStore,
            formatter: $_,
            locale: $locale,
            diamond: $isDiamondStore,
            confirmDelete: $confirmMessageDeletion,
        });
        if (dialog?.kind === "delete") deleting = { context, evt: dialog.evt };
        if (dialog?.kind === "forward") {
            screen.dialogs.open({ kind: "forward", message: dialog.evt.event });
        }
        if (dialog?.kind === "report") {
            screen.dialogs.open({
                kind: "report_message",
                chatId,
                messageId: dialog.evt.event.messageId,
                threadRootMessageIndex,
                canDelete: client.canDeleteOtherUsersMessages(chatId),
            });
        }
        if (dialog?.kind === "remind") {
            screen.dialogs.open({
                kind: "remind_message",
                chatId,
                eventIndex: dialog.evt.index,
                threadRootMessageIndex,
            });
        }
    }

    // a message forwarded here (ForwardDialogScreen) goes out as the chat opens, as in the old
    // trees, so the client can ask for its rules first
    $effect(() => {
        if (thread !== undefined) return;
        const current = chat;
        void contextKey;
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
        void deleteMessage(client, confirmed.context, confirmed.evt);
    }

    // a reaction added or taken off (toggleReaction counts it towards the quick ones); a guest
    // (a chip, the hover bar's or the menu's) is asked to sign in
    function react(context: MessageContext, evt: EventWrapper<Message>, emoji: string) {
        if (signInFirst(client)) return;
        void toggleReaction(client, context, evt.event, emoji);
    }

    // double-click to edit your own message or reply to someone else's (the "double-click to reply"
    // setting), not on the hover bar or a control in the message
    function doubleClick(
        context: MessageContext,
        e: MouseEvent,
        evt: EventWrapper<Message>,
        failed: boolean,
        offered: MessageMenu,
    ) {
        const target = e.target;
        // a guest's double-click is theirs (selecting a word), not a reply that asks to sign in
        if ($anonUserStore) return;
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
        if (action !== undefined) void run(context, action, evt, failed);
    }

    // the message replied to or edited, tinted in the list
    const composingId = $derived(
        draft?.editingEvent?.event.messageId ?? draft?.replyingTo?.messageId,
    );

    // ── link previews ──

    // the sender can remove a preview from their own text message, once they've confirmed it, as
    // in the old trees
    let removingPreview = $state<{
        context: MessageContext;
        evt: EventWrapper<Message>;
        url: string;
    }>();

    function previewRemoval(where: MessageContext, evt: EventWrapper<Message>) {
        const msg = evt.event;
        if (!canRemovePreviews(msg, me)) return {};
        return {
            onRemovePreview: (index: number) => {
                const url = previewLink(msg, index);
                if (url !== undefined) removingPreview = { context: where, evt, url };
            },
        };
    }

    async function removePreview() {
        const removing = removingPreview;
        removingPreview = undefined;
        if (removing === undefined) return;
        const failure = await removeLinkPreview(
            client,
            removing.context,
            removing.evt,
            removing.url,
        );
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    // a rich kind's controls (withHandlers), acting where its message is (a swap's accept or
    // cancel, a poll vote), and a voice message's playing state (read as it renders, so playing
    // doesn't redo the row)
    function withActions(where: MessageContext, row: MessageRow, msg: Message): GroupMessage {
        const handlers: MessageHandlers = {
            openMedia,
            openUrl: (url) => window.open(url, "_blank", "noopener"),
            swap: (m, content, action) => startSwap(where, m, content, action),
            claim,
            claiming: (messageId) => $claimsStore.has(messageId),
            vote: (m, content, next) => vote(where, m, content, next),
            download,
            get voice() {
                return voice;
            },
        };
        return withHandlers(row, msg, handlers, $cryptoLookup);
    }

    // a file is saved under its own name (saveFile)
    function download(content: FileContent) {
        const url = getProxyAdjustedBlobUrl(content.blobUrl);
        if (url !== undefined) void saveFile(url, content.name);
    }

    // a poll vote, if the poll can take one (votePoll), where the poll is; the vote shows at once,
    // as in the old trees
    async function vote(
        context: MessageContext,
        msg: Message,
        content: PollContent,
        next: number[],
    ) {
        const rootIndex = context.threadRootMessageIndex;
        if ((await votePoll(client, chat, me, msg, content, next, rootIndex)) === "failed") {
            toastStore.showFailureToast(i18nKey("poll.voteFailed"));
        }
    }

    // a prize claim, from the reader's own click (claimPrize refuses any other)
    async function claim(msg: Message, e: MouseEvent) {
        if (chat.kind === "direct_chat") return;
        const failure = await claimPrizeFromClick(client, chat.id, msg.messageId, e);
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    // accepting someone's swap offer (Diamond only: anyone else is offered the upgrade, as in the
    // old trees) or cancelling your own, once confirmed; only while it's open (swapActions). The
    // accept pays from the OpenChat wallet; the client asks for the PIN
    let swapping = $state<{
        context: MessageContext;
        msg: Message;
        content: P2PSwapContent;
        action: "accept" | "cancel";
    }>();

    function startSwap(
        context: MessageContext,
        msg: Message,
        content: P2PSwapContent,
        action: "accept" | "cancel",
    ) {
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
        swapping = { context, msg, content, action };
    }

    async function settleSwap() {
        const swap = swapping;
        swapping = undefined;
        if (swap === undefined) return;
        const { context, msg, content, action } = swap;
        const resp =
            action === "accept"
                ? await client.acceptP2PSwap(
                      context.chatId,
                      context.threadRootMessageIndex,
                      msg.messageId,
                      content.token1,
                      content.token1Amount,
                  )
                : await client.cancelP2PSwap(
                      context.chatId,
                      context.threadRootMessageIndex,
                      msg.messageId,
                  );
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

    // one voice message plays at a time, and none once the chat or thread is left
    const voice = new VoicePlayer();
    $effect(() => {
        void contextKey;
        return () => voice.stop();
    });

    function isMessage(evt: EventWrapper<ChatEvent>): evt is EventWrapper<Message> {
        return evt.event.kind === "message";
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (a file dropped anywhere on it) -->
<div
    class="area"
    ondragover={dragOver}
    ondragleave={(e) => {
        // leaving the area, not moving between its parts
        const to = e.relatedTarget;
        if (!(to instanceof Node && e.currentTarget.contains(to))) dragging = false;
    }}
    ondrop={(e) => drop(context, e)}>
    {#if dragging}
        <!-- TODO(design): no drop state in the design; the old DropTarget's words -->
        <div class="drop" aria-hidden="true">{$_("dropFile")}</div>
    {/if}
    {@render frame(messageList, messageComposer)}
</div>

{#snippet messageList()}
    {#if privatePreview}
        <div class="state">
            <EmptyState
                preset="no-conversations"
                title={$_("group.privateGroup", { values: { level: levelText } })}
                body={$_("group.privateGroupInfo", { values: { level: levelText } })}
                actionLabel=""
            />
        </div>
    {:else if loading}
        <div class="state"><Spinner /></div>
    {:else}
        <div class="messages">
            <!-- web/05: the date of the messages at the top stays pinned there, in the inline
                 dates' pill -->
            <div
                class="sticky-date"
                use:stickyDateTop={(top) => (stickyTop = top + STICKY_HANDOFF_OFFSET)}
            >
                {#if stickyDate !== undefined}
                    <UnreadDivider tone="neutral" label={dateLabel(stickyDate)} />
                {/if}
            </div>
            <ChatEventList
                bind:this={list}
                rootSelector={thread === undefined ? "conversation" : "thread"}
                {chat}
                threadRootEvent={thread}
                {items}
                {readonly}
                maintainScroll={thread === undefined}
                visible
                bind:initialised
                stickyDateElTop={stickyTop}
                bind:stickyDateTimestamp={stickyDate}
                viewportClass="message-list"
            >
                {#snippet row(item, args)}
                    {@render eventRow(item, args)}
                {/snippet}
                <!-- the last thing in the list, after the newest message, as a received run of
                     its own: it comes into view at the bottom and stays out of view below when
                     scrolled up (the list keeps the reading position as it comes and goes) -->
                {#snippet footer()}
                    {#if typingBubble !== undefined}
                        <div class="typing-bubble">
                            <TypingIndicator
                                variant="bubble"
                                names={typingNames}
                                showAvatar
                                avatarUrl={typingBubble.avatarUrl}
                                avatarColor={typingBubble.color} />
                        </div>
                    {/if}
                {/snippet}
                {#snippet fabs({ showGoToBottom, scrollToLast, scrollToMention })}
                    <!-- TODO(design): no go-to-mention button in the design or web/05; the old
                         lists', as go-to-latest -->
                    <div class="fabs">
                        {#if firstUnreadMention !== undefined}
                            <IconButton
                                icon="at"
                                label={$_("goToFirstMention")}
                                onClick={() => scrollToMention(firstUnreadMention)}
                            />
                        {/if}
                        {#if showGoToBottom}
                            <IconButton
                                icon="arrow-down"
                                label={$_("goToLatestMessage")}
                                onClick={scrollToLast}
                            />
                        {/if}
                    </div>
                {/snippet}
            </ChatEventList>
        </div>
    {/if}
{/snippet}

{#snippet eventRow(item: FlatChatItem, args: ChatEventListArgs)}
    {#if item.kind === "timeline_date"}
        <!-- the day pinned at the top is this one's: this one, scrolled up under it, isn't
             shown too -->
        <div class="date" class:pinned={stickyDate === item.timestamp}>
            <UnreadDivider tone="neutral" label={dateLabel(item.timestamp)} />
        </div>
    {:else if item.kind === "event"}
        {@const evt = item.event}
        {#if isMessage(evt)}
            {@const msg = evt.event}
            {@const failed = args.isFailed($failedMessagesStore, evt)}
            {@const row = rows.row(item.key, evt, status(evt, args, failed), ctx)}
            {@const content = msg.content}
            {@const confirmed = args.isConfirmed($unconfirmedStore, evt)}
            {@const offered = offeredFor(chat, evt, failed, confirmed)}
            {@const actions = offered.actions}
            {@const where = rowContext(evt)}
            {@const offers = rowOffers(where, evt, failed, offered)}
            {@const swipeLeft = webMessageSwipeLeft(actions)}
            <!-- a text message's text as the old UI renders it: markdown, mentions, links, custom
                 emoji (a lone emoji is the bubble's own, large) -->
            {#snippet body()}
                {#if content.kind === "text_content"}
                    <Markdown text={content.text} inline={!msg.blockLevelMarkdown} />
                {/if}
            {/snippet}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="row"
                class:starts={item.first}
                ondblclick={(e) => doubleClick(where, e, evt, failed, offered)}
                data-index={failed ? "" : msg.messageIndex}
                data-id={failed ? "" : msg.messageId}
                use:observeRead={{
                    observer: args.messageObserver,
                    read: readByMe(evt, args),
                }}
            >
                {#if firstUnread === msg.messageIndex && msg.sender !== me}
                    <div class="unread"><UnreadDivider /></div>
                {/if}
                <MessageGroup
                    side={row.side}
                    senderName={row.senderName}
                    color={row.color}
                    avatarUrl={row.avatarUrl}
                    showAvatar={item.first}
                    showName={showsSenderName(item.first, chat.kind === "direct_chat")}
                    avatarSpace
                    endsRun={item.last}
                    onSenderClick={(el) => el.dispatchEvent(profileClickedEvent(msg.sender))}
                    marked={(args.focusIndex === msg.messageIndex && !failed) ||
                    menu?.evt.event.messageId === msg.messageId ||
                    composingId === msg.messageId
                        ? 0
                        : -1}
                    activeMenu={menu !== undefined && menu.evt.event.messageId === msg.messageId
                        ? 0
                        : -1}
                    recentReactions={$quickReactions}
                    onMessageMenu={offered.menu
                        ? (_, pos) => openMenu(chat, evt, failed, confirmed, pos, false)
                        : undefined}
                    onReact={offered.react ? (_, emoji) => react(where, evt, emoji) : undefined}
                    onReactPicker={offered.react && offered.menu
                        ? (_, pos) => openMenu(chat, evt, failed, confirmed, pos, true)
                        : undefined}
                    onReply={actions.has("reply")
                        ? () => run(where, "reply", evt, failed)
                        : undefined}
                    onEdit={actions.has("edit") ? () => run(where, "edit", evt, failed) : undefined}
                    onSwipeLeft={swipeLeft === undefined
                        ? undefined
                        : () => run(where, swipeLeft, evt, failed)}
                    messages={messagesFor(
                        row,
                        body,
                        content.kind === "text_content" && textAsMarkdown(content.text),
                        evt,
                        offers,
                    )}
                />
            </div>
        {:else if evt.event.kind === "aggregate_common_events"}
            {@const text = aggregateEventText(evt.event, eventCtx)}
            {@const deleted = evt.event.messagesDeleted}
            {#if text.joined !== undefined || text.deleted !== undefined || text.rolesChanged.length > 0}
                <!-- TODO(design): no event line in the design; the old UI's -->
                <div
                    class="event"
                    data-index={deleted.length > 0 ? deleted.join(" ") : undefined}
                    use:observeRead={{
                        observer: args.messageObserver,
                        read: deleted.length === 0 || readByMe(evt, args),
                    }}
                >
                    {#if text.joined !== undefined}
                        <p class="event-line">
                            <Markdown oneLine suppressLinks text={text.joined} />
                        </p>
                    {/if}
                    {#if text.deleted !== undefined}
                        <p class="event-line">
                            <button
                                class="expand"
                                title={$_("expandDeletedMessages")}
                                onclick={() => client.expandDeletedMessages(new Set(deleted))}
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
                <!-- TODO(design): no event line in the design or web/05; the old UI's, with its
                     date and time under it -->
                <div class="event">
                    <p class="event-line">
                        <Markdown suppressLinks {text} />
                    </p>
                    <p class="event-time">
                        {toLongDatetimeString(new Date(Number(evt.timestamp)), $locale ?? "en")}
                    </p>
                </div>
            {/if}
        {/if}
    {/if}
{/snippet}

{#snippet messageComposer()}
    {#if composerShown}
        <!-- the chat's own composer is what the toasts and the achievement toast play above
             (bottomAnchors); a thread's isn't -->
        <div class="composer" {@attach thread === undefined && bottomAnchorFor("composer")}>
            <!-- one composer per chat or thread: it starts from that one's draft -->
            {#key contextKey}
                <Composer
                    {block}
                    onSignIn={() => askToSignIn(client)}
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
                    draft={composerStartText(draft)}
                    typingNames={typingAt === "strip" ? typingNames : []}
                    {notice}
                    {placeholder}
                    enterSends={$enterSend}
                    autofocus={focusEntryOnOpen($screenWidth, isTouchOnlyDevice)}
                    onDraft={(text) => localUpdates.draftMessages.setTextContent(context, text)}
                    onStartTyping={() => client.startTyping(chat.id, me, rootIndex)}
                    onStopTyping={() => client.stopTyping(chat.id, me, rootIndex)}
                    onSend={(text) => send(context, text)}
                    context={composing}
                    onCancelContext={() => cancelComposing(context, draft)}
                    onSubmitEdit={(text) => saveEdit(context, text)}
                    onJumpContext={composingIndex === undefined
                        ? undefined
                        : () => jumpToComposing(context, composingIndex)}
                    attachment={staged}
                    {attachKinds}
                    onFile={attachable ? (file) => attachFile(context, file) : undefined}
                    onBuild={(builder) => build(context, builder)}
                    onEditAttachment={() => editStaged(context)}
                    onRemoveAttachment={() =>
                        localUpdates.draftMessages.setAttachment(context, undefined)}
                    onVoice={canRecord && voiceMimeType !== undefined
                        ? (recording) => sendVoice(context, recording, voiceMimeType)
                        : undefined}
                    {voiceMimeType}
                    {voiceMaxBytes}
                    onMentionQuery={mentionQueried}
                    onVoiceActive={(active) => (voiceActive = active)}
                    {mentions}
                />
            {/key}
        </div>
    {:else}
        <!-- a thread with no composer (a preview, a guest's included, or read only): the room
             under its last reply that the composer leaves above it (ComposerBar's padding) -->
        <div class="no-composer"></div>
    {/if}
{/snippet}

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
        onReact={(emoji) => menu !== undefined && react(menu.context, menu.evt, emoji)}
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
    .area {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // a file held over the messages
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
        min-height: 0;
    }

    .messages {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    // a DM's typing bubble (the library's, with the typer's avatar): a run of its own after the
    // newest message, standing apart from it as a new sender's run does (.row.starts)
    .typing-bubble {
        padding-block-start: var(--space-16);
    }

    .composer {
        flex: none;
    }

    .no-composer {
        flex: none;
        height: var(--space-12);
    }

    :global(.vcl-viewport.message-list) {
        flex: auto;
        padding: 0 var(--message-list-gutter, var(--space-24));
        overflow-x: hidden;
        overscroll-behavior-y: contain;
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

    .date.pinned {
        visibility: hidden;
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

    /* when it happened, smaller under it (the old UI's NonMessageEvent) */
    .event-time {
        margin: 0;
        text-align: center;
        font: var(--weight-regular) var(--text-xs) / 1.5 var(--font-sans);
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

    /* go to the first unread mention, over go to the latest message */
    .fabs {
        position: absolute;
        inset-block-end: var(--space-16);
        inset-inline-end: var(--message-list-gutter, var(--space-24));
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    /* the day of the messages at the top of the list, over them, where a day's own pill sits in
       its row (16px down); none while that pill is below it (the list hands over to it) */
    .sticky-date {
        position: absolute;
        z-index: 1;
        inset-block-start: var(--space-16);
        inset-inline: 0;
        padding-inline: var(--message-list-gutter, var(--space-24));
        pointer-events: none;
    }
</style>
