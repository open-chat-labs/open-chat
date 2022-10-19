<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { closeNotificationsForChat } from "../../utils/notifications";
    import { getContext, onDestroy, onMount, tick } from "svelte";
    import type {
        ChatEvent,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Mention,
        Message,
        MessageContent,
        Cryptocurrency,
        OpenChat,
        FilteredProposals,
        User,
    } from "openchat-client";
    import PollBuilder from "./PollBuilder.svelte";
    import CryptoTransferBuilder from "./CryptoTransferBuilder.svelte";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import { messageToForwardStore } from "../../stores/messageToForward";

    export let joining: GroupChatSummary | undefined;
    export let chat: ChatSummary;
    export let serverChat: ChatSummary;
    export let currentChatMessages: CurrentChatMessages | undefined;
    export let events: EventWrapper<ChatEvent>[];
    export let filteredProposals: FilteredProposals | undefined;

    const client = getContext<OpenChat>("client");
    const user = client.user;

    $: chatId = chat.chatId;
    let previousChatId: string | undefined = undefined;
    let unreadMessages = 0;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let showSearchHeader = false;
    let searchTerm = "";

    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: currentChatMembers = client.currentChatMembers;
    $: currentChatTextContent = client.currentChatTextContent;
    $: currentChatReplyingTo = client.currentChatReplyingTo;
    $: currentChatPinnedMessages = client.currentChatPinnedMessages;
    $: currentChatFileToAttach = client.currentChatFileToAttach;
    $: currentChatEditingEvent = client.currentChatEditingEvent;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: lastCryptoSent = client.lastCryptoSent;
    $: messagesRead = client.messagesRead;
    $: userStore = client.userStore;
    $: directlyBlockedUsers = client.blockedUsers;
    $: showFooter = !showSearchHeader;
    $: blocked = isBlocked(chat, $directlyBlockedUsers);

    $: canSend = client.canSendMessages(chat, $userStore);
    $: preview = client.isPreviewing(chat);
    $: {
        if (chatId !== previousChatId) {
            previousChatId = chatId;
            showSearchHeader = false;
            unreadMessages = getUnreadMessageCount(chat);
            firstUnreadMention = client.getFirstUnreadMention(chat);

            tick().then(() => {
                if ($messageToForwardStore !== undefined) {
                    forwardMessage($messageToForwardStore);
                    messageToForwardStore.set(undefined);
                }
            });
        }
    }

    onMount(() => {
        return messagesRead.subscribe(() => {
            unreadMessages = getUnreadMessageCount(chat);
            firstUnreadMention = client.getFirstUnreadMention(chat);
        });
    });

    function getUnreadMessageCount(chat: ChatSummary): number {
        if (client.isPreviewing(chat)) return 0;

        return messagesRead.unreadMessageCount(chat.chatId, chat.latestMessage?.event.messageIndex);
    }

    function onWindowFocus() {
        closeNotificationsForChat(chatId);
    }

    function onMarkAllRead() {
        client.markAllRead(chat);
    }

    function createPoll() {
        if (!client.canCreatePolls(chat)) return;

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
            client.editMessageWithAttachment(
                chat,
                text,
                $currentChatFileToAttach,
                $currentChatEditingEvent
            );
        } else {
            sendMessageWithAttachment(text, mentioned, $currentChatFileToAttach);
        }
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        client.sendMessageWithAttachment(
            serverChat,
            chat,
            events,
            textContent,
            mentioned,
            fileToAttach
        );
    }

    export function sendMessageWithContent(ev: CustomEvent<[MessageContent, string | undefined]>) {
        sendMessageWithAttachment(ev.detail[1], [], ev.detail[0]);
    }

    function forwardMessage(msg: Message) {
        if (!canSend || !client.canForward(msg.content)) return;

        client.forwardMessage(serverChat, chat, events, msg);
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
        {filteredProposals}
        canPin={client.canPinMessages(chat)}
        canBlockUser={client.canBlockUsers(chat)}
        canDelete={client.canDeleteOtherUsersMessages(chat)}
        canReplyInThread={client.canReplyInThread(chat)}
        {canSend}
        canReact={client.canReactToMessages(chat)}
        canInvite={client.canInviteUsers(chat)}
        {preview}
        {firstUnreadMention}
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
            on:startTyping={() => client.startTyping(chat, user.userId)}
            on:stopTyping={() => client.stopTyping(chat, user.userId)}
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
