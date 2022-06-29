<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "../../domain/user/user";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Loading from "../Loading.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import type { Message, EnhancedReplyContext } from "../../domain/chat/chat";
    import Typing from "../Typing.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import { _, locale } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { afterUpdate, createEventDispatcher, onDestroy, onMount } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import EmoticonLolOutline from "svelte-material-icons/EmoticonLolOutline.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import TranslateIcon from "svelte-material-icons/Translate.svelte";
    import TranslateOff from "svelte-material-icons/TranslateOff.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import PinOff from "svelte-material-icons/PinOff.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import { containsSocialVideoLink, fillMessage, isSocialVideoLink } from "../../utils/media";
    import UnresolvedReply from "./UnresolvedReply.svelte";
    import { mobileWidth, ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import TimeAndTicks from "./TimeAndTicks.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { Dimensions } from "../../utils/media";
    import type { MessageContent } from "../../domain/chat/chat";
    import { calculateMediaDimensions } from "../../utils/layout";
    import MessageReaction from "./MessageReaction.svelte";
    import Reload from "../Reload.svelte";
    import ViewUserProfile from "./profile/ViewUserProfile.svelte";
    import { userAvatarUrl } from "../../domain/user/user.utils";
    import * as shareFunctions from "../../domain/share";
    import { userStore } from "../../stores/user";
    import { translationCodes } from "../../i18n/i18n";
    import { toastStore } from "stores/toast";
    import { storageStore } from "../../stores/storage";
    import { translationStore } from "../../stores/translation";
    import { typing } from "../../stores/typing";
    import { canForward } from "../../domain/chat/chat.utils";
    import ThreadSummary from "./ThreadSummary.svelte";

    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: UserSummary;
    export let senderId: string;
    export let msg: Message;
    export let me: boolean;
    export let eventIndex: number;
    export let timestamp: bigint;
    export let first: boolean;
    export let last: boolean;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let preview: boolean;
    export let pinned: boolean;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canSend: boolean;
    export let canReact: boolean;
    export let publicGroup: boolean;
    export let editing: boolean;
    export let selectedThreadMessageIndex: number | undefined;
    export let inThread: boolean;

    let msgElement: HTMLElement;
    let msgBubbleElement: HTMLElement;
    let groupChat = chatType === "group_chat";
    let showEmojiPicker = false;
    let debug = false;
    let viewProfile = false;
    let alignProfileTo: DOMRect | undefined = undefined;
    let crypto = msg.content.kind === "crypto_content";
    let poll = msg.content.kind === "poll_content";

    $: canEdit = !crypto && !poll && me;
    $: sender = $userStore[senderId];
    $: isBot = $userStore[senderId]?.kind === "bot";
    $: username = sender?.username;
    $: mediaDimensions = extractDimensions(msg.content);
    $: mediaCalculatedHeight = undefined as number | undefined;
    $: msgBubbleCalculatedWidth = undefined as number | undefined;
    $: deleted = msg.content.kind === "deleted_content";
    $: fill = fillMessage(msg);
    $: showAvatar = !me && $screenWidth !== ScreenWidth.ExtraExtraSmall && groupChat;
    $: translated = $translationStore.has(Number(msg.messageId));
    $: senderTyping = $typing[chatId]?.has(senderId);
    $: threadSummary = msg.thread;

    afterUpdate(() => {
        // console.log("updating ChatMessage component");

        if (readByMe) {
            observer?.unobserve(msgElement);
        }
    });

    onMount(() => {
        if (!me && !readByMe) {
            // todo - leaving this console log here for now just to make sure we are not *over* observing
            console.log("beginning to observe: ", msg.messageIndex);
            observer?.observe(msgElement);
        }

        recalculateMediaDimensions();
    });

    onDestroy(() => observer?.unobserve(msgElement));

    function chatWithUser() {
        dispatch("chatWith", senderId);
    }

    function createReplyContext(): EnhancedReplyContext {
        return {
            kind: "rehydrated_reply_context",
            senderId,
            chatId: chatId,
            eventIndex: eventIndex,
            content: msg.content,
            sender,
            messageId: msg.messageId,
            messageIndex: msg.messageIndex,
            edited: msg.edited,
        };
    }

    function pinMessage() {
        dispatch("pinMessage", msg);
    }

    function unpinMessage() {
        dispatch("unpinMessage", msg);
    }

    function reply() {
        dispatch("replyTo", createReplyContext());
    }

    // this is called if we are starting a new thread so we pass undefined as the threadSummary param
    function replyInThread() {
        dispatch("replyInThread");
    }

    function forward() {
        dispatch("forward", msg);
    }

    function replyPrivately() {
        dispatch("replyPrivatelyTo", createReplyContext());
    }

    function deleteMessage() {
        dispatch("deleteMessage", msg);
    }

    function untranslateMessage() {
        translationStore.untranslate(msg.messageId);
    }

    function translateMessage() {
        if ($storageStore.byteLimit === 0) {
            dispatch("upgrade", "premium");
        } else {
            if (msg.content.kind === "text_content") {
                const params = new URLSearchParams();
                params.append("q", msg.content.text);
                params.append("target", translationCodes[$locale || "en"] || "en");
                params.append("format", "text");
                params.append("key", process.env.PUBLIC_TRANSLATE_API_KEY!);
                fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, {
                    method: "POST",
                })
                    .then((resp) => resp.json())
                    .then(({ data: { translations } }) => {
                        if (
                            msg.content.kind === "text_content" &&
                            Array.isArray(translations) &&
                            translations.length > 0
                        ) {
                            translationStore.translate(
                                msg.messageId,
                                translations[0].translatedText
                            );
                        }
                    })
                    .catch((_err) => {
                        toastStore.showFailureToast("unableToTranslate");
                    });
            }
        }
    }

    function editMessage() {
        if (canEdit) {
            dispatch("editMessage");
        }
    }

    function selectReaction(ev: CustomEvent<string>) {
        toggleReaction(ev.detail);
    }

    function toggleReaction(reaction: string) {
        if (canReact) {
            dispatch("selectReaction", {
                message: msg,
                reaction,
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
            (isSocialVideoLink(content.text) || containsSocialVideoLink(content.text))
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

        let targetMediaDimensions = calculateMediaDimensions(
            mediaDimensions,
            parentWidth,
            msgBubblePaddingWidth,
            window.innerHeight,
            $screenWidth === ScreenWidth.ExtraLarge ? 0.7 : 0.8
        );
        mediaCalculatedHeight = targetMediaDimensions.height;
        msgBubbleCalculatedWidth = targetMediaDimensions.width + msgBubblePaddingWidth;
    }

    function blockUser() {
        dispatch("blockUser", { userId: senderId });
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
        dispatch("registerVote", {
            ...ev.detail,
            messageIndex: msg.messageIndex,
        });
    }

    function canShare(): boolean {
        return shareFunctions.canShareMessage(msg.content);
    }

    function shareMessage() {
        shareFunctions.shareMessage(user.userId, me, msg);
    }

    function copyMessageUrl() {
        shareFunctions.copyMessageUrl(chatId, msg.messageIndex);
    }
</script>

<svelte:window on:resize={recalculateMediaDimensions} />

{#if showEmojiPicker && canReact}
    <Overlay on:close={() => (showEmojiPicker = false)} dismissible={true}>
        <ModalContent hideFooter={true} hideHeader={true} fill={true}>
            <span slot="body">
                {#await import("./EmojiPicker.svelte")}
                    <div class="loading-emoji"><Loading /></div>
                {:then picker}
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
                    <svelte:component
                        this={picker.default}
                        on:emojiSelected={selectReaction}
                        mode={"reaction"} />
                {:catch _error}
                    <Reload>{$_("unableToLoadEmojiPicker")}</Reload>
                {/await}
            </span>
            <span slot="footer" />
        </ModalContent>
    </Overlay>
{/if}

{#if viewProfile}
    <ViewUserProfile
        alignTo={alignProfileTo}
        userId={sender.userId}
        on:openDirectChat={chatWithUser}
        on:close={closeUserProfile} />
{/if}

<div class="message-wrapper" class:last>
    <div
        bind:this={msgElement}
        class="message"
        class:me
        data-index={msg.messageIndex}
        data-id={msg.messageId}
        id={`event-${eventIndex}`}>
        {#if me && !deleted && canReact}
            <div class="actions">
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={$iconSize} color={"#fff"} />
                    </HoverIcon>
                </div>
            </div>
        {/if}

        {#if showAvatar}
            <div class="avatar-col">
                {#if first}
                    <div class="avatar" on:click={openUserProfile}>
                        <Avatar
                            url={userAvatarUrl(sender)}
                            size={$mobileWidth ? AvatarSize.Tiny : AvatarSize.Small} />
                    </div>
                {/if}
            </div>
        {/if}

        <div
            bind:this={msgBubbleElement}
            style={msgBubbleCalculatedWidth !== undefined
                ? `width: ${msgBubbleCalculatedWidth}px`
                : undefined}
            on:dblclick={editMessage}
            class="message-bubble"
            class:bot={isBot}
            class:focused
            class:editing
            class:fill={fill && !deleted}
            class:me
            class:deleted
            class:first
            class:last
            class:readByMe
            class:crypto
            class:rtl={$rtlStore}>
            {#if first && !me && groupChat}
                <div class="sender" class:fill class:rtl={$rtlStore}>
                    <Link underline={"hover"} on:click={openUserProfile}>
                        <h4 class="username" class:fill class:crypto>{username}</h4>
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
                                : "var(--currentChat-msg-muted)"}
                            slot="icon" />
                    </div>
                    <div class="text">{"Forwarded"}</div>
                </div>
            {/if}
            {#if msg.repliesTo !== undefined && !deleted}
                {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                    <RepliesTo
                        {preview}
                        {chatId}
                        {groupChat}
                        on:goToMessageIndex
                        repliesTo={msg.repliesTo} />
                {:else}
                    <UnresolvedReply on:goToMessage repliesTo={msg.repliesTo} />
                {/if}
            {/if}

            <ChatMessageContent
                {preview}
                {fill}
                {me}
                {first}
                {groupChat}
                {senderId}
                messageId={msg.messageId}
                myUserId={user.userId}
                content={msg.content}
                edited={msg.edited}
                height={mediaCalculatedHeight}
                on:registerVote={registerVote} />

            {#if !deleted}
                <TimeAndTicks
                    {pinned}
                    {fill}
                    {timestamp}
                    {me}
                    {confirmed}
                    {readByThem}
                    {crypto}
                    {chatType} />
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
                <pre>thread: {JSON.stringify(msg.thread, null, 4)}</pre>
            {/if}

            {#if !deleted && !preview}
                <div class="menu" class:rtl={$rtlStore}>
                    <MenuIcon>
                        <div class="menu-icon" slot="icon">
                            <HoverIcon compact={true}>
                                <ChevronDown size="1.6em" color={me ? "#fff" : "var(--icon-txt)"} />
                            </HoverIcon>
                        </div>
                        <div slot="menu">
                            <Menu>
                                {#if publicGroup && confirmed && !inThread}
                                    {#if canShare()}
                                        <MenuItem on:click={shareMessage}>
                                            <ShareIcon
                                                size={$iconSize}
                                                color={"var(--icon-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("share")}</div>
                                        </MenuItem>
                                    {/if}
                                    <MenuItem on:click={copyMessageUrl}>
                                        <ContentCopy
                                            size={$iconSize}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("copyMessageUrl")}</div>
                                    </MenuItem>
                                {/if}
                                {#if confirmed && canPin && !inThread}
                                    {#if pinned}
                                        <MenuItem on:click={unpinMessage}>
                                            <PinOff
                                                size={$iconSize}
                                                color={"var(--icon-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("unpinMessage")}</div>
                                        </MenuItem>
                                    {:else}
                                        <MenuItem on:click={pinMessage}>
                                            <Pin
                                                size={$iconSize}
                                                color={"var(--icon-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("pinMessage")}</div>
                                        </MenuItem>
                                    {/if}
                                {/if}
                                {#if confirmed && canSend}
                                    <MenuItem on:click={reply}>
                                        <Reply
                                            size={$iconSize}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("reply")}</div>
                                    </MenuItem>
                                    {#if !inThread}
                                        <MenuItem on:click={replyInThread}>
                                            <span class="thread" slot="icon">🧵</span>
                                            <div slot="text">{$_("thread.menu")}</div>
                                        </MenuItem>
                                    {/if}
                                {/if}
                                {#if canForward(msg.content) && !inThread}
                                    <MenuItem on:click={forward}>
                                        <ForwardIcon
                                            size={$iconSize}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("forward")}</div>
                                    </MenuItem>
                                {/if}
                                {#if confirmed && groupChat && !me && !inThread}
                                    <MenuItem on:click={replyPrivately}>
                                        <ReplyOutline
                                            size={$iconSize}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("replyPrivately")}</div>
                                    </MenuItem>
                                    {#if canBlockUser}
                                        <MenuItem on:click={blockUser}>
                                            <Cancel
                                                size={$iconSize}
                                                color={"var(--icon-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("blockUser")}</div>
                                        </MenuItem>
                                    {/if}
                                {/if}
                                {#if canEdit}
                                    <MenuItem on:click={editMessage}>
                                        <PencilOutline
                                            size={$iconSize}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("editMessage")}</div>
                                    </MenuItem>
                                {/if}
                                {#if (canDelete || me) && !crypto}
                                    <MenuItem on:click={deleteMessage}>
                                        <DeleteOutline
                                            size={$iconSize}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("deleteMessage")}</div>
                                    </MenuItem>
                                {/if}
                                {#if msg.content.kind === "text_content"}
                                    {#if translated}
                                        <MenuItem on:click={untranslateMessage}>
                                            <TranslateOff
                                                size={$iconSize}
                                                color={"var(--icon-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("untranslateMessage")}</div>
                                        </MenuItem>
                                    {:else}
                                        <MenuItem on:click={translateMessage}>
                                            <TranslateIcon
                                                size={$iconSize}
                                                color={"var(--icon-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("translateMessage")}</div>
                                        </MenuItem>
                                    {/if}
                                {/if}
                            </Menu>
                        </div>
                    </MenuIcon>
                </div>
            {/if}
        </div>

        {#if !me && !deleted && canReact}
            <div class="actions">
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={$iconSize} color={"#fff"} />
                    </HoverIcon>
                </div>
            </div>
        {/if}
    </div>

    {#if threadSummary !== undefined && !inThread}
        <ThreadSummary
            selected={msg.messageIndex === selectedThreadMessageIndex}
            {threadSummary}
            indent={showAvatar}
            {me}
            on:replyInThread />
    {/if}

    {#if msg.reactions.length > 0 && !deleted}
        <div class="message-reactions" class:me class:indent={showAvatar}>
            {#each msg.reactions as { reaction, userIds } (reaction)}
                <MessageReaction
                    on:click={() => toggleReaction(reaction)}
                    {reaction}
                    {userIds}
                    {me}
                    myUserId={user?.userId} />
            {/each}
        </div>
    {/if}
</div>

<style type="text/scss">
    $size: 10px;

    $avatar-width: 53px;
    $avatar-width-mob: 43px;

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

    :global(.message-bubble.me a) {
        color: inherit;
    }

    :global(.message-bubble.crypto a) {
        color: inherit;
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

    :global(.actions .reaction .wrapper) {
        padding: 6px;
    }

    .thread {
        @include font(bold, normal, fs-110);
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
            padding: $sp2 $sp4;
            border-radius: 0 0 $sp4 0;

            &.rtl {
                right: 0;
                border-radius: 0 0 0 $sp4;
            }
        }

        .typing {
            color: var(--accent);
        }
    }

    .menu {
        $offset: -2px;
        position: absolute;
        top: -4px;
        right: $offset;

        &.rtl {
            left: $offset;
            right: unset;
        }
    }

    .menu-icon {
        transition: opacity ease-in-out 200ms;
        opacity: 0;
    }

    .message-reactions {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;

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

    .message {
        display: flex;
        justify-content: flex-start;
        margin-bottom: $sp2;

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
        $radius: $sp4;
        $inner-radius: 4px;
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 300ms, transform ease-in-out 200ms;
        position: relative;
        padding: toRem(6) toRem(8) toRem(6) toRem(8);
        border: 1px solid var(--currentChat-msg-bd);
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        max-width: 80%;
        min-width: 90px;
        overflow: hidden;

        @include size-above(xl) {
            max-width: 70%;
        }

        .username {
            color: inherit;
            color: var(--accent);
            display: inline;

            &.fill,
            &.crypto {
                color: #fff;
            }
        }

        &:hover {
            .menu-icon {
                opacity: 1;
            }
        }

        &:not(.readByMe) {
            box-shadow: 0 0 0 5px var(--toast-success-bg);
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
            border-color: var(--currentChat-msg-me-bd);

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

        &.crypto {
            @include gold();
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

            &.me {
                &.last:not(.first) {
                    border-radius: $inner-radius $radius $radius $radius;
                }
                &.first:not(.last) {
                    border-radius: $radius $radius $radius $inner-radius;
                }
                &:not(.first):not(.last) {
                    border-radius: $inner-radius $radius $radius $inner-radius;
                }
            }
        }

        &.fill {
            padding: 0;
            overflow: hidden;
            border: none;
            line-height: 0;
        }

        &.focused {
            box-shadow: 0 0 0 4px var(--toast-success-bg);
        }

        &.editing {
            box-shadow: 0 0 0 4px var(--toast-success-bg);
        }

        &.deleted {
            opacity: 0.8;
        }

        &.bot {
            font-family: courier;
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
    }

    .username {
        margin: 0;
        @include font(bold, normal, fs-100);
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
