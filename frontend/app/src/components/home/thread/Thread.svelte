<script lang="ts">
    import ThreadHeader from "./ThreadHeader.svelte";
    import Footer from "../Footer.svelte";
    import type {
        ChatSummary,
        ChatEvent as ChatEventType,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageContent,
        User,
        Cryptocurrency,
        FailedMessages,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Loading from "../../Loading.svelte";
    import { derived, readable } from "svelte/store";
    import PollBuilder from "../PollBuilder.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "stores/toast";
    import ChatEvent from "../ChatEvent.svelte";
    import ChatEventList from "../ChatEventList.svelte";

    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let rootEvent: EventWrapper<Message>;
    export let chat: ChatSummary;

    let chatEventList: ChatEventList | undefined;
    let focusMessageIndex: number | undefined = undefined;
    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let loading = false;
    let initialised = false;
    let messagesDiv: HTMLDivElement | undefined;
    let messagesDivHeight: number;
    let previousLatestEventIndex: number | undefined = undefined;

    $: currentChatMembers = client.currentChatMembers;
    $: lastCryptoSent = client.lastCryptoSent;
    $: draftThreadMessages = client.draftThreadMessages;
    $: unconfirmed = client.unconfirmed;
    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: threadEvents = client.threadEvents;
    $: failedMessagesStore = client.failedMessagesStore;
    $: threadRootMessageIndex = rootEvent.event.messageIndex;
    $: threadRootMessage = rootEvent.event;
    $: blocked = chat.kind === "direct_chat" && $currentChatBlockedUsers.has(chat.them);
    $: draftMessage = readable(draftThreadMessages.get(threadRootMessageIndex), (set) =>
        draftThreadMessages.subscribe((d) => set(d[threadRootMessageIndex] ?? {}))
    );
    $: textContent = derived(draftMessage, (d) => d.textContent);
    $: replyingTo = derived(draftMessage, (d) => d.replyingTo);
    $: fileToAttach = derived(draftMessage, (d) => d.attachment);
    $: editingEvent = derived(draftMessage, (d) => d.editingEvent);
    $: canSend = client.canReplyInThread(chat.chatId);
    $: canReact = client.canReactToMessages(chat.chatId);
    $: expandedDeletedMessages = client.expandedDeletedMessages;
    $: atRoot = $threadEvents.length === 0 || $threadEvents[0]?.index === 0;
    $: events = atRoot ? [rootEvent, ...$threadEvents] : $threadEvents;
    $: messages = client
        .groupEvents(events, user.userId, $expandedDeletedMessages)
        .reverse() as EventWrapper<Message>[][][];
    $: readonly = client.isChatReadOnly(chat.chatId);
    $: selectedThreadKey = client.selectedThreadKey;
    $: thread = rootEvent.event.thread;

    onMount(() => (previousLatestEventIndex = thread?.latestEventIndex));

    $: {
        if (initialised) {
            if (
                thread !== undefined &&
                previousLatestEventIndex !== undefined &&
                thread.latestEventIndex > previousLatestEventIndex
            ) {
                client.loadNewMessages(chat.chatId, rootEvent);
                previousLatestEventIndex = thread.latestEventIndex;
            }
        }
    }

    function createTestMessages(ev: CustomEvent<number>): void {
        if (process.env.NODE_ENV === "production") return;

        function send(n: number) {
            if (n === ev.detail) return;

            sendMessageWithAttachment(`Test message ${n}`, [], undefined);

            setTimeout(() => send(n + 1), 500);
        }

        send(0);
    }

    function dateGroupKey(group: EventWrapper<Message>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            client
                .editMessageWithAttachment(
                    chat.chatId,
                    text,
                    $fileToAttach,
                    $editingEvent,
                    threadRootMessageIndex
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast("errorEditingMessage");
                    }
                });
        } else {
            sendMessageWithAttachment(text, mentioned, $fileToAttach);
        }
        draftThreadMessages.delete(threadRootMessageIndex);
    }

    function editEvent(ev: EventWrapper<Message>): void {
        draftThreadMessages.setEditing(threadRootMessageIndex, ev);
    }

    function retrySend(ev: CustomEvent<EventWrapper<Message>>): void {
        client.retrySendMessage(chat.chatId, ev.detail, $threadEvents, threadRootMessageIndex);
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        client.sendMessageWithAttachment(
            chat.chatId,
            $threadEvents,
            textContent,
            mentioned,
            fileToAttach,
            $replyingTo,
            threadRootMessageIndex
        );
    }

    function cancelReply() {
        draftThreadMessages.setReplyingTo(threadRootMessageIndex, undefined);
    }

    function clearAttachment() {
        draftThreadMessages.setAttachment(threadRootMessageIndex, undefined);
    }

    function cancelEditEvent() {
        draftThreadMessages.delete(threadRootMessageIndex);
    }

    function setTextContent(ev: CustomEvent<string | undefined>) {
        draftThreadMessages.setTextContent(threadRootMessageIndex, ev.detail);
    }

    function onStartTyping() {
        client.startTyping(chat, user.userId, threadRootMessageIndex);
    }

    function onStopTyping() {
        client.stopTyping(chat, user.userId, threadRootMessageIndex);
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        draftThreadMessages.setAttachment(threadRootMessageIndex, ev.detail);
    }

    function tokenTransfer(ev: CustomEvent<{ token: Cryptocurrency; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            token: $lastCryptoSent,
            amount: BigInt(0),
        };
    }

    function createPoll() {
        if (!client.canCreatePolls(chat.chatId)) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function attachGif(ev: CustomEvent<string>) {
        selectingGif = true;
        if (giphySelector !== undefined) {
            giphySelector.reset(ev.detail);
        }
    }

    function sendMessageWithContent(ev: CustomEvent<[MessageContent, string | undefined]>) {
        sendMessageWithAttachment(ev.detail[1], [], ev.detail[0]);
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        draftThreadMessages.setReplyingTo(threadRootMessageIndex, ev.detail);
    }

    function defaultCryptoTransferReceiver(): string | undefined {
        return $replyingTo?.sender?.userId;
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "message") {
            return e.event.messageId.toString();
        } else {
            return e.index.toString();
        }
    }

    function isConfirmed(_unconf: unknown, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !unconfirmed.contains($selectedThreadKey ?? "", evt.event.messageId);
        }
        return true;
    }

    function isFailed(_failed: FailedMessages, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return failedMessagesStore.contains($selectedThreadKey ?? "", evt.event.messageId);
        }
        return false;
    }

    function goToMessageIndex(index: number) {
        focusMessageIndex = index;
        chatEventList?.scrollToMessageIndex(index, false);
    }

    function onGoToMessageIndex(
        ev: CustomEvent<{ index: number; preserveFocus: boolean; messageId: bigint }>
    ) {
        goToMessageIndex(ev.detail.index);
    }
