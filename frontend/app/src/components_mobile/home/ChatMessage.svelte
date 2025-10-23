<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { Avatar, Container, MenuTrigger } from "component-lib";
    import {
        type ChatIdentifier,
        chatListScopeStore,
        type ChatType,
        currentUserIdStore,
        currentUserStore,
        type EnhancedReplyContext,
        iconSize,
        localUpdates,
        type Message,
        type MessageReminderCreatedContent,
        OpenChat,
        pageReplace,
        publish,
        routeForMessage,
        screenWidth,
        ScreenWidth,
        selectedChatBlockedUsersStore,
        type SelectedEmoji,
        type SenderContext,
        translationsStore,
        unconfirmedReadByThem,
        undeletingMessagesStore,
        type UserSummary,
    } from "openchat-client";
    import { getContext, onDestroy, onMount, tick } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { quickReactions } from "../../stores/quickReactions";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { canShareMessage } from "../../utils/share";
    import { removeQueryStringParam } from "../../utils/urls";
    import BotProfile, { type BotProfileProps } from "../bots/BotProfile.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import ChatMessageMenu from "./ChatMessageMenu.svelte";
    import EmojiPicker from "./EmojiPickerWrapper.svelte";
    import IntersectionObserverComponent from "./IntersectionObserver.svelte";
    import MessageBubble from "./message/MessageBubble.svelte";
    import ReminderBuilder from "./ReminderBuilder.svelte";
    import ReportMessage from "./ReportMessage.svelte";
    // import ThreadSummary from "./ThreadSummary.svelte";
    import { dclickReply } from "@src/stores/settings";
    import Reactions from "./message/Reactions.svelte";
    import ThreadSummary from "./message/ThreadSummary.svelte";
    import Tips from "./message/Tips.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import TipBuilder from "./TipBuilder.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        chatType: ChatType;
        sender: UserSummary | undefined;
        msg: Message;
        me: boolean;
        eventIndex: number;
        timestamp: bigint;
        expiresAt: number | undefined;
        first: boolean;
        last: boolean;
        accepted: boolean;
        confirmed: boolean;
        failed: boolean;
        readByMe: boolean;
        observer?: IntersectionObserver;
        focused: boolean;
        readonly: boolean;
        pinned: boolean;
        canPin: boolean;
        canBlockUsers: boolean;
        canDelete: boolean;
        canQuoteReply: boolean;
        canReact: boolean;
        publicGroup: boolean;
        canStartThread: boolean;
        senderTyping: boolean;
        dateFormatter?: (date: Date) => string;
        collapsed?: boolean;
        threadRootMessage: Message | undefined;
        senderContext: SenderContext | undefined;
        onExpandMessage?: (() => void) | undefined;
        // this is not to do with permission - some messages (namely thread root messages) will simply not support replying or editing inside a thread
        supportsEdit: boolean;
        supportsReply: boolean;
        onReplyTo?: (replyContext: EnhancedReplyContext) => void;
        onEditMessage?: () => void;
        onCollapseMessage?: () => void;
        onRetrySend?: () => void;
        onDeleteFailedMessage?: () => void;
        onRemovePreview?: (url: string) => void;
        onGoToMessageIndex?: (args: { index: number }) => void;
    }

    let {
        chatId,
        chatType,
        sender,
        msg,
        me,
        eventIndex,
        timestamp,
        expiresAt,
        first,
        last,
        accepted,
        confirmed,
        failed,
        readByMe,
        observer,
        focused,
        readonly,
        pinned,
        canPin,
        canBlockUsers,
        canDelete,
        canQuoteReply,
        canReact,
        publicGroup,
        canStartThread,
        senderTyping,
        collapsed = false,
        threadRootMessage,
        senderContext,
        onExpandMessage = undefined,
        supportsEdit,
        supportsReply,
        onReplyTo,
        onEditMessage,
        onCollapseMessage,
        onRetrySend,
        onDeleteFailedMessage,
        onRemovePreview,
        onGoToMessageIndex,
    }: Props = $props();

    let msgElement: HTMLElement | undefined;
    let msgBubbleElement: HTMLElement | undefined;

    let multiUserChat = chatType === "group_chat" || chatType === "channel";
    let showEmojiPicker = $state(false);
    let debug = false;
    let showRemindMe = $state(false);
    let showReport = $state(false);
    let tipping: string | undefined = $state(undefined);
    let percentageExpired = $state(100);
    let mediaCalculatedHeight = $state(undefined as number | undefined);
    let botProfile: BotProfileProps | undefined = $state(undefined);
    let confirmedReadByThem = $derived(client.messageIsReadByThem(chatId, msg.messageIndex));
    let readByThem = $derived(confirmedReadByThem || $unconfirmedReadByThem.has(msg.messageId));

    trackedEffect("read-by-them", () => {
        if (confirmedReadByThem && $unconfirmedReadByThem.has(msg.messageId)) {
            unconfirmedReadByThem.delete(msg.messageId);
        }
    });

    onMount(() => {
        if (!readByMe) {
            tick().then(() => {
                if (observer !== undefined && msgElement !== undefined) {
                    try {
                        observer.observe(msgElement);
                    } catch {}
                }
            });
        }

        recalculateMediaDimensions();

        if (expiresAt !== undefined) {
            return now.subscribe((t) => {
                const ttl = expiresAt ? expiresAt - Number(timestamp) : 0;
                const age = t - Number(timestamp);
                const expired = age > ttl;
                percentageExpired = expired ? 100 : (age / ttl) * 100;
                // if this message is the root of a thread, make sure that we close that thread when the message expires
                if (percentageExpired >= 100 && msg.thread) {
                    client.filterRightPanelHistory(
                        (panel) => panel.kind !== "message_thread_panel",
                    );
                    pageReplace(removeQueryStringParam("open"));
                }
            });
        }
    });

    onDestroy(() => {
        if (msgElement) {
            observer?.unobserve(msgElement);
        }
    });

    function createReplyContext(): EnhancedReplyContext {
        return {
            kind: "rehydrated_reply_context",
            senderId: msg.sender,
            eventIndex: eventIndex,
            content: msg.content,
            sender,
            messageId: msg.messageId,
            messageIndex: msg.messageIndex,
            edited: msg.edited,
            isThreadRoot: msg.thread !== undefined,
            sourceContext: messageContext,
        };
    }

    function reply() {
        if (canQuoteReply) {
            onReplyTo?.(createReplyContext());
        }
    }

    function replyPrivately() {
        publish("replyPrivatelyTo", createReplyContext());
    }

    function cancelReminder(content: MessageReminderCreatedContent) {
        client
            .cancelMessageReminder(msg.messageId, { ...content, hidden: true })
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("reminders.cancelSuccess"));
                } else {
                    toastStore.showFailureToast(i18nKey("reminders.cancelFailure"));
                }
            });
    }

    function editMessage() {
        if (canEdit) {
            onEditMessage?.();
        }
    }

    function doubleClickMessage() {
        if (failed || msg.deleted || !$dclickReply) return;

        if (me) {
            editMessage();
        } else if (confirmed) {
            reply();
        }
    }

    function tipMessage(ledger: string) {
        tipping = ledger;
    }

    function selectReaction(selected: SelectedEmoji) {
        if (selected.kind === "native") {
            toggleReaction(false, selected.unicode);
        } else {
            toggleReaction(false, `@CE(${selected.code})`);
        }
    }

    function selectQuickReaction(unicode: string) {
        toggleReaction(true, unicode);
    }

    function toggleReaction(isQuickReaction: boolean, reaction: string) {
        if (canReact) {
            const kind = client.containsReaction($currentUserIdStore, reaction, msg.reactions)
                ? "remove"
                : "add";

            client
                .selectReaction(
                    chatId,
                    $currentUserIdStore,
                    threadRootMessageIndex,
                    msg.messageId,
                    reaction,
                    $currentUserStore.username,
                    $currentUserStore.displayName,
                    kind,
                )
                .then((success) => {
                    if (success && kind === "add") {
                        client.trackEvent("reacted_to_message");

                        if (isQuickReaction) {
                            // Note: Manually selected reactions do not increment
                            // their fav counter by default, so we do it manually.
                            // Also refresh loaded reactions.
                            quickReactions.incrementFavourite(reaction);
                        }

                        quickReactions.reload();
                    }
                });
        }
        showEmojiPicker = false;
    }

    function recalculateMediaDimensions() {
        if (mediaDimensions === undefined || !msgBubbleElement) {
            return;
        }

        let msgBubblePaddingWidth = 0;
        if (!fill) {
            let msgBubbleStyle = getComputedStyle(msgBubbleElement);
            msgBubblePaddingWidth =
                parseFloat(msgBubbleStyle.paddingLeft) +
                parseFloat(msgBubbleStyle.paddingRight) +
                parseFloat(msgBubbleStyle.borderRightWidth) +
                parseFloat(msgBubbleStyle.borderLeftWidth);
        }

        const messageWrapperWidth = msgElement?.offsetWidth ?? 0;

        let targetMediaDimensions = client.calculateMediaDimensions(
            mediaDimensions,
            messageWrapperWidth,
            msgBubblePaddingWidth,
            window.innerHeight,
            maxWidthFraction,
        );
        mediaCalculatedHeight = targetMediaDimensions.height;
    }

    function openUserProfile(ev?: Event) {
        if (sender?.kind === "bot") {
            botProfile = {
                botId: sender.userId,
                chatId,
                onClose: () => (botProfile = undefined),
            };
        } else {
            ev?.target?.dispatchEvent(
                new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                    detail: {
                        userId: msg.sender,
                        chatButton: multiUserChat,
                        inGlobalContext: false,
                    },
                    bubbles: true,
                }),
            );
        }
    }

    function onRegisterVote(detail: { answerIndex: number; type: "register" | "delete" }) {
        if (chatId.kind === "direct_chat") return;

        client
            .registerPollVote(
                chatId,
                threadRootMessageIndex,
                msg.messageId,
                msg.messageIndex,
                detail.answerIndex,
                detail.type,
            )
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("poll.voteFailed"));
                }
            });
    }

    function reportMessage() {
        showReport = true;
    }

    function remindMe() {
        showRemindMe = true;
    }

    const maxWidthFraction = 0.85;
    let inert = $derived(
        msg.content.kind === "deleted_content" ||
            msg.content.kind === "blocked_content" ||
            collapsed,
    );
    let canTip = $derived(!me && confirmed && !inert && !failed);
    let inThread = $derived(threadRootMessage !== undefined);
    let threadRootMessageIndex = $derived(
        threadRootMessage?.messageId === msg.messageId
            ? undefined
            : threadRootMessage?.messageIndex,
    );
    let mediaDimensions = $derived(client.extractDimensionsFromMessageContent(msg.content));
    let fill = $derived(client.fillMessage(msg));
    let showAvatar = $derived(
        chatType !== "direct_chat" && !me && $screenWidth !== ScreenWidth.ExtraExtraSmall,
    );
    let translated = $derived($translationsStore.has(msg.messageId));
    let threadSummary = $derived(msg.thread);
    let msgUrl = $derived(
        `${routeForMessage($chatListScopeStore.kind, { chatId }, msg.messageIndex)}?open=true`,
    );
    let isProposal = $derived(msg.content.kind === "proposal_content");
    let canEdit = $derived(
        me && supportsEdit && !msg.deleted && client.contentTypeSupportsEdit(msg.content.kind),
    );
    let undeleting = $derived($undeletingMessagesStore.has(msg.messageId));
    let deletedByMe = $derived(
        msg.content.kind === "deleted_content" && msg.content.deletedBy == $currentUserIdStore,
    );
    let permanentlyDeleted = $derived(
        deletedByMe &&
            me &&
            msg.content.kind === "deleted_content" &&
            Number(msg.content.timestamp) < $now - 5 * 60 * 1000,
    );
    let canRevealDeleted = $derived(deletedByMe && !undeleting && !permanentlyDeleted);
    let canRevealBlocked = $derived(msg.content.kind === "blocked_content");
    let messageContext = $derived({ chatId, threadRootMessageIndex });
    let ephemeral = $derived(localUpdates.isEphemeral(messageContext, msg.messageId));
    let showChatMenu = $derived(
        (!inert || canRevealDeleted || canRevealBlocked) && !readonly && !ephemeral,
    );
    let canUndelete = $derived(msg.deleted && msg.content.kind !== "deleted_content");
    let tips = $derived(msg.tips ? Object.entries(msg.tips) : []);
    let canBlockUser = $derived(canBlockUsers && !$selectedChatBlockedUsersStore.has(msg.sender));
    let edited = $derived(
        msg.edited && (senderContext?.kind !== "bot" || !senderContext.finalised),
    );
    let canShare = $derived(canShareMessage(msg.content));
    let canForward = $derived(client.canForward(msg.content));
    let canTranslate = $derived((client.getMessageText(msg.content) ?? "").length > 0);
