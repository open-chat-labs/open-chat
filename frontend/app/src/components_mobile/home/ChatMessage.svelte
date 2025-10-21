<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { Avatar, Container, MenuTrigger } from "component-lib";
    import {
        type ChatIdentifier,
        chatListScopeStore,
        type ChatType,
        currentUserIdStore,
        currentUserStore,
        type Dimensions,
        type EnhancedReplyContext,
        iconSize,
        localUpdates,
        type Message,
        type MessageContent,
        type MessageReminderCreatedContent,
        mobileWidth,
        OpenChat,
        pageReplace,
        publish,
        routeForMessage,
        screenWidth,
        ScreenWidth,
        selectedChatBlockedUsersStore,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
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
    import { dclickReply } from "../../stores/settings";
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
    import Reactions from "./message/Reactions.svelte";
    import ThreadSummary from "./message/ThreadSummary.svelte";
    import Tips from "./message/Tips.svelte";
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
        editing: boolean;
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
        editing,
        canStartThread,
        senderTyping,
        dateFormatter = (date) => client.toShortTimeString(date),
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
    let msgBubbleWrapperElement: HTMLElement | undefined;
    let msgBubbleElement: HTMLElement | undefined;

    let multiUserChat = chatType === "group_chat" || chatType === "channel";
    let showEmojiPicker = $state(false);
    let debug = false;
    let crypto =
        msg.content.kind === "crypto_content" ||
        msg.content.kind === "prize_content" ||
        msg.content.kind === "p2p_swap_content";
    let showRemindMe = $state(false);
    let showReport = $state(false);
    let tipping: string | undefined = $state(undefined);
    let percentageExpired = $state(100);
    let mediaCalculatedHeight = $state(undefined as number | undefined);
    let msgBubbleCalculatedWidth = $state(undefined as number | undefined);
    let botProfile: BotProfileProps | undefined = $state(undefined);
    let confirmedReadByThem = $derived(client.messageIsReadByThem(chatId, msg.messageIndex));
    let readByThem = $derived(confirmedReadByThem || $unconfirmedReadByThem.has(msg.messageId));
    let streak = $derived(sender?.streak ?? 0);
    let chitEarned = $derived(sender?.totalChitEarned ?? 0);
    let hasAchievedMaxStreak = $derived((sender?.maxStreak ?? 0) >= 365);

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

    function extractDimensions(content: MessageContent): Dimensions | undefined {
        if (content.kind === "image_content") {
            return {
                width: content.width,
                height: content.height,
            };
        } else if (content.kind === "video_content") {
            return {
                width: content.width,
                height: content.height,
            };
        } else if (content.kind === "meme_fighter_content") {
            return {
                width: content.width,
                height: content.height,
            };
        } else if (content.kind === "giphy_content") {
            return $mobileWidth
                ? { width: content.mobile.width, height: content.mobile.height }
                : { width: content.desktop.width, height: content.desktop.height };
        } else if (
            content.kind === "text_content" &&
            (client.isSocialVideoLink(content.text) || client.containsSocialVideoLink(content.text))
        ) {
            return { width: 560, height: 315 };
        }

        return undefined;
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

        const messageWrapperWidth = msgBubbleWrapperElement?.parentElement?.offsetWidth ?? 0;

        let targetMediaDimensions = client.calculateMediaDimensions(
            mediaDimensions,
            messageWrapperWidth,
            msgBubblePaddingWidth,
            window.innerHeight,
            maxWidthFraction,
        );
        mediaCalculatedHeight = targetMediaDimensions.height;
        msgBubbleCalculatedWidth = targetMediaDimensions.width + msgBubblePaddingWidth;
    }

    function openUserProfile(ev: Event) {
        if (sender?.kind === "bot") {
            botProfile = {
                botId: sender.userId,
                chatId,
                onClose: () => (botProfile = undefined),
            };
        } else {
            ev.target?.dispatchEvent(
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
    let maxWidthFraction = $derived($screenWidth === ScreenWidth.ExtraLarge ? 0.7 : 0.8);
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
    let mediaDimensions = $derived(extractDimensions(msg.content));
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
    let isPrize = $derived(msg.content.kind === "prize_content");
    let isP2PSwap = $derived(msg.content.kind === "p2p_swap_content");
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
    let senderDisplayName = $derived(
        client.getDisplayName(
            msg.sender,
            $selectedCommunityMembersStore,
            $selectedChatWebhooksStore,
        ),
    );
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

{#if expiresAt === undefined || percentageExpired < 100}
    <IntersectionObserverComponent>
        {#snippet children(intersecting)}
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
                <Container
                    padding={last ? ["zero", "zero", "lg", "zero"] : "zero"}
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
                        allowOverflow
                        crossAxisAlignment={me ? "end" : "start"}
                        width={{ kind: "fixed", size: "80%" }}
                        gap={"xs"}
                        direction={"vertical"}>
                        <MessageBubble
                            {first}
                            {last}
                            {me}
                            {hasThread}
                            {hasReactions}
                            time={Number(timestamp)}
                            edited={msg.edited}>
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
                                onClick={({ reaction }) => toggleReaction(false, reaction)}
                                {intersecting}
                                reactions={msg.reactions}
                                offset={!hasThread}></Reactions>
                        {/if}

                        {#if hasTips && !inert}
                            <Tips
                                tips={msg.tips}
                                onClick={tipMessage}
                                {canTip}
                                offset={!hasThread} />
                        {/if}
                    </Container>
                </Container>
            </MenuTrigger>
        {/snippet}
    </IntersectionObserverComponent>
{/if}

<style lang="scss">
    $size: 10px;

    $avatar-width: toRem(56);
    $avatar-width-mob: toRem(43);

    .avatar:not(.first) {
        visibility: hidden;
    }

    @keyframes show-bubble-menu {
        0% {
            z-index: -1;
            opacity: 0;
        }
        1% {
            z-index: 1;
            opacity: 0;
        }
        100% {
            z-index: 1;
            opacity: 1;
        }
    }

    @include mobile() {
        :global(.bubble-wrapper .menu) {
            display: none;
        }
    }

    @include not-mobile() {
        :global(.bubble-wrapper .menu) {
            display: flex;
            z-index: -1;
            opacity: 0;
        }

        // Keeps hover menu showing if context menu is clicked!
        :global(.bubble-wrapper .menu:has(.menu-icon.open)) {
            border-color: var(--primary);
            z-index: 1;
            opacity: 1;
        }

        @media (hover: hover) {
            :global(.bubble-wrapper:hover .menu:not(:has(.menu-icon.open))) {
                animation: show-bubble-menu 200ms ease-in-out forwards;
            }
        }
    }

    :global(.message .sender .never) {
        display: inline-flex;
        gap: $sp2;
        align-items: center;
    }

    :global(.message .avatar .avatar) {
        margin: 0;
    }

    :global(.message-bubble .content a) {
        text-decoration: underline;
    }

    :global(.message-bubble .content ul) {
        margin: 0 $sp4;
    }

    :global(.message-bubble a) {
        color: inherit;
    }

    :global(.message-bubble.crypto a) {
        color: inherit;
    }

    :global(.message-bubble.first .menu) {
        top: -24px;
    }

    :global(.actions .reaction .wrapper) {
        padding: 6px;
    }

    .message-wrapper {
        &.last {
            margin-bottom: var(--sp-md);
        }

        &.me {
            align-self: flex-end;
        }
    }

    .sender {
        margin-bottom: $sp1;

        &.fill {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.3);
            color: #fff;
            padding: $sp4 $sp4;
            border-radius: 0 0 $sp4 0;
            z-index: 1;

            &.rtl {
                right: 0;
                border-radius: 0 0 0 $sp4;
            }
        }

        .typing {
            color: var(--accent);
        }
    }

    .message-reactions,
    .tips {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 3px;

        &.me {
            justify-content: flex-end;
        }

        &.indent {
            margin-left: $avatar-width;
            @include mobile() {
                margin-left: $avatar-width-mob;
            }
        }
    }

    .bot-context {
        display: flex;
        margin-inline-start: $avatar-width;
        margin-bottom: $sp2;
        margin-top: $sp2;

        @include mobile() {
            margin-inline-start: $avatar-width-mob;
        }
    }

    .message {
        display: flex;
        justify-content: flex-start;
        margin-bottom: $sp2;
        position: relative;

        &.me {
            justify-content: flex-end;
        }

        .avatar-col {
            flex: 0 0 $avatar-width;

            @include mobile() {
                flex: 0 0 $avatar-width-mob;
            }

            .avatar {
                cursor: pointer;
            }
        }

        .actions {
            display: none;
            opacity: 0.3;
            padding: 0 $sp3;
            align-items: center;
            justify-content: center;
            transition: opacity 200ms ease-in-out;
        }

        .actions.touch {
            display: flex;
        }

        @include mobile() {
            .actions:not(.touch) {
                display: flex;
            }
        }
    }

    .bubble-wrapper {
        position: relative;
        max-width: var(--max-width);
        min-width: 90px;

        &.p2pSwap {
            width: 350px;
        }

        &.proposal {
            max-width: 800px;
        }

        &.proposal,
        &.p2pSwap {
            .message-bubble {
                width: 100%;
            }
        }
    }

    .message-bubble {
        $radius: var(--currentChat-msg-r1);
        $inner-radius: var(--currentChat-msg-r2);
        transition:
            box-shadow ease-out 500ms,
            background-color ease-in-out 200ms,
            border ease-in-out 300ms,
            transform ease-in-out 200ms;
        position: relative;
        padding: toRem(8) toRem(12) toRem(8) toRem(12);
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        border: var(--currentChat-msg-bd);
        box-shadow: var(--currentChat-msg-sh);

        :global(.markdown-wrapper) {
            word-break: break-word;
        }

        .username {
            color: inherit;
            color: var(--txt);
            display: inline;

            &.fill {
                color: #fff;
            }
        }

        &:not(.readByMe) {
            box-shadow: 0 0 0 5px var(--notificationBar-bg);
        }

        &.last:not(.first) {
            border-radius: $inner-radius $radius $radius $radius;
        }
        &.first:not(.last) {
            border-radius: $radius $radius $radius $inner-radius;
        }
        &:not(.first):not(.last) {
            border-radius: $inner-radius $radius $radius $inner-radius;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);

            .username {
                color: var(--currentChat-msg-me-txt);
            }

            &.inert {
                .username {
                    color: var(--txt);
                }
            }
        }

        &.rtl {
            &.last:not(.first) {
                border-radius: $radius $inner-radius $radius $radius;
            }
            &.first:not(.last) {
                border-radius: $radius $radius $inner-radius $radius;
            }
            &:not(.first):not(.last) {
                border-radius: $radius $inner-radius $inner-radius $radius;
            }
        }

        &.fill {
            padding: 0;
            border: none;
            line-height: 0;
        }

        &.focused {
            box-shadow: 0 0 0 4px var(--currentChat-msg-focus);
            transition:
                background-color ease-in-out 200ms,
                border ease-in-out 300ms,
                transform ease-in-out 200ms;
        }

        &.editing {
            box-shadow: 0 0 0 4px var(--currentChat-msg-focus);
        }

        &.inert {
            opacity: 0.8;
            color: var(--currentChat-msg-txt);
            background-color: var(--currentChat-msg-inert);
        }

        &.collapsed {
            cursor: pointer;
        }

        &:after {
            content: "";
            display: table;
            clear: both;
        }

        .forwarded {
            color: var(--currentChat-msg-muted);
            display: flex;
            gap: $sp1;
            align-items: center;
            @include font-size(fs-80);
            font-style: italic;
            .text {
                margin-bottom: $sp2;
            }
        }

        &.me .forwarded {
            color: var(--currentChat-msg-me-muted);
        }

        &.failed {
            background-color: var(--error);
        }
    }

    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);
    }
</style>
