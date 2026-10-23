<script lang="ts">
    import { navigate } from "@utils/navigation";
    import { confirmMessageDeletion } from "@src/stores/settings";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { keyboard } from "@stores/keyboard.svelte";
    import { popHistoryStateWithAction, pushDummyHistoryState } from "@utils/history";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import {
        Avatar,
        Column,
        Container,
        MenuTrigger,
        type PanDirection,
        Sheet,
    } from "component-lib";
    import {
        type ChatIdentifier,
        chatIdentifiersEqual,
        chatListScopeStore,
        type ChatType,
        currentUserIdStore,
        currentUserStore,
        allUsersStore,
        BRIDGE_PLATFORM_NAMES,
        bridgedFrom,
        bridgedUserKey,
        bridgedUsersStore,
        type EnhancedReplyContext,
        linkedAuthor,
        localUpdates,
        type Member,
        type Message,
        type MessageReminderCreatedContent,
        OpenChat,
        publish,
        routeForMessage,
        screenWidth,
        ScreenWidth,
        selectedChatBlockedUsersStore,
        selectedChatMembersStore,
        selectedServerChatStore,
        type SelectedEmoji,
        type SenderContext,
        shouldShowAsMe,
        tipRecipient,
        translationsStore,
        unconfirmedReadByThem,
        undeletingMessagesStore,
        type UserSummary,
    } from "@client";
    import { getContext, onDestroy, onMount, tick } from "svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SquareEditOutline from "svelte-material-icons/SquareEditOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { quickReactions } from "../../stores/quickReactions";
    import { scrollStatus } from "../../stores/scroll.svelte";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { messageSwipeAction } from "../../utils/messageSwipe";
    import { canShareMessage } from "../../utils/share";
    import { removeQueryStringParam } from "../../utils/urls";
    import { BRIDGE_PLATFORM_ICONS } from "@src/utils/bridgedAccounts";
    import AreYouSure from "../AreYouSure.svelte";
    import BotMessageContext from "../bots/BotMessageContext.svelte";
    import BotProfile, { type BotProfileProps } from "../bots/BotProfile.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import ChatMessageMenu from "./ChatMessageMenu.svelte";
    import ChatMessageOptions from "./ChatMessageOptions.svelte";
    import EmojiPicker from "./EmojiPickerWrapper.svelte";
    import IntersectionObserverComponent from "./IntersectionObserver.svelte";
    import MessageBubble from "./message/MessageBubble.svelte";
    import Reactions from "./message/Reactions.svelte";
    import ThreadSummary from "./message/ThreadSummary.svelte";
    import Tips from "./message/Tips.svelte";
    import ReminderBuilder from "./ReminderBuilder.svelte";
    import RepliesTo from "./RepliesTo.svelte";
    import ReportMessage from "./ReportMessage.svelte";
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
        canTipMessages: boolean;
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
        disablePan?: boolean;
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
        canTipMessages,
        publicGroup,
        canStartThread,
        senderTyping,
        collapsed = false,
        threadRootMessage,
        senderContext,
        onExpandMessage = undefined,
        supportsEdit,
        supportsReply,
        disablePan = false,
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

    const multiUserChat = chatType === "group_chat" || chatType === "channel";
    let showEmojiPicker = $state(false);
    const debug = false;
    let showRemindMe = $state(false);
    let showReport = $state(false);
    let tipping: string | undefined = $state(undefined);
    let percentageExpired = $state(100);
    let botProfile: BotProfileProps | undefined = $state(undefined);
    let confirmedReadByThem = $derived(client.messageIsReadByThem(chatId, msg.messageIndex));
    let readByThem = $derived(confirmedReadByThem || $unconfirmedReadByThem.has(msg.messageId));
    let contentWidth = $state<number>();

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
                    } catch {
                        // the element may already be detached; nothing to observe
                    }
                }
            });
        }
    });

    $effect(() => {
        if (expiresAt === undefined) return;
        const ttl = expiresAt - Number(timestamp);
        const age = $now - Number(timestamp);
        const expired = age > ttl;
        const percentage = expired ? 100 : (age / ttl) * 100;
        percentageExpired = percentage;
        // if this message is the root of a thread, make sure that we close that thread when the message expires
        if (percentage >= 100 && msg.thread) {
            client.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            navigate(removeQueryStringParam("open"));
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
            senderContext,
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
        popHistoryStateWithAction("emoji_picker_action");
    }


    function openUserProfile(ev?: Event) {
        if (sender?.kind === "bot" && linkedUser === undefined) {
            botProfile = {
                botId: sender.userId,
                chatId,
                onClose: () => (botProfile = undefined),
            };
        } else {
            ev?.target?.dispatchEvent(
                new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                    detail: {
                        userId: linkedUser?.userId ?? msg.sender,
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

    let inert = $derived(
        msg.content.kind === "deleted_content" ||
            msg.content.kind === "blocked_content" ||
            msg.content.kind === "restricted_content" ||
            collapsed,
    );
    let bridged = $derived(bridgedFrom(senderContext));
    let bridgedUser = $derived(
        bridged !== undefined ? $bridgedUsersStore.get(bridgedUserKey(bridged)!) : undefined,
    );
    // The OpenChat user who linked the account the message was relayed from, shown as its author
    let linkedUser = $derived(linkedAuthor(bridgedUser, $allUsersStore));
    // Those relayed from the user's own linked account look like their own messages. Editing,
    // deleting, swiping and the menu still go by `me`, as the bridge bot sent them, except for the
    // options aimed at the author.
    let showAsMe = $derived(shouldShowAsMe(me, linkedUser?.userId, $currentUserIdStore));
    // The details held can be for another chat, when a thread preview shows a message from a chat
    // other than the one selected
    let chatMembers = $derived(
        chatIdentifiersEqual($selectedServerChatStore?.chatId, chatId)
            ? $selectedChatMembersStore
            : new Map<string, Member>(),
    );
    // The sender, or for a relayed message whoever linked its account, if they're in the chat. A
    // message relayed from the user's own linked account is shown as theirs, so isn't tipped.
    // Only the members held count. In a chat too big for all of them to be held, the client looks
    // the linked user up among its members, so until they're found the message can't be tipped. Nor
    // can it in a thread preview from another chat, whose members aren't held.
    let tipTo = $derived(tipRecipient(msg, $bridgedUsersStore, (userId) => chatMembers.has(userId)));
    let canTip = $derived(
        canTipMessages &&
            !me &&
            confirmed &&
            !inert &&
            !failed &&
            tipTo !== undefined &&
            tipTo !== $currentUserIdStore,
    );
    let inThread = $derived(threadRootMessage !== undefined);
    let scrollingId = $derived(
        inThread ? "scrollable-list-thread-messages" : "scrollable-list-chat-messages",
    );
    let threadRootMessageIndex = $derived(
        threadRootMessage?.messageId === msg.messageId
            ? undefined
            : threadRootMessage?.messageIndex,
    );
    let fill = $derived(client.fillMessage(msg));
    let showAvatar = $derived(
        chatType !== "direct_chat" && !showAsMe && $screenWidth !== ScreenWidth.ExtraExtraSmall,
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
    // A bot finalises a message it streams by editing it, so that isn't shown as an edit. A bridge
    // bot sends its messages finalised, and only edits them to relay an edit made on the other
    // platform.
    let edited = $derived(
        msg.edited &&
            (senderContext?.kind !== "bot" || !senderContext.finalised || bridged !== undefined),
    );
    let canShare = $derived(canShareMessage(msg.content));
    let canForward = $derived(client.canForward(msg.content));
    let canTranslate = $derived((client.getMessageText(msg.content) ?? "").length > 0);
    let canDeleteMessage = $derived(
        (canDelete || me) &&
            !inert &&
            !(msg.content.kind === "video_call_content" && msg.content.ended === undefined),
    );
    let showConfirmDelete = $state(false);

    let longpressCooldown = $derived(scrollStatus.isCooldown);

    async function deleteMessage(deletionConfirmed: boolean) {
        if (failed) {
            onDeleteFailedMessage?.();
            return;
        }
        if (!canDeleteMessage) return;

        if (!deletionConfirmed) {
            showConfirmDelete = !showConfirmDelete;
            return;
        }

        showConfirmDelete = false;
        await client.deleteMessage(chatId, threadRootMessageIndex, msg.messageId);
    }

    let isSheetMenuOpen = $state(false);

    function openSheetMenu() {
        isSheetMenuOpen = true;
    }

    let panDirection = $state();
    let panFactor = $state(0);

    function forward() {
        window.setTimeout(() => publish("forward", msg), 250);
    }

    function onPanCommit(direction: PanDirection) {
        switch (messageSwipeAction(direction, me, canEdit)) {
            case "edit":
                return editMessage();
            case "forward":
                return forward();
            case "reply":
                return reply();
        }
    }

    function onPanMove(direction: PanDirection, factor: number) {
        panDirection = direction;
        panFactor = factor;
    }

    // Memoised so the action's update() only runs when a field actually changes
    let pan = $derived(
        msg.deleted || disablePan || msg.content.kind === "proposal_content"
            ? undefined
            : {
                  oncommit: onPanCommit,
                  onmove: onPanMove,
                  isScrolling: scrollStatus.isScrolling || scrollStatus.isCooldown,
              },
    );
</script>

{#if botProfile !== undefined}
    <BotProfile {...botProfile} />
{/if}

{#if tipping !== undefined && tipTo !== undefined}
    <TipBuilder
        ledger={tipping}
        onClose={() => (tipping = undefined)}
        {msg}
        {messageContext}
        recipient={tipTo} />
{/if}

{#if showConfirmDelete}
    <AreYouSure action={deleteMessage} dismiss={() => (showConfirmDelete = false)}>
        <Container gap={"lg"} direction={"vertical"}>
            <Translatable resourceKey={i18nKey("deleteMessageConfirm")}></Translatable>
            <Checkbox
                id="dont_show"
                label={i18nKey("install.dontShow")}
                checked={!$confirmMessageDeletion}
                onChange={confirmMessageDeletion.toggle}>
            </Checkbox>
        </Container>
    </AreYouSure>
{/if}

{#if showEmojiPicker && canReact}
    <Sheet
        onDismiss={() => {
            showEmojiPicker = false;
            popHistoryStateWithAction("emoji_picker_action");
        }}>
        <div
            class="emoji_picker_wrapper"
            style:padding-bottom={keyboard.visible ? `${keyboard.currentHeight - 64}px` : "0"}>
            <Column height="fill" overflow="auto" minHeight={keyboard.visible ? "35vh" : "50vh"}>
                <EmojiPicker
                    onEmojiSelected={selectReaction}
                    onSkintoneChanged={(tone) => quickReactions.reload(tone)}
                    supportCustom={true}
                    mode={"reaction"} />
            </Column>
        </div>
    </Sheet>
{/if}

{#if isSheetMenuOpen}
    <Sheet onDismiss={() => (isSheetMenuOpen = false)}>
        <Column gap="sm" padding={["lg", "lg", "xxl", "lg"]} maxHeight="70vh">
            <ChatMessageOptions
                menuType="menu_items"
                {chatId}
                {isProposal}
                {inert}
                {publicGroup}
                {confirmed}
                {failed}
                {canShare}
                {me}
                {showAsMe}
                {canPin}
                {canTip}
                {pinned}
                {supportsReply}
                {canQuoteReply}
                {canStartThread}
                {multiUserChat}
                {threadRootMessage}
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
                {onCollapseMessage}
                onReply={reply}
                {onRetrySend}
                onReplyPrivately={replyPrivately}
                onEditMessage={editMessage}
                onTipMessage={tipMessage}
                onReportMessage={reportMessage}
                onCancelReminder={cancelReminder}
                onDeleteMessage={deleteMessage}
                onRemindMe={remindMe}
                {onDeleteFailedMessage}
                onOptionSelected={() => (isSheetMenuOpen = false)} />
        </Column>
    </Sheet>
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
                overflow={"visible"}
                mainAxisAlignment={showAsMe ? "end" : "start"}
                {pan}>
                {#if showAvatar}
                    <div class:first class="avatar">
                        <Avatar
                            onClick={openUserProfile}
                            url={linkedUser !== undefined
                                ? client.userAvatarUrl(linkedUser)
                                : bridged !== undefined
                                  ? client.bridgedAvatarUrl(bridged, bridgedUser)
                                  : client.userAvatarUrl(sender)}
                            size={"sm"}>
                            {#if bridged !== undefined}
                                <img
                                    class="bridge-badge"
                                    src={BRIDGE_PLATFORM_ICONS[bridged.kind]}
                                    alt={BRIDGE_PLATFORM_NAMES[bridged.kind]} />
                            {/if}
                        </Avatar>
                    </div>
                {/if}
                {@const hasThread = threadSummary !== undefined && !inThread}
                {@const hasReactions = msg.reactions.length > 0}
                {@const hasTips = tips.length > 0}
                <Container
                    supplementalClass={"message_bubble_wrapper"}
                    overflow={"visible"}
                    crossAxisAlignment={showAsMe ? "end" : "start"}
                    width={"hug"}
                    maxWidth={chatId.kind === "direct_chat" ? "78vw" : "75vw"}
                    gap={"xxs"}
                    minWidth={"6rem"}
                    direction={"vertical"}>
                    {#if panDirection && panFactor > 0}
                        <div
                            class={`pan-action ${panDirection}`}
                            class:active={panFactor >= 1}
                            style:opacity={panFactor}>
                            {#if me && canEdit && panDirection === "left"}
                                <SquareEditOutline size="1.5rem" />
                            {:else if !me && canShare && panDirection === "left"}
                                <ShareOutline size="1.5rem" />
                            {:else}
                                <Reply size="1.5rem" />
                            {/if}
                        </div>
                    {/if}
                    <MenuTrigger
                        constrainMask={scrollingId}
                        maskUI
                        disabled={!showChatMenu || !intersecting}
                        mobileMode="longpress"
                        longpressAnimation="scale"
                        position="bottom"
                        customContent={true}
                        {longpressCooldown}>
                        {#snippet menuItems()}
                            {#if showChatMenu && intersecting}
                                <ChatMessageMenu
                                    menuType="icon_buttons"
                                    {chatId}
                                    {isProposal}
                                    {inert}
                                    {publicGroup}
                                    {confirmed}
                                    {failed}
                                    {canShare}
                                    deleted={msg.deleted}
                                    {me}
                                    {showAsMe}
                                    {canReact}
                                    {canPin}
                                    {canTip}
                                    {pinned}
                                    {supportsReply}
                                    {canQuoteReply}
                                    {canStartThread}
                                    {multiUserChat}
                                    {threadRootMessage}
                                    {msg}
                                    {canForward}
                                    {canBlockUser}
                                    {canEdit}
                                    {selectQuickReaction}
                                    {canDelete}
                                    {canUndelete}
                                    {canRevealDeleted}
                                    {canRevealBlocked}
                                    translatable={canTranslate}
                                    {translated}
                                    {onCollapseMessage}
                                    showEmojiPicker={() => {
                                        showEmojiPicker = true;
                                        pushDummyHistoryState("emoji_picker_action");
                                    }}
                                    onReply={reply}
                                    {onRetrySend}
                                    onReplyPrivately={replyPrivately}
                                    onEditMessage={editMessage}
                                    onTipMessage={tipMessage}
                                    onReportMessage={reportMessage}
                                    onCancelReminder={cancelReminder}
                                    onDeleteMessage={deleteMessage}
                                    onRemindMe={remindMe}
                                    onOpenSheetMenu={openSheetMenu}
                                    {onDeleteFailedMessage} />
                            {/if}
                        {/snippet}
                        <MessageBubble
                            {chatId}
                            {focused}
                            {senderTyping}
                            {senderContext}
                            {sender}
                            bind:ref={msgBubbleElement}
                            onOpenUserProfile={openUserProfile}
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
                                    {contentWidth}
                                    {readonly}
                                    {chatId}
                                    {intersecting}
                                    repliesTo={reply} />
                            {/snippet}

                            {#snippet messageContent(me)}
                                <ChatMessageContent
                                    bind:contentWidth
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
                                    content={msg.content}
                                    {edited}
                                    blockLevelMarkdown={msg.blockLevelMarkdown}
                                    {onRemovePreview}
                                    {onRegisterVote}
                                    {onExpandMessage}
                                    ogPreviews={msg.ogPreviews}
                                    messagePreviews={msg.messagePreviews} />
                            {/snippet}
                        </MessageBubble>
                    </MenuTrigger>
                    {#if hasThread}
                        <ThreadSummary
                            url={msgUrl}
                            {threadSummary}
                            {chatId}
                            threadRootMessageIndex={msg.messageIndex}
                            me={showAsMe} />
                    {/if}
                    {#if hasReactions}
                        <Reactions
                            me={showAsMe}
                            onClick={({ reaction }) => toggleReaction(false, reaction)}
                            {intersecting}
                            reactions={msg.reactions}
                            offset={!hasThread}></Reactions>
                    {/if}
                    {#if hasTips && !inert}
                        <Tips
                            me={showAsMe}
                            tips={msg.tips}
                            onClick={tipMessage}
                            {canTip}
                            offset={!hasThread} />
                    {/if}
                </Container>
            </Container>
        {/snippet}
    </IntersectionObserverComponent>
    {#if senderContext?.kind === "bot" && senderContext.command !== undefined}
        <div class="bot-context">
            <BotMessageContext
                botName={"cockpiss"}
                botCommand={senderContext.command}
                finalised={senderContext.finalised} />
        </div>
    {/if}
{/if}

<style lang="scss">
    $avatar-width-mob: 2.5rem;

    :global(.container.message_bubble_wrapper .menu-trigger) {
        width: 100%;
    }

    .avatar:not(.first) {
        visibility: hidden;
    }

    // The logo of the platform a message was relayed from, over the avatar's bottom right corner
    .bridge-badge {
        border-radius: var(--rad-circle);
        box-shadow: 0 0 0 2px var(--chat-background);
        width: 40%;
        height: 40%;
        position: absolute;
        bottom: -2px;
        inset-inline-end: -2px;
    }

    // TODO is this used at all?
    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);
    }

    .bot-context {
        display: flex;
        margin-inline-start: $avatar-width-mob;
        margin-bottom: $sp2;
        margin-top: $sp2;
    }

    :global(.pan-action svg) {
        transition: scale 200ms ease-out;
    }

    :global(.pan-action.active svg) {
        scale: 1.25;
    }

    :global(.pan-action path) {
        fill: var(--text-secondary);
        transition: fill 200ms ease-out;
    }

    :global(.pan-action.active path) {
        fill: var(--primary-accent);
    }

    .pan-action {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 3rem;
        height: 3rem;
        display: flex;
        align-items: center;
        justify-content: center;

        &.right {
            left: -4rem;
        }

        &.left {
            right: -4rem;
        }
    }

    .emoji_picker_wrapper {
        flex: 1;
        width: 100%;
        display: flex;
        overflow: hidden;
        flex-direction: column;
    }
</style>
