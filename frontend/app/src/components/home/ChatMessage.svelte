<svelte:options immutable />

<script lang="ts">
    import Link from "../Link.svelte";
    import { fade } from "svelte/transition";
    import {
        AvatarSize,
        type CreatedUser,
        type Message,
        type EnhancedReplyContext,
        type Dimensions,
        type MessageContent,
        OpenChat,
        type UserSummary,
        type MessageReminderCreatedContent,
        type ChatIdentifier,
        type ChatType,
        routeForMessage,
        translationStore,
        chatListScopeStore as chatListScope,
        undeletingMessagesStore,
        currentCommunityMembers as communityMembers,
        currentChatMembersMap as chatMembersMap,
        currentChatBlockedUsers,
        type BotMessageContext as BotMessageContextType,
        ephemeralMessages,
    } from "openchat-client";
    import { isTouchOnlyDevice } from "../../utils/devices";
    import EmojiPicker from "./EmojiPicker.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Typing from "../Typing.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import Translatable from "../Translatable.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { now } from "../../stores/time";
    import { createEventDispatcher, getContext, onDestroy, onMount, tick } from "svelte";
    import { dclickReply } from "../../stores/settings";
    import EmoticonOutline from "svelte-material-icons/EmoticonOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import UnresolvedReply from "./UnresolvedReply.svelte";
    import { mobileWidth, ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import TimeAndTicks from "./TimeAndTicks.svelte";
    import { iconSize } from "../../stores/iconSize";
    import MessageReaction from "./MessageReaction.svelte";
    import ThreadSummary from "./ThreadSummary.svelte";
    import { pageReplace, pathParams } from "../../routes";
    import { canShareMessage } from "../../utils/share";
    import ChatMessageMenu from "./ChatMessageMenu.svelte";
    import { toastStore } from "../../stores/toast";
    import ReminderBuilder from "./ReminderBuilder.svelte";
    import ReportMessage from "./ReportMessage.svelte";
    import { longpress } from "../../actions/longpress";
    import TipBuilder from "./TipBuilder.svelte";
    import TipThumbnail from "./TipThumbnail.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import { filterRightPanelHistory } from "../../stores/rightPanel";
    import { removeQueryStringParam } from "../../utils/urls";
    import IntersectionObserverComponent from "./IntersectionObserver.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import WithRole from "./profile/WithRole.svelte";
    import RoleIcon from "./profile/RoleIcon.svelte";
    import Badges from "./profile/Badges.svelte";
    import BotMessageContext from "../bots/BotMessageContext.svelte";
    import BotProfile, { type BotProfileProps } from "../bots/BotProfile.svelte";
    import { quickReactions } from "../../stores/quickReactions";
    import EphemeralNote from "./EphemeralNote.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatId: ChatIdentifier;
    export let chatType: ChatType;
    export let user: CreatedUser;
    export let sender: UserSummary | undefined;
    export let msg: Message;
    export let me: boolean;
    export let eventIndex: number;
    export let timestamp: bigint;
    export let expiresAt: number | undefined;
    export let first: boolean;
    export let last: boolean;
    export let accepted: boolean;
    export let confirmed: boolean;
    export let failed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let readonly: boolean;
    export let pinned: boolean;
    export let canPin: boolean;
    export let canBlockUsers: boolean;
    export let canDelete: boolean;
    export let canQuoteReply: boolean;
    export let canReact: boolean;
    export let publicGroup: boolean;
    export let editing: boolean;
    export let canStartThread: boolean;
    export let senderTyping: boolean;
    export let dateFormatter: (date: Date) => string = (date) => client.toShortTimeString(date);
    export let collapsed: boolean = false;
    export let threadRootMessage: Message | undefined;
    export let botContext: BotMessageContextType | undefined;

    // this is not to do with permission - some messages (namely thread root messages) will simply not support replying or editing inside a thread
    export let supportsEdit: boolean;
    export let supportsReply: boolean;

    let msgElement: HTMLElement;
    let msgBubbleWrapperElement: HTMLElement;
    let msgBubbleElement: HTMLElement;
    let multiUserChat = chatType === "group_chat" || chatType === "channel";
    let showEmojiPicker = false;
    let debug = false;
    let crypto =
        msg.content.kind === "crypto_content" ||
        msg.content.kind === "prize_content" ||
        msg.content.kind === "p2p_swap_content";
    let showRemindMe = false;
    let showReport = false;
    let messageMenu: ChatMessageMenu;
    let tipping: string | undefined = undefined;
    let percentageExpired = 100;
    let mediaCalculatedHeight = undefined as number | undefined;
    let msgBubbleCalculatedWidth = undefined as number | undefined;
    let botProfile: BotProfileProps | undefined = undefined;

    $: maxWidthFraction = $screenWidth === ScreenWidth.ExtraLarge ? 0.7 : 0.8;
    $: canTip = !me && confirmed && !inert && !failed;
    $: inThread = threadRootMessage !== undefined;
    $: threadRootMessageIndex =
        threadRootMessage?.messageId === msg.messageId
            ? undefined
            : threadRootMessage?.messageIndex;
    $: mediaDimensions = extractDimensions(msg.content);
    $: fill = client.fillMessage(msg);
    $: showAvatar = $screenWidth !== ScreenWidth.ExtraExtraSmall;
    $: translated = $translationStore.has(msg.messageId);
    $: threadSummary = msg.thread;
    $: msgUrl = `${routeForMessage($chatListScope.kind, { chatId }, msg.messageIndex)}?open=true`;
    $: isProposal = msg.content.kind === "proposal_content";
    $: isPrize = msg.content.kind === "prize_content";
    $: isP2PSwap = msg.content.kind === "p2p_swap_content";
    $: inert =
        msg.content.kind === "deleted_content" ||
        msg.content.kind === "blocked_content" ||
        collapsed;
    $: canEdit =
        me && supportsEdit && !msg.deleted && client.contentTypeSupportsEdit(msg.content.kind);
    $: undeleting = $undeletingMessagesStore.has(msg.messageId);
    $: showChatMenu = (!inert || canRevealDeleted || canRevealBlocked) && !readonly && !ephemeral;
    $: canUndelete = msg.deleted && msg.content.kind !== "deleted_content";
    $: senderDisplayName = client.getDisplayName(sender, $communityMembers);
    $: messageContext = { chatId, threadRootMessageIndex };
    $: tips = msg.tips ? Object.entries(msg.tips) : [];
    $: canBlockUser = canBlockUsers && !$currentChatBlockedUsers.has(msg.sender);
    $: canRevealBlocked = msg.content.kind === "blocked_content";
    $: deletedByMe = msg.content.kind === "deleted_content" && msg.content.deletedBy == user.userId;
    $: permanentlyDeleted =
        deletedByMe &&
        me &&
        msg.content.kind === "deleted_content" &&
        Number(msg.content.timestamp) < $now - 5 * 60 * 1000;
    $: canRevealDeleted = deletedByMe && !undeleting && !permanentlyDeleted;
    $: edited = msg.edited && !botContext?.finalised;
    $: ephemeral = $ephemeralMessages.get(messageContext)?.has(msg.messageId) ?? false;

    onMount(() => {
        if (!readByMe) {
            tick().then(() => {
                if (observer !== undefined) {
                    observer.observe(msgElement);
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
                    filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
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
                    toastStore.showSuccessToast(i18nKey("reminders.cancelSuccess"));
                } else {
                    toastStore.showFailureToast(i18nKey("reminders.cancelFailure"));
                }
            });
    }

    function editMessage() {
        if (canEdit) {
            dispatch("editMessage");
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

    function tipMessage(ev: CustomEvent<string>) {
        tipping = ev.detail;
    }

    function selectReaction(ev: CustomEvent<string>) {
        toggleReaction(false, ev.detail);
    }

    function selectQuickReaction(unicode: string) {
        toggleReaction(true, unicode);
    }

    function toggleReaction(isQuickReaction: boolean, reaction: string) {
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
                    user.displayName,
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

        const messageWrapperWidth = msgBubbleWrapperElement.parentElement?.offsetWidth ?? 0;

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

    function registerVote(ev: CustomEvent<{ answerIndex: number; type: "register" | "delete" }>) {
        if (chatId.kind === "direct_chat") return;

        client
            .registerPollVote(
                chatId,
                threadRootMessageIndex,
                msg.messageId,
                msg.messageIndex,
                ev.detail.answerIndex,
                ev.detail.type,
            )
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("poll.voteFailed"));
                }
            });
    }

    $: canShare = canShareMessage(msg.content);
    $: canForward = client.canForward(msg.content);
    $: canTranslate = (client.getMessageText(msg.content) ?? "").length > 0;

    function reportMessage() {
        showReport = true;
    }

    function remindMe() {
        showRemindMe = true;
    }
</script>

<svelte:window on:resize={recalculateMediaDimensions} />

{#if botProfile !== undefined}
    <BotProfile {...botProfile} />
{/if}

{#if tipping !== undefined}
    <TipBuilder
        ledger={tipping}
        on:close={() => (tipping = undefined)}
        {msg}
        {messageContext}
        {user} />
{/if}

{#if showEmojiPicker && canReact}
    <Overlay on:close={() => (showEmojiPicker = false)} dismissible>
        <ModalContent hideFooter hideHeader fill>
            <span slot="body">
                <div class="emoji-header">
                    <h4><Translatable resourceKey={i18nKey("chooseReaction")} /></h4>
                    <span
                        title={$_("close")}
                        class="close-emoji"
                        on:click={() => (showEmojiPicker = false)}>
                        <HoverIcon>
                            <Close size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                </div>
                <EmojiPicker
                    on:emojiSelected={selectReaction}
                    on:skintoneChanged={(ev) => quickReactions.reload(ev.detail)}
                    mode={"reaction"} />
            </span>
            <span slot="footer" />
        </ModalContent>
    </Overlay>
{/if}

{#if showRemindMe}
    <ReminderBuilder
        {chatId}
        {eventIndex}
        {threadRootMessageIndex}
        on:close={() => (showRemindMe = false)} />
{/if}

{#if showReport}
    <ReportMessage
        {threadRootMessageIndex}
        messageId={msg.messageId}
        {chatId}
        {canDelete}
        on:close={() => (showReport = false)} />
{/if}

{#if expiresAt === undefined || percentageExpired < 100}
    <div out:fade|local={{ duration: 1000 }} class="message-wrapper" class:last>
        {#if botContext !== undefined && botContext.command !== undefined}
            <div class="bot-context">
                <BotMessageContext
                    botName={senderDisplayName}
                    botCommand={botContext.command}
                    finalised={botContext.finalised} />
            </div>
        {/if}
        <IntersectionObserverComponent let:intersecting>
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
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div class="avatar" on:click={openUserProfile}>
                                <Avatar
                                    url={client.userAvatarUrl(sender)}
                                    userId={msg.sender}
                                    bot={sender?.kind === "bot"}
                                    size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
                            </div>
                        {/if}
                    </div>
                {/if}

                <div
                    bind:this={msgBubbleWrapperElement}
                    class="bubble-wrapper"
                    style={`--max-width: ${maxWidthFraction * 100}%; ${
                        msgBubbleCalculatedWidth !== undefined
                            ? `flex: 0 0 ${msgBubbleCalculatedWidth}px`
                            : undefined
                    }`}
                    class:p2pSwap={isP2PSwap}
                    class:proposal={isProposal && !inert}>
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        bind:this={msgBubbleElement}
                        on:dblclick={doubleClickMessage}
                        use:longpress={() => messageMenu?.showMenu()}
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
                        class:bot={botContext !== undefined}
                        class:thread={inThread}
                        class:rtl={$rtlStore}>
                        {#if first && !isProposal && !isPrize}
                            <div class="sender" class:fill class:rtl={$rtlStore}>
                                <Link underline={"never"} on:click={openUserProfile}>
                                    <h4 class="username" class:fill class:crypto>
                                        {senderDisplayName}
                                    </h4>
                                    <Badges
                                        uniquePerson={sender?.isUniquePerson}
                                        diamondStatus={sender?.diamondStatus}
                                        streak={client.getStreak(sender?.userId)} />
                                    {#if sender !== undefined && multiUserChat}
                                        <WithRole
                                            userId={sender.userId}
                                            chatMembers={$chatMembersMap}
                                            communityMembers={$communityMembers}
                                            let:chatRole
                                            let:communityRole>
                                            <RoleIcon
                                                level="community"
                                                popup
                                                role={communityRole} />
                                            <RoleIcon
                                                level={chatType === "channel" ? "channel" : "group"}
                                                popup
                                                role={chatRole} />
                                        </WithRole>
                                    {/if}
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
                                    {readonly}
                                    {chatId}
                                    {intersecting}
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
                            {messageContext}
                            {collapsed}
                            {undeleting}
                            {intersecting}
                            {failed}
                            {timestamp}
                            messageIndex={msg.messageIndex}
                            messageId={msg.messageId}
                            myUserId={user.userId}
                            content={msg.content}
                            {edited}
                            height={mediaCalculatedHeight}
                            blockLevelMarkdown={msg.blockLevelMarkdown}
                            on:removePreview
                            on:registerVote={registerVote}
                            on:upgrade
                            on:verifyHumanity
                            on:claimDailyChit
                            on:startVideoCall
                            on:expandMessage />

                        {#if !inert && !isPrize}
                            <TimeAndTicks
                                {pinned}
                                {fill}
                                {timestamp}
                                {expiresAt}
                                {percentageExpired}
                                {me}
                                {accepted}
                                {failed}
                                deleted={msg.deleted}
                                {undeleting}
                                {readByThem}
                                {crypto}
                                {chatType}
                                {dateFormatter} />
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
                            <pre>botContext: {JSON.stringify(botContext, null, 4)}</pre>
                            <pre>inert: {inert}</pre>
                            <pre>canRevealDeleted: {canRevealDeleted}</pre>
                            <pre>canlRevealBlocked: {canRevealBlocked}</pre>
                            <pre>readonly: {readonly}</pre>
                            <pre>showChatMenu: {showChatMenu}</pre>
                            <pre>intersecting: {intersecting}</pre>
                            <pre>ephemeral: {ephemeral}</pre>
                        {/if}
                    </div>

                    {#if showChatMenu && intersecting}
                        <ChatMessageMenu
                            bind:this={messageMenu}
                            {chatId}
                            {isProposal}
                            {inert}
                            {publicGroup}
                            {confirmed}
                            {failed}
                            {canShare}
                            {me}
                            {canPin}
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
                            {canReact}
                            on:collapseMessage
                            on:forward
                            on:reply={reply}
                            on:retrySend
                            on:upgrade
                            on:initiateThread
                            on:deleteFailedMessage
                            on:replyPrivately={replyPrivately}
                            on:editMessage={editMessage}
                            on:tipMessage={tipMessage}
                            on:reportMessage={reportMessage}
                            on:cancelReminder={cancelReminder}
                            on:remindMe={remindMe} />
                    {/if}

                    {#if ephemeral}
                        <EphemeralNote />
                    {/if}
                </div>

                {#if !collapsed && !msg.deleted && canReact && !failed}
                    <div class="actions" class:touch={isTouchOnlyDevice}>
                        <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                            <HoverIcon>
                                <EmoticonOutline size={$iconSize} color={"var(--icon-txt)"} />
                            </HoverIcon>
                        </div>
                    </div>
                {/if}
            </div>

            {#if threadSummary !== undefined && !inThread}
                <ThreadSummary
                    {chatId}
                    threadRootMessageIndex={msg.messageIndex}
                    selected={($pathParams.kind === "global_chat_selected_route" ||
                        $pathParams.kind === "selected_channel_route") &&
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
                            on:click={() => toggleReaction(false, reaction)}
                            {reaction}
                            {userIds}
                            myUserId={user?.userId} />
                    {/each}
                </div>
            {/if}

            {#if tips.length > 0 && !inert}
                <div class="tips" class:indent={showAvatar}>
                    {#each tips as [ledger, userTips]}
                        <TipThumbnail on:click={tipMessage} {canTip} {ledger} {userTips} />
                    {/each}
                </div>
            {/if}
        </IntersectionObserverComponent>
    </div>
{/if}

<style lang="scss">
    $size: 10px;

    $avatar-width: toRem(56);
    $avatar-width-mob: toRem(43);

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

    .message-reactions,
    .tips {
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
            box-shadow ease-in-out 200ms,
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
