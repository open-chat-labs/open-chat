<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { closeNotificationsForChat } from "../../utils/notifications";
    import { editMessage } from "../../services/common/chatThread";
    import { getContext, onDestroy, tick } from "svelte";
    import {
        canInviteUsers,
        canReplyInThread,
        getFirstUnreadMention,
        getFirstUnreadMessageIndex,
        getMessageContent,
        getMinVisibleMessageIndex,
        markAllRead,
        startTyping,
        stopTyping,
    } from "../../domain/chat/chat.utils";
    import { isPreviewing } from "../../domain/chat/chat.utils.shared";
    import type {
        ChatEvent,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Mention,
        Message,
        MessageContent,
    } from "../../domain/chat/chat";
    import PollBuilder from "./PollBuilder.svelte";
    import CryptoTransferBuilder from "./CryptoTransferBuilder.svelte";
    import { userStore } from "../../stores/user";
    import { blockedUsers as directlyBlockedUsers } from "../../stores/blockedUsers";
    import {
        canBlockUsers,
        canCreatePolls,
        canDeleteOtherUsersMessages,
        canPinMessages,
        canReactToMessages,
        canSendMessages,
    } from "../../domain/chat/chat.utils";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import type { Cryptocurrency } from "../../domain/crypto";
    import { lastCryptoSent } from "../../stores/crypto";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import type { CreatedUser, User } from "../../domain/user/user";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import { currentUserKey } from "../../stores/user";
    import { messagesRead } from "../../stores/markRead";
    import {
        currentChatMembers,
        currentChatBlockedUsers,
        currentChatPinnedMessages,
        currentChatFileToAttach,
        currentChatEditingEvent,
        currentChatReplyingTo,
        currentChatTextContent,
        currentChatDraftMessage,
    } from "../../stores/chat";

    export let joining: GroupChatSummary | undefined;
    export let chat: ChatSummary;
    export let serverChat: ChatSummary;
    export let currentChatMessages: CurrentChatMessages | undefined;
    export let events: EventWrapper<ChatEvent>[];

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    $: chatId = chat.chatId;
    let previousChatId: string | undefined = undefined;
    let unreadMessages = 0;
    let firstUnreadMessage: number | undefined;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let showSearchHeader = false;
    let searchTerm = "";

    $: showFooter = !showSearchHeader;
    $: blocked = isBlocked(chat, $directlyBlockedUsers);

    $: canSend = canSendMessages(chat, $userStore);
    $: preview = isPreviewing(chat);
    $: {
        if (chatId !== previousChatId) {
            previousChatId = chatId;
            showSearchHeader = false;
            unreadMessages = getUnreadMessageCount(chat);
            firstUnreadMention = getFirstUnreadMention(chat);
            firstUnreadMessage = getFirstUnreadMessageIndex(chat);

            tick().then(() => {
                if ($messageToForwardStore !== undefined) {
                    forwardMessage($messageToForwardStore);
                    messageToForwardStore.set(undefined);
                }
            });
        }
    }

    let unsub = messagesRead.subscribe(() => {
        unreadMessages = getUnreadMessageCount(chat);
        firstUnreadMention = getFirstUnreadMention(chat);
        firstUnreadMessage = getFirstUnreadMessageIndex(chat);
    });

    function getUnreadMessageCount(chat: ChatSummary): number {
        if (isPreviewing(chat)) return 0;

        return messagesRead.unreadMessageCount(
            chat.chatId,
            getMinVisibleMessageIndex(chat),
            chat.latestMessage?.event.messageIndex
        );
    }

    function onWindowFocus() {
        closeNotificationsForChat(chatId);
    }

    onDestroy(unsub);

    function onMarkAllRead() {
        markAllRead(chat);
    }

    function createPoll() {
        if (!canCreatePolls(chat)) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function tokenTransfer(ev: CustomEvent<{ token: Cryptocurrency; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            token: $lastCryptoSent,
            amount: BigInt(0),
        };
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        currentChatDraftMessage.setAttachment(chat.chatId, ev.detail);
    }

    function attachGif(ev: CustomEvent<string>) {
        selectingGif = true;
        if (giphySelector !== undefined) {
            giphySelector.reset(ev.detail);
        }
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        showSearchHeader = false;
        currentChatDraftMessage.setReplyingTo(chat.chatId, ev.detail);
    }

    function searchChat(ev: CustomEvent<string>) {
        showSearchHeader = true;
        searchTerm = ev.detail;
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($currentChatEditingEvent !== undefined) {
            editMessageWithAttachment(text, $currentChatFileToAttach, $currentChatEditingEvent);
        } else {
            sendMessageWithAttachment(text, mentioned, $currentChatFileToAttach);
        }
    }

    function editMessageWithAttachment(
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>
    ) {
        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                edited: true,
                content: getMessageContent(textContent ?? undefined, fileToAttach),
            };

            editMessage(api, chat, msg, undefined);
        }
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        currentChatMessages?.sendMessageWithAttachmentExternal(
            textContent,
            mentioned,
            fileToAttach
        );
    }

    export function sendMessageWithContent(ev: CustomEvent<[MessageContent, string | undefined]>) {
        sendMessageWithAttachment(ev.detail[1], [], ev.detail[0]);
    }

    function forwardMessage(msg: Message) {
        currentChatMessages?.forwardMessageExternal(msg);
    }

    function setTextContent(ev: CustomEvent<string | undefined>): void {
        currentChatDraftMessage.setTextContent(chat.chatId, ev.detail);
    }

    function isBlocked(chatSummary: ChatSummary, blockedUsers: Set<string>): boolean {
        return chatSummary.kind === "direct_chat" && blockedUsers.has(chatSummary.them);
    }