</script>

<PollBuilder
    bind:this={pollBuilder}
    on:sendPoll={sendMessageWithContent}
    bind:open={creatingPoll} />

<GiphySelector
    bind:this={giphySelector}
    bind:open={selectingGif}
    on:sendGiphy={sendMessageWithContent} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        {chat}
        token={creatingCryptoTransfer.token}
        draftAmountE8s={creatingCryptoTransfer.amount}
        defaultReceiver={defaultCryptoTransferReceiver()}
        on:sendTransfer={sendMessageWithContent}
        on:upgrade
        on:close={() => (creatingCryptoTransfer = undefined)} />
{/if}

<ThreadHeader
    {threadRootMessageIndex}
    on:createPoll={createPoll}
    on:closeThread
    {rootEvent}
    chatSummary={chat} />

<ChatEventList
    selectedThreadKey={$selectedThreadKey}
    threadRootEvent={rootEvent}
    rootSelector={"thread-messages"}
    bind:this={chatEventList}
    {readonly}
    unreadMessages={0}
    firstUnreadMention={undefined}
    setFocusMessageIndex={(idx) => (focusMessageIndex = idx)}
    footer
    {focusMessageIndex}
    {events}
    {chat}
    bind:initialised
    bind:messagesDiv
    bind:messagesDivHeight>
    {#if loading && !initialised}
        <Loading />
    {:else}
        {#each messages as dayGroup, _di (dateGroupKey(dayGroup))}
            <div class="day-group">
                <div class="date-label">
                    {client.formatMessageDate(
                        dayGroup[0][0]?.timestamp,
                        $_("today"),
                        $_("yesterday")
                    )}
                </div>
                {#each dayGroup as userGroup}
                    {#each userGroup as evt, i (eventKey(evt))}
                        <ChatEvent
                            chatId={chat.chatId}
                            chatType={chat.kind}
                            {user}
                            event={evt}
                            first={i === 0}
                            last={i + 1 === userGroup.length}
                            me={evt.event.sender === user.userId}
                            confirmed={isConfirmed($unconfirmed, evt)}
                            failed={isFailed($failedMessagesStore, evt)}
                            readByThem
                            readByMe
                            {observer}
                            focused={evt.event.kind === "message" &&
                                focusMessageIndex === evt.event.messageIndex}
                            {readonly}
                            {threadRootMessage}
                            pinned={false}
                            supportsEdit={evt.event.messageId !== rootEvent.event.messageId}
                            supportsReply={evt.event.messageId !== rootEvent.event.messageId}
                            canPin={client.canPinMessages(chat.chatId)}
                            canBlockUser={client.canBlockUsers(chat.chatId)}
                            canDelete={client.canDeleteOtherUsersMessages(chat.chatId)}
                            publicGroup={chat.kind === "group_chat" && chat.public}
                            editing={$editingEvent === evt}
                            {canSend}
                            {canReact}
                            canInvite={false}
                            canReplyInThread={false}
                            collapsed={false}
                            on:chatWith
                            on:goToMessageIndex={onGoToMessageIndex}
                            on:replyPrivatelyTo
                            on:replyTo={replyTo}
                            on:editEvent={() => editEvent(evt)}
                            on:chatWith
                            on:replyTo={replyTo}
                            on:replyPrivatelyTo
                            on:upgrade
                            on:retrySend={retrySend}
                            on:forward />
                    {/each}
                {/each}
            </div>
        {/each}
    {/if}
</ChatEventList>

{#if !readonly}
    <Footer
        {chat}
        fileToAttach={$fileToAttach}
        editingEvent={$editingEvent}
        replyingTo={$replyingTo}
        textContent={$textContent}
        members={$currentChatMembers}
        blockedUsers={$currentChatBlockedUsers}
        {user}
        joining={undefined}
        preview={false}
        mode={"thread"}
        {blocked}
        on:joinGroup
        on:cancelPreview
        on:upgrade
        on:cancelReply={cancelReply}
        on:clearAttachment={clearAttachment}
        on:cancelEditEvent={cancelEditEvent}
        on:setTextContent={setTextContent}
        on:startTyping={onStartTyping}
        on:stopTyping={onStopTyping}
        on:fileSelected={fileSelected}
        on:audioCaptured={fileSelected}
        on:sendMessage={sendMessage}
        on:attachGif={attachGif}
        on:tokenTransfer={tokenTransfer}
        on:createTestMessages={createTestMessages}
        on:createPoll={createPoll} />
{/if}

<style type="text/scss">
    .day-group {
        position: relative;

        .date-label {
            padding: $sp2;
            background-color: var(--currentChat-date-bg);
            position: sticky;
            top: 0;
            width: 200px;
            margin: auto;
            border-radius: $sp4;
            @include z-index("date-label");
            @include font(book, normal, fs-70);
            text-align: center;
            margin-bottom: $sp4;
        }
    }
</style>