</script>

<svelte:window onresize={recalculateMediaDimensions} />

{#if botProfile !== undefined}
    <BotProfile {...botProfile} />
{/if}

{#if tipping !== undefined}
    <TipBuilder ledger={tipping} onClose={() => (tipping = undefined)} {msg} {messageContext} />
{/if}

{#if showEmojiPicker && canReact}
    <Overlay onClose={() => (showEmojiPicker = false)} dismissible>
        <ModalContent hideFooter hideHeader fill>
            {#snippet body()}
                <div class="emoji-header">
                    <h4><Translatable resourceKey={i18nKey("chooseReaction")} /></h4>
                    <HoverIcon onclick={() => (showEmojiPicker = false)}>
                        <Close size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
                <EmojiPicker
                    onEmojiSelected={selectReaction}
                    onSkintoneChanged={(tone) => quickReactions.reload(tone)}
                    supportCustom={true}
                    mode={"reaction"} />
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

{#if showRemindMe}
    <ReminderBuilder
        {chatId}
        {eventIndex}
        {threadRootMessageIndex}
        onClose={() => (showRemindMe = false)} />
{/if}

{#if showReport}
    <ReportMessage
        {threadRootMessageIndex}
        messageId={msg.messageId}
        {chatId}
        {canDelete}
        onClose={() => (showReport = false)} />
{/if}

{#if debug}
    <pre>Sender: {msg.sender}</pre>
    <pre>EventIdx: {eventIndex}</pre>
    <pre>MsgIdx: {msg.messageIndex}</pre>
    <pre>MsgId: {msg.messageId}</pre>
    <pre>Confirmed: {confirmed}</pre>
    <pre>ReadByThem: {readByThem}</pre>
    <pre>ReadByUs: {readByMe}</pre>
    <pre>Pinned: {pinned}</pre>
    <pre>edited: {msg.edited}</pre>
    <pre>failed: {failed}</pre>
    <pre>timestamp: {timestamp}</pre>
    <pre>expiresAt: {expiresAt}</pre>
    <pre>thread: {JSON.stringify(msg.thread, null, 4)}</pre>
    <pre>senderContext: {JSON.stringify(senderContext, null, 4)}</pre>
    <pre>inert: {inert}</pre>
    <pre>canRevealDeleted: {canRevealDeleted}</pre>
    <pre>canlRevealBlocked: {canRevealBlocked}</pre>
    <pre>readonly: {readonly}</pre>
    <pre>showChatMenu: {showChatMenu}</pre>
    <pre>intersecting: {intersecting}</pre>
    <pre>ephemeral: {ephemeral}</pre>
{/if}
{#if expiresAt === undefined || percentageExpired < 100}
    <IntersectionObserverComponent>
        {#snippet children(intersecting)}
            <Container
                data_index={failed ? "" : `${msg.messageIndex}`}
                data_id={failed ? "" : `${msg.messageId}`}
                id={failed ? "" : `event-${eventIndex}`}
                bind:ref={msgElement}
                padding={last ? ["zero", "zero", "sm", "zero"] : "zero"}
                gap={"sm"}
                allowOverflow
                mainAxisAlignment={me ? "end" : "start"}>
                {#if showAvatar}
                    <div class:first class="avatar">
                        <Avatar
                            onClick={openUserProfile}
                            url={client.userAvatarUrl(sender)}
                            size={"sm"}></Avatar>
                    </div>
                {/if}
                {@const hasThread = threadSummary !== undefined && !inThread}
                {@const hasReactions = msg.reactions.length > 0}
                {@const hasTips = tips.length > 0}
                <Container
                    supplementalClass={"message_bubble_wrapper"}
                    allowOverflow
                    crossAxisAlignment={me ? "end" : "start"}
                    width={{ kind: "hug" }}
                    maxWidth={"85%"}
                    gap={"xxs"}
                    minWidth={"6rem"}
                    direction={"vertical"}>
                    <MenuTrigger maskUI centered mobileMode={"longpress"}>
                        {#snippet menuItems()}
                            {#if showChatMenu && intersecting}
                                <ChatMessageMenu
                                    {chatId}
                                    {isProposal}
                                    {inert}
                                    {publicGroup}
                                    {confirmed}
                                    {failed}
                                    {canShare}
                                    {me}
                                    {canPin}
                                    {canReact}
                                    {canTip}
                                    {pinned}
                                    {supportsReply}
                                    {canQuoteReply}
                                    {threadRootMessage}
                                    {canStartThread}
                                    {multiUserChat}
                                    {msg}
                                    {canForward}
                                    {canBlockUser}
                                    {canEdit}
                                    {canDelete}
                                    {canUndelete}
                                    {canRevealDeleted}
                                    {canRevealBlocked}
                                    translatable={canTranslate}
                                    {translated}
                                    {selectQuickReaction}
                                    showEmojiPicker={() => {
                                        showEmojiPicker = true;
                                    }}
                                    {onCollapseMessage}
                                    onReply={reply}
                                    {onRetrySend}
                                    {onDeleteFailedMessage}
                                    onReplyPrivately={replyPrivately}
                                    onEditMessage={editMessage}
                                    onTipMessage={tipMessage}
                                    onReportMessage={reportMessage}
                                    onCancelReminder={cancelReminder}
                                    onRemindMe={remindMe} />
                            {/if}
                        {/snippet}
                        <MessageBubble
                            {focused}
                            {senderTyping}
                            {senderContext}
                            {sender}
                            bind:ref={msgBubbleElement}
                            onOpenUserProfile={openUserProfile}
                            onDoubleClick={doubleClickMessage}
                            {msg}
                            {fill}
                            {first}
                            {last}
                            {hasThread}
                            time={Number(timestamp)}
                            {pinned}
                            {expiresAt}
                            {percentageExpired}
                            bot={sender?.kind === "bot"}
                            {accepted}
                            {failed}
                            {undeleting}
                            {readByThem}
                            {readByMe}
                            {onGoToMessageIndex}
                            {chatType}>
                            {#snippet repliesTo(reply)}
                                <RepliesTo
                                    {readonly}
                                    {chatId}
                                    {intersecting}
                                    {onRemovePreview}
                                    repliesTo={reply} />
                            {/snippet}

                            {#snippet messageContent(me)}
                                <ChatMessageContent
                                    senderId={msg.sender}
                                    showPreviews
                                    {readonly}
                                    {fill}
                                    {me}
                                    {messageContext}
                                    {collapsed}
                                    {undeleting}
                                    {intersecting}
                                    {failed}
                                    {timestamp}
                                    messageIndex={msg.messageIndex}
                                    messageId={msg.messageId}
                                    content={msg.content}
                                    {edited}
                                    height={mediaCalculatedHeight}
                                    blockLevelMarkdown={msg.blockLevelMarkdown}
                                    {onRemovePreview}
                                    {onRegisterVote}
                                    {onExpandMessage} />
                            {/snippet}
                        </MessageBubble>
                    </MenuTrigger>
                    {#if hasThread}
                        <ThreadSummary
                            url={msgUrl}
                            {threadSummary}
                            {chatId}
                            threadRootMessageIndex={msg.messageIndex}
                            {me} />
                    {/if}
                    {#if hasReactions}
                        <Reactions
                            {me}
                            onClick={({ reaction }) => toggleReaction(false, reaction)}
                            {intersecting}
                            reactions={msg.reactions}
                            offset={!hasThread}></Reactions>
                    {/if}

                    {#if hasTips && !inert}
                        <Tips
                            {me}
                            tips={msg.tips}
                            onClick={tipMessage}
                            {canTip}
                            offset={!hasThread} />
                    {/if}
                </Container>
            </Container>
        {/snippet}
    </IntersectionObserverComponent>
{/if}

<style lang="scss">
    :global(.container.message_bubble_wrapper .menu-trigger) {
        width: 100%;
    }
    .avatar:not(.first) {
        visibility: hidden;
    }
    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);
    }
</style>