</script>

<svelte:window on:focus={onWindowFocus} />

<PollBuilder
    bind:this={pollBuilder}
    on:sendPoll={sendMessageWithContent}
    bind:open={creatingPoll} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        {chat}
        token={creatingCryptoTransfer.token}
        draftAmountE8s={creatingCryptoTransfer.amount}
        on:sendTransfer={sendMessageWithContent}
        on:close={() => (creatingCryptoTransfer = undefined)} />
{/if}

<GiphySelector
    bind:this={giphySelector}
    bind:open={selectingGif}
    on:sendGiphy={sendMessageWithContent} />

<div class="wrapper">
    {#if showSearchHeader}
        <CurrentChatSearchHeader
            {chat}
            bind:searchTerm
            on:goToMessageIndex
            on:close={() => (showSearchHeader = false)} />
    {:else}
        <CurrentChatHeader
            on:clearSelection
            on:blockUser
            on:unblockUser
            on:markAllRead={onMarkAllRead}
            on:toggleMuteNotifications
            on:addMembers
            on:showGroupDetails
            on:showProposalFilters
            on:showMembers
            on:leaveGroup
            on:showPinned
            on:createPoll={createPoll}
            on:searchChat={searchChat}
            {blocked}
            {preview}
            {unreadMessages}
            selectedChatSummary={chat}
            hasPinned={$currentChatPinnedMessages.size > 0} />
    {/if}
    <CurrentChatMessages
        bind:this={currentChatMessages}
        on:replyPrivatelyTo
        on:replyTo={replyTo}
        on:openThread
        on:chatWith
        on:upgrade
        on:forward
        on:closeThread
        on:initiateThread
        {chat}
        {serverChat}
        {events}
        canPin={canPinMessages(chat)}
        canBlockUser={canBlockUsers(chat)}
        canDelete={canDeleteOtherUsersMessages(chat)}
        canReplyInThread={canReplyInThread(chat)}
        {canSend}
        canReact={canReactToMessages(chat)}
        canInvite={canInviteUsers(chat)}
        {preview}
        {firstUnreadMention}
        {firstUnreadMessage}
        footer={showFooter}
        {unreadMessages} />
    {#if showFooter}
        <Footer
            {chat}
            fileToAttach={$currentChatFileToAttach}
            editingEvent={$currentChatEditingEvent}
            replyingTo={$currentChatReplyingTo}
            textContent={$currentChatTextContent}
            members={$currentChatMembers}
            blockedUsers={$currentChatBlockedUsers}
            {user}
            mode={"message"}
            {joining}
            {preview}
            {blocked}
            on:joinGroup
            on:cancelPreview
            on:upgrade
            on:cancelReply={() => currentChatDraftMessage.setReplyingTo(chat.chatId, undefined)}
            on:clearAttachment={() => currentChatDraftMessage.setAttachment(chat.chatId, undefined)}
            on:cancelEditEvent={() => currentChatDraftMessage.clear(chat.chatId)}
            on:setTextContent={setTextContent}
            on:startTyping={() => startTyping(chat, user.userId)}
            on:stopTyping={() => stopTyping(chat, user.userId)}
            on:fileSelected={fileSelected}
            on:audioCaptured={fileSelected}
            on:sendMessage={sendMessage}
            on:attachGif={attachGif}
            on:tokenTransfer={tokenTransfer}
            on:searchChat={searchChat}
            on:createPoll={createPoll} />
    {/if}
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        position: relative;
    }
</style>
