<script lang="ts">
    import ThreadHeader from "./ThreadHeader.svelte";
    import Footer from "../Footer.svelte";
    import type {
        ChatSummary,
        ChatEvent as ChatEventType,
        EnhancedReplyContext,
        EventWrapper,
        FailedMessages,
        Message,
        OpenChat,
        User,
        TimelineItem,
        AttachmentContent,
    } from "openchat-client";
    import { LEDGER_CANISTER_ICP } from "openchat-client";
    import { getContext } from "svelte";
    import Loading from "../../Loading.svelte";
    import { derived, readable } from "svelte/store";
    import PollBuilder from "../PollBuilder.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import MemeBuilder from "../MemeBuilder.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import { toastStore } from "../../../stores/toast";
    import ChatEvent from "../ChatEvent.svelte";
    import ChatEventList from "../ChatEventList.svelte";
    import { randomSentence } from "../../../utils/randomMsg";
    import TimelineDate from "../TimelineDate.svelte";
    import { reverseScroll } from "../../../stores/scrollPos";
    import AcceptRulesModal from "../AcceptRulesModal.svelte";

    type ConfirmedActionEvent = ConfirmedSendMessage | ConfirmedRetrySendMessage;

    type ConfirmedSendMessage = {
        kind: "send_message";
        textContent: string | undefined;
        mentioned: User[];
        attachment: AttachmentContent | undefined;
    };

    type ConfirmedRetrySendMessage = {
        kind: "retry_send_message";
        event: EventWrapper<Message>;
    };

    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let rootEvent: EventWrapper<Message>;
    export let chat: ChatSummary;

    let chatEventList: ChatEventList | undefined;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let memeBuilder: MemeBuilder;
    let creatingPoll = false;
    let creatingCryptoTransfer: { ledger: string; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let buildingMeme = false;
    let initialised = false;
    let messagesDiv: HTMLDivElement | undefined;
    let messagesDivHeight: number;
    let showAcceptRulesModal = false;
    let sendMessageContext: ConfirmedActionEvent | undefined = undefined;

    $: selectedMessageContext = client.selectedMessageContext;
    $: focusMessageIndex = client.focusThreadMessageIndex;
    $: lastCryptoSent = client.lastCryptoSent;
    $: draftThreadMessages = client.draftThreadMessages;
    $: unconfirmed = client.unconfirmed;
    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: threadEvents = client.threadEvents;
    $: failedMessagesStore = client.failedMessagesStore;
    $: threadRootMessageIndex = rootEvent.event.messageIndex;
    $: messageContext = { chatId: chat.id, threadRootMessageIndex };
    $: threadRootMessage = rootEvent.event;
    $: blocked = chat.kind === "direct_chat" && $currentChatBlockedUsers.has(chat.them.userId);
    $: draftMessage = readable(draftThreadMessages.get(threadRootMessageIndex), (set) =>
        draftThreadMessages.subscribe((d) => set(d[threadRootMessageIndex] ?? {}))
    );
    $: textContent = derived(draftMessage, (d) => d.textContent);
    $: replyingTo = derived(draftMessage, (d) => d.replyingTo);
    $: attachment = derived(draftMessage, (d) => d.attachment);
    $: editingEvent = derived(draftMessage, (d) => d.editingEvent);
    $: canSend = client.canReplyInThread(chat.id);
    $: canReact = client.canReactToMessages(chat.id);
    $: expandedDeletedMessages = client.expandedDeletedMessages;
    $: atRoot = $threadEvents.length === 0 || $threadEvents[0]?.index === 0;
    $: events = atRoot ? [rootEvent, ...$threadEvents] : $threadEvents;
    $: timeline = client.groupEvents(
        reverseScroll ? [...events].reverse() : events,
        user.userId,
        $expandedDeletedMessages,
        reverseScroll
    ) as TimelineItem<Message>[];
    $: readonly = client.isChatReadOnly(chat.id);
    $: thread = rootEvent.event.thread;
    $: loading = !initialised && $threadEvents.length === 0 && thread !== undefined;

    function createTestMessages(ev: CustomEvent<number>): void {
        if (process.env.NODE_ENV === "production") return;

        function send(n: number) {
            if (n === ev.detail) return;

            sendMessageWithAttachment(randomSentence(), undefined);

            window.setTimeout(() => send(n + 1), 500);
        }

        send(0);
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            client
                .editMessageWithAttachment(messageContext, text, $attachment, $editingEvent)
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast("errorEditingMessage");
                    }
                });
        } else {
            sendMessageWithAttachment(text, $attachment, mentioned);
        }
        draftThreadMessages.delete(threadRootMessageIndex);
    }

    function editEvent(ev: EventWrapper<Message>): void {
        draftThreadMessages.setEditing(threadRootMessageIndex, ev);
    }

    function retrySend(ev: CustomEvent<EventWrapper<Message>>): void {
        if (client.rulesNeedAccepting()) {
            showAcceptRulesModal = true;
            sendMessageContext = {
                kind: "retry_send_message",
                event: ev.detail,
            };
        } else {
            client.retrySendMessage(messageContext, ev.detail);
        }
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        attachment: AttachmentContent | undefined,
        mentioned: User[] = []
    ) {
        if (client.rulesNeedAccepting()) {
            showAcceptRulesModal = true;
            sendMessageContext = {
                kind: "send_message",
                textContent,
                mentioned,
                attachment,
            };
        } else {
            client.sendMessageWithAttachment(messageContext, textContent, attachment, mentioned);
        }
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

    function fileSelected(ev: CustomEvent<AttachmentContent>) {
        draftThreadMessages.setAttachment(threadRootMessageIndex, ev.detail);
    }

    function tokenTransfer(ev: CustomEvent<{ ledger: string; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            ledger: $lastCryptoSent ?? LEDGER_CANISTER_ICP,
            amount: BigInt(0),
        };
    }

    function createPoll() {
        if (!client.canCreatePolls(chat.id)) return;

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

    function makeMeme() {
        buildingMeme = true;
        if (memeBuilder !== undefined) {
            memeBuilder.reset();
        }
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
        if (evt.event.kind === "message" && $selectedMessageContext) {
            return !unconfirmed.contains($selectedMessageContext, evt.event.messageId);
        }
        return true;
    }

    function isFailed(_failed: FailedMessages, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message" && $selectedMessageContext) {
            return failedMessagesStore.contains($selectedMessageContext, evt.event.messageId);
        }
        return false;
    }

    function goToMessageIndex(index: number) {
        chatEventList?.scrollToMessageIndex(chat.id, index, false);
    }

    function onGoToMessageIndex(
        ev: CustomEvent<{ index: number; preserveFocus: boolean; messageId: bigint }>
    ) {
        goToMessageIndex(ev.detail.index);
    }

    function onAcceptRules(
        ev: CustomEvent<{
            accepted: boolean;
            chatRulesVersion: number | undefined;
            communityRulesVersion: number | undefined;
        }>
    ) {
        if (sendMessageContext === undefined) {
            showAcceptRulesModal = false;
            return;
        }

        const { accepted, chatRulesVersion, communityRulesVersion } = ev.detail;

        if (accepted) {
            switch (sendMessageContext.kind) {
                case "send_message": {
                    client.sendMessageWithAttachment(
                        messageContext,
                        sendMessageContext.textContent,
                        sendMessageContext.attachment,
                        sendMessageContext.mentioned,
                        chatRulesVersion,
                        communityRulesVersion
                    );
                    break;
                }
                case "retry_send_message": {
                    client.retrySendMessage(
                        messageContext,
                        sendMessageContext.event,
                        chatRulesVersion,
                        communityRulesVersion
                    );
                    break;
                }
            }
        } else {
            switch (sendMessageContext.kind) {
                case "send_message": {
                    draftThreadMessages.setTextContent(
                        threadRootMessageIndex,
                        sendMessageContext.textContent
                    );
                    draftThreadMessages.setAttachment(
                        threadRootMessageIndex,
                        sendMessageContext.attachment
                    );
                    break;
                }
            }
        }

        sendMessageContext = undefined;
        showAcceptRulesModal = false;
    }
</script>

{#if showAcceptRulesModal}
    <AcceptRulesModal on:close={onAcceptRules} />
{/if}

<PollBuilder context={messageContext} bind:this={pollBuilder} bind:open={creatingPoll} />

<GiphySelector context={messageContext} bind:this={giphySelector} bind:open={selectingGif} />

<MemeBuilder context={messageContext} bind:this={memeBuilder} bind:open={buildingMeme} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        context={messageContext}
        {chat}
        ledger={creatingCryptoTransfer.ledger}
        draftAmount={creatingCryptoTransfer.amount}
        defaultReceiver={defaultCryptoTransferReceiver()}
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
    selectedMessageContext={$selectedMessageContext}
    threadRootEvent={rootEvent}
    rootSelector={"thread-messages"}
    maintainScroll={false}
    bind:this={chatEventList}
    {readonly}
    unreadMessages={0}
    firstUnreadMention={undefined}
    setFocusMessageIndex={(idx) => client.setFocusThreadMessageIndex(chat.id, idx)}
    footer
    {events}
    {chat}
    bind:initialised
    bind:messagesDiv
    bind:messagesDivHeight
    let:observer
    let:labelObserver>
    {#if loading}
        <Loading />
    {:else}
        {#each timeline as timelineItem}
            {#if timelineItem.kind === "timeline_date"}
                <TimelineDate observer={labelObserver} timestamp={timelineItem.timestamp} />
            {:else}
                {#each timelineItem.group as userGroup}
                    {#each userGroup as evt, i (eventKey(evt))}
                        <ChatEvent
                            chatId={chat.id}
                            chatType={chat.kind}
                            {user}
                            event={evt}
                            first={reverseScroll ? i + 1 === userGroup.length : i === 0}
                            last={reverseScroll ? i === 0 : i + 1 === userGroup.length}
                            me={evt.event.sender === user.userId}
                            confirmed={isConfirmed($unconfirmed, evt)}
                            failed={isFailed($failedMessagesStore, evt)}
                            readByThem
                            readByMe
                            {observer}
                            focused={evt.event.kind === "message" &&
                                $focusMessageIndex === evt.event.messageIndex}
                            {readonly}
                            {threadRootMessage}
                            pinned={false}
                            supportsEdit={evt.event.messageId !== rootEvent.event.messageId}
                            supportsReply={evt.event.messageId !== rootEvent.event.messageId}
                            canPin={client.canPinMessages(chat.id)}
                            canBlockUser={client.canBlockUsers(chat.id)}
                            canDelete={client.canDeleteOtherUsersMessages(chat.id)}
                            publicGroup={(chat.kind === "group_chat" || chat.kind === "channel") &&
                                chat.public}
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
                            on:replyTo={replyTo}
                            on:upgrade
                            on:retrySend={retrySend}
                            on:forward />
                    {/each}
                {/each}
            {/if}
        {/each}
    {/if}
</ChatEventList>

{#if !readonly}
    <Footer
        {chat}
        attachment={$attachment}
        editingEvent={$editingEvent}
        replyingTo={$replyingTo}
        textContent={$textContent}
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
        on:makeMeme={makeMeme}
        on:tokenTransfer={tokenTransfer}
        on:createTestMessages={createTestMessages}
        on:createPoll={createPoll} />
{/if}
