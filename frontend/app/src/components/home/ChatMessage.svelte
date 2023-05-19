<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import type {
        CreatedUser,
        Message,
        EnhancedReplyContext,
        Dimensions,
        MessageContent,
        OpenChat,
        PartialUserSummary,
        MessageReminderCreatedContent,
    } from "openchat-client";
    import EmojiPicker from "./EmojiPicker.svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Typing from "../Typing.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { now } from "../../stores/time";
    import {
        afterUpdate,
        createEventDispatcher,
        getContext,
        onDestroy,
        onMount,
        tick,
    } from "svelte";
    import EmoticonLolOutline from "svelte-material-icons/EmoticonLolOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import UnresolvedReply from "./UnresolvedReply.svelte";
    import { mobileWidth, ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import TimeAndTicks from "./TimeAndTicks.svelte";
    import { iconSize } from "../../stores/iconSize";
    import MessageReaction from "./MessageReaction.svelte";
    import ViewUserProfile from "./profile/ViewUserProfile.svelte";
    import ThreadSummary from "./ThreadSummary.svelte";
    import { pathParams } from "../../routes";
    import { canShareMessage } from "../../utils/share";
    import ChatMessageMenu from "./ChatMessageMenu.svelte";
    import { toastStore } from "../../stores/toast";
    import ReminderBuilder from "./ReminderBuilder.svelte";
    import ReportMessage from "./ReportMessage.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: CreatedUser;
    export let sender: PartialUserSummary | undefined;
    export let msg: Message;
    export let me: boolean;
    export let eventIndex: number;
    export let timestamp: bigint;
    export let first: boolean;
    export let last: boolean;
    export let confirmed: boolean;
    export let failed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let readonly: boolean;
    export let pinned: boolean;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canQuoteReply: boolean;
    export let canReact: boolean;
    export let publicGroup: boolean;
    export let editing: boolean;
    export let canStartThread: boolean;
    export let senderTyping: boolean;
    export let dateFormatter: (date: Date) => string = client.toShortTimeString;
    export let collapsed: boolean = false;
    export let threadRootMessage: Message | undefined;

    // this is not to do with permission - some messages (namely thread root messages) will simply not support replying or editing inside a thread
    export let supportsEdit: boolean;
    export let supportsReply: boolean;

    let msgElement: HTMLElement;
    let msgBubbleElement: HTMLElement;
    let groupChat = chatType === "group_chat";
    let showEmojiPicker = false;
    let debug = false;
    let viewProfile = false;
    let alignProfileTo: DOMRect | undefined = undefined;
    let crypto = msg.content.kind === "crypto_content";
    let poll = msg.content.kind === "poll_content";
    let canRevealDeleted = false;
    let showRemindMe = false;
    let showReport = false;

    $: inThread = threadRootMessage !== undefined;
    $: threadRootMessageIndex =
        threadRootMessage?.messageId === msg.messageId
            ? undefined
            : threadRootMessage?.messageIndex;
    $: translationStore = client.translationStore;
    $: canEdit = me && supportsEdit && !msg.deleted && !crypto && !poll;
    $: isBot = sender?.kind === "bot";
    $: username = sender?.username;
    $: mediaDimensions = extractDimensions(msg.content);
    $: mediaCalculatedHeight = undefined as number | undefined;
    $: msgBubbleCalculatedWidth = undefined as number | undefined;
    $: fill = client.fillMessage(msg);
    $: showAvatar = $screenWidth !== ScreenWidth.ExtraExtraSmall;
    $: translated = $translationStore.has(Number(msg.messageId));
    $: threadSummary = msg.thread;
    $: msgUrl = `/${chatId}/${msg.messageIndex}?open=true`;
    $: isProposal = msg.content.kind === "proposal_content";
    $: isPrize = msg.content.kind === "prize_content";
    $: isPrizeWinner = msg.content.kind === "prize_winner_content";
    $: inert = msg.content.kind === "deleted_content" || collapsed;
    $: undeletingMessagesStore = client.undeletingMessagesStore;
    $: undeleting = $undeletingMessagesStore.has(msg.messageId);
    $: showChatMenu = (!inert || canRevealDeleted) && !readonly;
    $: canUndelete = msg.deleted && msg.content.kind !== "deleted_content";

    afterUpdate(() => {
        if (readByMe && observer && msgElement) {
            observer.unobserve(msgElement);
        }
    });

    onMount(() => {
        if (!readByMe) {
            tick().then(() => {
                if (observer !== undefined) {
                    // todo - leaving this console log here for now just to make sure we are not *over* observing
                    console.log("beginning to observe: ", msg.messageIndex);
                    observer.observe(msgElement);
                }
            });
        }

        recalculateMediaDimensions();

        return now.subscribe((t) => {
            canRevealDeleted =
                !undeleting &&
                msg.content.kind === "deleted_content" &&
                ((canDelete && msg.content.deletedBy !== msg.sender) ||
                    (msg.sender === user.userId &&
                        // Only allow viewing of your own message for 5 minutes after deleting it
                        (msg.content.deletedBy !== msg.sender ||
                            t - Number(msg.content.timestamp) < 5 * 60 * 1000)));
        });
    });

    onDestroy(() => {
        if (msgElement) {
            observer?.unobserve(msgElement);
        }
    });

    function chatWithUser() {
        closeUserProfile();
        dispatch("chatWith", msg.sender);
    }

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
            sourceContext: { chatId, threadRootMessageIndex: threadRootMessage?.messageIndex },
        };
    }

    function reply() {
        if (canQuoteReply) {
            dispatch("replyTo", createReplyContext());
        }
    }

    function replyPrivately() {
        dispatch("replyPrivatelyTo", createReplyContext());
    }

    function cancelReminder(ev: CustomEvent<MessageReminderCreatedContent>) {
        client
            .cancelMessageReminder(msg.messageId, { ...ev.detail, hidden: true })
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast("reminders.cancelSuccess");
                } else {
                    toastStore.showFailureToast("reminders.cancelFailure");
                }
            });
    }

    function editMessage() {
        if (canEdit) {
            dispatch("editMessage");
        }
    }

    function doubleClickMessage() {
        if (failed || msg.deleted) return;

        if (me) {
            editMessage();
        } else if (confirmed) {
            reply();
        }
    }

    function selectReaction(ev: CustomEvent<string>) {
        toggleReaction(ev.detail);
    }

    function toggleReaction(reaction: string) {
        if (canReact) {
            const kind = client.containsReaction(user.userId, reaction, msg.reactions)
                ? "remove"
                : "add";

            client
                .selectReaction(
                    chatId,
                    user.userId,
                    threadRootMessageIndex,
                    msg.messageId,
                    reaction,
                    user.username,
                    kind
                )
                .then((success) => {
                    if (success && kind === "add") {
                        client.trackEvent("reacted_to_message");
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
        if (mediaDimensions === undefined) {
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

        const parentWidth = msgBubbleElement.parentElement?.offsetWidth ?? 0;

        let targetMediaDimensions = client.calculateMediaDimensions(
            mediaDimensions,
            parentWidth,
            msgBubblePaddingWidth,
            window.innerHeight,
            inThread ? 0.9 : $screenWidth === ScreenWidth.ExtraLarge ? 0.7 : 0.8
        );
        mediaCalculatedHeight = targetMediaDimensions.height;
        msgBubbleCalculatedWidth = targetMediaDimensions.width + msgBubblePaddingWidth;
    }

    function openUserProfile(ev: Event) {
        if (ev.target) {
            alignProfileTo = (ev.target as HTMLElement).getBoundingClientRect();
        }
        viewProfile = true;
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function registerVote(ev: CustomEvent<{ answerIndex: number; type: "register" | "delete" }>) {
        client
            .registerPollVote(
                chatId,
                threadRootMessageIndex,
                msg.messageId,
                msg.messageIndex,
                ev.detail.answerIndex,
                ev.detail.type
            )
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast("poll.voteFailed");
                }
            });
    }

    function canShare(): boolean {
        return canShareMessage(msg.content);
    }
</script>

<svelte:window on:resize={recalculateMediaDimensions} />

{#if showEmojiPicker && canReact}
    <Overlay on:close={() => (showEmojiPicker = false)} dismissible>
        <ModalContent hideFooter hideHeader fill>
            <span slot="body">
                <div class="emoji-header">
                    <h4>{$_("chooseReaction")}</h4>
                    <span
                        title={$_("close")}
                        class="close-emoji"
                        on:click={() => (showEmojiPicker = false)}>
                        <HoverIcon>
                            <Close size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                </div>
                <EmojiPicker on:emojiSelected={selectReaction} mode={"reaction"} />
            </span>
            <span slot="footer" />
        </ModalContent>
    </Overlay>
{/if}

{#if showRemindMe}
    <ReminderBuilder
        {chatId}
        {eventIndex}
        threadRootMessageIndex={threadRootMessage?.messageIndex}
        on:close={() => (showRemindMe = false)} />
{/if}

{#if showReport}
    <ReportMessage
        {eventIndex}
        {threadRootMessageIndex}
        messageId={msg.messageId}
        {chatId}
        {canDelete}
        on:close={() => (showReport = false)} />
{/if}

{#if viewProfile}
    <ViewUserProfile
        alignTo={alignProfileTo}
        userId={msg.sender}
        chatButton={groupChat}
        on:openDirectChat={chatWithUser}
        on:close={closeUserProfile} />
{/if}

<div class="message-wrapper" class:last>
    <div
        bind:this={msgElement}
        class="message"
        class:me
        data-index={failed ? "" : msg.messageIndex}
        data-id={failed ? "" : msg.messageId}
        id={failed ? "" : `event-${eventIndex}`}>
        {#if showAvatar}
            <div class="avatar-col">
                {#if first}
                    <div class="avatar" on:click={openUserProfile}>
                        <Avatar
                            url={client.userAvatarUrl(sender)}
                            userId={msg.sender}
                            size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
                    </div>
                {/if}
            </div>
        {/if}

        <div
            bind:this={msgBubbleElement}
            style={msgBubbleCalculatedWidth !== undefined
                ? `width: ${msgBubbleCalculatedWidth}px`
                : undefined}
            on:dblclick={doubleClickMessage}
            class="message-bubble"
            class:focused
            class:editing
            class:fill={fill && !inert}
            class:me
            class:inert
            class:collapsed
            class:first
            class:last
            class:readByMe
            class:crypto
            class:failed
            class:prizeWinner={isPrizeWinner}
            class:proposal={isProposal && !inert}
            class:thread={inThread}
            class:rtl={$rtlStore}>
            {#if first && !isProposal && !isPrize}
                <div class="sender" class:fill class:rtl={$rtlStore}>
                    <Link underline={"never"} on:click={openUserProfile}>
                        <h4
                            class="username"
                            class:fill
                            class:crypto
                            class:diamond={sender?.diamond}>
                            {username}
                        </h4>
                    </Link>
                    {#if senderTyping}
                        <span class="typing">
                            <Typing />
                        </span>
                    {/if}
                </div>
            {/if}
            {#if msg.forwarded}
                <div class="forwarded">
                    <div>
                        <ForwardIcon
                            size={$iconSize}
                            color={me
                                ? "var(--currentChat-msg-me-muted)"
                                : "var(--currentChat-msg-muted)"} />
                    </div>
                    <div class="text">{"Forwarded"}</div>
                </div>
            {/if}
            {#if msg.repliesTo !== undefined && !inert}
                {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                    <RepliesTo
                        messageId={msg.messageId}
                        {readonly}
                        {chatId}
                        on:goToMessageIndex
                        repliesTo={msg.repliesTo} />
                {:else}
                    <UnresolvedReply />
                {/if}
            {/if}

            <ChatMessageContent
                senderId={msg.sender}
                {readonly}
                {fill}
                {me}
                {chatId}
                {collapsed}
                {undeleting}
                messageIndex={msg.messageIndex}
                messageId={msg.messageId}
                myUserId={user.userId}
                content={msg.content}
                edited={msg.edited}
                height={mediaCalculatedHeight}
                on:registerVote={registerVote}
                on:goToMessageIndex
                on:upgrade
                on:expandMessage />

            {#if !inert && !isPrize}
                <TimeAndTicks
                    {pinned}
                    {fill}
                    {timestamp}
                    {me}
                    {confirmed}
                    {failed}
                    deleted={msg.deleted}
                    {undeleting}
                    {readByThem}
                    {crypto}
                    {chatType}
                    {dateFormatter} />
            {/if}

            {#if debug}
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
                <pre>thread: {JSON.stringify(msg.thread, null, 4)}</pre>
            {/if}

            {#if showChatMenu}
                <ChatMessageMenu
                    {chatId}
                    {isProposal}
                    inert={msg.deleted || collapsed}
                    {publicGroup}
                    {confirmed}
                    {failed}
                    canShare={canShare()}
                    {me}
                    {canPin}
                    {pinned}
                    {supportsReply}
                    {canQuoteReply}
                    {threadRootMessage}
                    {canStartThread}
                    {groupChat}
                    {msg}
                    canForward={client.canForward(msg.content)}
                    {canBlockUser}
                    {canEdit}
                    {canDelete}
                    {canUndelete}
                    {canRevealDeleted}
                    {crypto}
                    translatable={msg.content.kind === "text_content"}
                    {translated}
                    on:collapseMessage
                    on:forward
                    on:reply={reply}
                    on:retrySend
                    on:upgrade
                    on:initiateThread
                    on:deleteFailedMessage
                    on:replyPrivately={replyPrivately}
                    on:editMessage={editMessage}
                    on:reportMessage={() => (showReport = true)}
                    on:cancelReminder={cancelReminder}
                    on:remindMe={() => (showRemindMe = true)} />
            {/if}
        </div>

        {#if !collapsed && !msg.deleted && canReact && !failed}
            <div class="actions">
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
            </div>
        {/if}
    </div>

    {#if threadSummary !== undefined && !inThread}
        <ThreadSummary
            {chatId}
            threadRootMessageIndex={msg.messageIndex}
            selected={$pathParams.kind === "chat_selected_route" &&
                msg.messageIndex === $pathParams.messageIndex &&
                $pathParams.open}
            {threadSummary}
            indent={showAvatar}
            {me}
            url={msgUrl} />
    {/if}

    {#if msg.reactions.length > 0 && !inert}
        <div class="message-reactions" class:me class:indent={showAvatar}>
            {#each msg.reactions as { reaction, userIds } (reaction)}
                <MessageReaction
                    on:click={() => toggleReaction(reaction)}
                    {reaction}
                    {userIds}
                    myUserId={user?.userId} />
            {/each}
        </div>
    {/if}
</div>

<style type="text/scss">
    $size: 10px;

    $avatar-width: 56px;
    $avatar-width-mob: 43px;

    :global(.message-bubble:hover .menu-icon) {
        opacity: 1;
    }

    :global(.message-bubble:hover .menu-icon .wrapper) {
        background-color: var(--icon-msg-hv);
    }

    :global(.message-bubble.me:hover .menu-icon .wrapper) {
        background-color: var(--icon-inverted-hv);
    }

    :global(.message-bubble.crypto:hover .menu-icon .wrapper) {
        background-color: rgba(255, 255, 255, 0.3);
    }

    :global(.me .menu-icon:hover .wrapper) {
        background-color: var(--icon-inverted-hv);
    }

    :global(.message-bubble.fill.me:hover .menu-icon .wrapper) {
        background-color: var(--icon-hv);
    }

    :global(.message .loading) {
        min-height: 100px;
        min-width: 250px;
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

    :global(.actions .reaction .wrapper) {
        padding: 6px;
    }

    .message-wrapper {
        &.last {
            margin-bottom: $sp4;
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

    .message-reactions {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 3px;

        &.indent {
            margin-left: $avatar-width;
            @include mobile() {
                margin-left: $avatar-width-mob;
            }
        }
    }

    .message {
        display: flex;
        justify-content: flex-start;
        margin-bottom: $sp2;

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
            transition: opacity 200ms ease-in-out;
            display: flex;
            opacity: 0;
            padding: 0 $sp3;
            justify-content: center;
            align-items: center;

            @include mobile() {
                opacity: 0.3;
            }
        }

        &:hover .actions {
            opacity: 1;
        }
    }

    .message-bubble {
        $radius: $sp3;
        $inner-radius: 4px;
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 300ms, transform ease-in-out 200ms;
        position: relative;
        padding: toRem(8) toRem(12) toRem(8) toRem(12);
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        max-width: 80%;
        min-width: 90px;
        overflow: hidden;
        overflow-wrap: break-word;

        @include size-above(xl) {
            max-width: 70%;
        }

        &.thread {
            max-width: 90%;
        }

        &.proposal {
            max-width: 800px;
            width: 100%;
        }

        .username {
            color: inherit;
            color: var(--txt);
            display: inline;

            &.fill,
            &.crypto {
                color: #fff;
            }

            &.diamond {
                @include diamond();
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
            overflow: hidden;
            border: none;
            line-height: 0;
        }

        &.focused {
            box-shadow: 0 0 0 4px var(--notificationBar-bg);
        }

        &.editing {
            box-shadow: 0 0 0 4px var(--notificationBar-bg);
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

        &.prizeWinner {
            // background-color: var(--prize);
        }
    }

    .username {
        margin: 0;
        color: #fff;
    }

    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);

        .close-emoji {
            flex: 0 0 20px;
        }
    }
</style>
