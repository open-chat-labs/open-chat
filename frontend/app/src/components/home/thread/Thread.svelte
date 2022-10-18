<script lang="ts">
    import ThreadHeader from "./ThreadHeader.svelte";
    import Footer from "../Footer.svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import type {
        ChatEvent,
        ChatSummary,
        EnhancedReplyContext,
        EventsResponse,
        EventWrapper,
        Message,
        MessageContent,
        SendMessageSuccess,
        ThreadSummary,
        TransferSuccess,
        User,
        Cryptocurrency,
        RemoteUserRemovedMessage,
        RemoteUserSentMessage,
        RemoteUserToggledReaction,
        WebRtcMessage,
    } from "openchat-client";
    import { immutableStore } from "openchat-client";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Loading from "../../Loading.svelte";
    import Fab from "../../Fab.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { rtlStore } from "../../../stores/rtl";
    import ChatMessage from "../ChatMessage.svelte";
    import { derived, Readable, readable, writable, Writable } from "svelte/store";
    import PollBuilder from "../PollBuilder.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import { rollbar } from "../../../utils/logging";
    import { toastStore } from "../../../stores/toast";
    import { relayPublish } from "../../../stores/relay";
    import * as shareFunctions from "../../../utils/share";
    import type { OpenChat } from "openchat-client";

    const FROM_BOTTOM_THRESHOLD = 600;

    const client = getContext<OpenChat>("client");

    export let rootEvent: EventWrapper<Message>;
    export let focusMessageIndex: number | undefined;
    export let chat: ChatSummary;

    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let loading = false;
    let initialised = false;
    let messagesDiv: HTMLDivElement | undefined;
    let fromBottom: Writable<number> = writable(0);
    let withinThreshold: Readable<boolean> = derived([fromBottom], ([$fromBottom]) => {
        return $fromBottom < FROM_BOTTOM_THRESHOLD;
    });

    let previousRootEvent: EventWrapper<Message> | undefined;

    let serverEventsStore: Writable<EventWrapper<ChatEvent>[]> = immutableStore([]);

    $: currentChatMembers = client.currentChatMembers;
    $: chatStateStore = client.chatStateStore;
    $: selectedChatId = client.selectedChatId;
    $: lastCryptoSent = client.lastCryptoSent;
    $: currentChatUserIds = client.currentChatUserIds;
    $: remainingStorage = client.remainingStorage;
    $: typing = client.typing;
    $: userStore = client.userStore;
    $: draftThreadMessages = client.draftThreadMessages;
    $: unconfirmed = client.unconfirmed;
    $: localMessageUpdates = client.localMessageUpdates;
    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: threadsFollowedByMeStore = client.threadsFollowedByMeStore;
    $: events = derived(
        [serverEventsStore, unconfirmed, localMessageUpdates],
        ([serverEvents, unconf, localUpdates]) => {
            return client.mergeEventsAndLocalUpdates(
                serverEvents,
                unconf[unconfirmedKey]?.messages ?? [],
                localUpdates
            );
        }
    );

    $: {
        if (rootEvent.event.messageIndex !== previousRootEvent?.event.messageIndex) {
            previousRootEvent = rootEvent;
            initialised = false;
            if (thread !== undefined) {
                loadThreadMessages(
                    [0, thread.latestEventIndex],
                    thread.latestEventIndex,
                    false,
                    threadRootMessageIndex,
                    true
                );
            } else {
                serverEventsStore.set([]);
            }
        } else {
            // we haven't changed the thread we are looking at, but the thread's latest index has changed (i.e. an event has been added by someone else)
            if (
                thread !== undefined &&
                thread.latestEventIndex !== previousRootEvent?.event.thread?.latestEventIndex
            ) {
                loadThreadMessages(
                    [0, thread.latestEventIndex],
                    (previousRootEvent?.event.thread?.latestEventIndex ?? -1) + 1,
                    true,
                    threadRootMessageIndex,
                    false
                );
            }
        }
    }

    $: thread = rootEvent.event.thread;
    $: threadRootMessageIndex = rootEvent.event.messageIndex;
    $: blocked = chat.kind === "direct_chat" && $currentChatBlockedUsers.has(chat.them);
    $: draftMessage = readable(draftThreadMessages.get(threadRootMessageIndex), (set) =>
        draftThreadMessages.subscribe((d) => set(d[threadRootMessageIndex] ?? {}))
    );
    $: textContent = derived(draftMessage, (d) => d.textContent);
    $: replyingTo = derived(draftMessage, (d) => d.replyingTo);
    $: fileToAttach = derived(draftMessage, (d) => d.attachment);
    $: editingEvent = derived(draftMessage, (d) => d.editingEvent);
    $: canSend = client.canReplyInThread(chat);
    $: canReact = client.canReactToMessages(chat);
    $: messages = client
        .groupEvents([rootEvent, ...$events])
        .reverse() as EventWrapper<Message>[][][];
    $: preview = client.isPreviewing(chat);
    $: pollsAllowed = client.canCreatePolls(chat);
    $: unconfirmedKey = `${chat.chatId}_${threadRootMessageIndex}`;
    $: isFollowedByMe =
        $threadsFollowedByMeStore[chat.chatId]?.has(threadRootMessageIndex) ?? false;

    const dispatch = createEventDispatcher();

    async function loadThreadMessages(
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        clearEvents: boolean
    ): Promise<void> {
        if (thread === undefined || chat === undefined) return;
        loading = true;

        const chatId = chat.chatId;
        const eventsResponse = await client.api.chatEvents(
            chat,
            range,
            startIndex,
            ascending,
            threadRootMessageIndex,
            thread.latestEventIndex
        );
        if (chatId !== chat.chatId) {
            // the chat has changed while we were loading the messages
            return;
        }

        if (eventsResponse !== undefined && eventsResponse !== "events_failed") {
            if (clearEvents) {
                serverEventsStore.set([]);
            }
            const [newEvents, _] = await handleEventsResponse(eventsResponse);

            for (const event of newEvents) {
                if (event.event.kind === "message") {
                    unconfirmed.delete(unconfirmedKey, event.event.messageId);
                }
            }

            serverEventsStore.update((events) => client.mergeServerEvents(events, newEvents));
            client.makeRtcConnections(client.user.userId, chat, $events, $userStore);
            if (ascending && $withinThreshold) {
                scrollBottom();
            }
            tick().then(() => {
                if (focusMessageIndex !== undefined) {
                    goToMessageIndex(focusMessageIndex);
                }
            });

            if (isFollowedByMe) {
                const lastLoadedMessageIdx = lastMessageIndex($events);
                if (lastLoadedMessageIdx !== undefined) {
                    client.markThreadRead(
                        chat.chatId,
                        threadRootMessageIndex,
                        lastLoadedMessageIdx
                    );
                }
            }
        }

        initialised = true;
        loading = false;
    }

    function lastMessageIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
        for (let i = events.length - 1; i >= 0; i--) {
            const evt = events[i].event;
            if (evt.kind === "message") {
                return evt.messageIndex;
            }
        }
        return undefined;
    }

    function calculateFromBottom(): number {
        return -(messagesDiv?.scrollTop ?? 0);
    }

    async function handleEventsResponse(
        resp: EventsResponse<ChatEvent>
    ): Promise<[EventWrapper<ChatEvent>[], Set<string>]> {
        if (resp === "events_failed") return [[], new Set()];

        const events = resp.events.concat(resp.affectedEvents);

        const userIds = client.userIdsFromEvents(events);
        userIds.add(rootEvent.event.sender);
        await client.updateUserStore(client.api, chat.chatId, client.user.userId, userIds);

        return [events, userIds];
    }

    function dateGroupKey(group: EventWrapper<Message>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            client.editMessageWithAttachment(
                chat,
                text,
                $fileToAttach,
                $editingEvent,
                threadRootMessageIndex
            );
        } else {
            sendMessageWithAttachment(text, mentioned, $fileToAttach);
        }
        draftThreadMessages.delete(threadRootMessageIndex);
    }

    function editEvent(ev: EventWrapper<Message>): void {
        draftThreadMessages.setEditing(threadRootMessageIndex, ev);
    }

    function newMessage(
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        nextMessageIndex: number
    ): Message {
        return client.createMessage(
            client.user.userId,
            nextMessageIndex,
            textContent,
            $replyingTo,
            fileToAttach
        );
    }

    export function handleWebRtcMessage(fromChatId: string, msg: WebRtcMessage): void {
        // make sure the chatId matches
        if (fromChatId !== chat.chatId) return;

        // make sure that the root message index matches
        if (msg.threadRootMessageIndex !== rootEvent.event.messageIndex) return;

        switch (msg.kind) {
            case "remote_user_typing":
                typing.startTyping(fromChatId, msg.userId, msg.threadRootMessageIndex);
                break;
            case "remote_user_stopped_typing":
                typing.stopTyping(msg.userId);
                break;
            case "remote_user_toggled_reaction":
                remoteUserToggledReaction(msg);
                break;
            case "remote_user_removed_message":
                remoteUserRemovedMessage(msg);
                break;
            case "remote_user_deleted_message":
                localMessageUpdates.markDeleted(msg.messageId.toString(), msg.userId);
                break;
            case "remote_user_undeleted_message":
                localMessageUpdates.markUndeleted(msg.messageId.toString());
                break;
            case "remote_user_sent_message":
                remoteUserSentMessage(msg);
                break;
        }
    }

    function remoteUserRemovedMessage(message: RemoteUserRemovedMessage): void {
        removeMessage(message.messageId, message.userId);
    }

    function remoteUserToggledReaction(message: RemoteUserToggledReaction): void {
        const matchingMessage = client.findMessageById(message.messageId, $events);

        if (matchingMessage !== undefined) {
            localMessageUpdates.markReaction(message.messageId.toString(), {
                reaction: message.reaction,
                kind: message.added ? "add" : "remove",
                userId: message.userId,
            });
        }
    }

    function remoteUserSentMessage(message: RemoteUserSentMessage) {
        const existing = client.findMessageById(message.messageEvent.event.messageId, $events);
        if (existing !== undefined) {
            return;
        }

        const [eventIndex, messageIndex] = getNextEventAndMessageIndexes($events);
        unconfirmed.add(unconfirmedKey, {
            ...message.messageEvent,
            index: eventIndex,
            event: {
                ...message.messageEvent.event,
                messageIndex,
            },
        });

        // since we will only get here if we actually have the thread open
        // we should mark read up to this message too
        client.markThreadRead(chat.chatId, threadRootMessageIndex, messageIndex);
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        if (!canSend) return;

        if (textContent || fileToAttach) {
            const storageRequired = client.getStorageRequiredForMessage(fileToAttach);
            if ($remainingStorage < storageRequired) {
                dispatch("upgrade", "explain");
                return;
            }

            const [nextEventIndex, nextMessageIndex] = getNextEventAndMessageIndexes($events);

            const msg = newMessage(textContent, fileToAttach, nextMessageIndex);
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

            unconfirmed.add(unconfirmedKey, event);
            scrollBottom();
            client.markThreadRead(chat.chatId, threadRootMessageIndex, nextMessageIndex);

            client.api
                .sendMessage(chat, client.user, mentioned, msg, threadRootMessageIndex)
                .then(([resp, msg]) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        confirmMessage(msg, resp);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            client.api.refreshAccountBalance(
                                msg.content.transfer.token,
                                client.user.cryptoAccount
                            );
                        }
                        client.trackEvent("sent_threaded_message");
                    } else {
                        unconfirmed.delete(unconfirmedKey, msg.messageId);
                        removeMessage(msg.messageId, client.user.userId);
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                    }
                })
                .catch((err) => {
                    console.log(err);
                    unconfirmed.delete(unconfirmedKey, msg.messageId);
                    removeMessage(msg.messageId, client.user.userId);
                    toastStore.showFailureToast("errorSendingMessage");
                    rollbar.error("Exception sending message", err);
                });

            client.sendRtcMessage([...$currentChatUserIds], {
                kind: "remote_user_sent_message",
                chatType: chat.kind,
                chatId: chat.chatId,
                messageEvent: client.serialiseMessageForRtc(event),
                userId: client.user.userId,
                threadRootMessageIndex,
            });

            const summary: ThreadSummary = {
                participantIds: new Set<string>([client.user.userId]),
                numberOfReplies: nextMessageIndex + 1,
                latestEventIndex: nextEventIndex,
                latestEventTimestamp: BigInt(Date.now()),
            };

            localMessageUpdates.markThreadSummaryUpdated(
                rootEvent.event.messageId.toString(),
                summary
            );
        }
    }

    function confirmMessage(candidate: Message, resp: SendMessageSuccess | TransferSuccess): void {
        if (unconfirmed.delete(unconfirmedKey, candidate.messageId)) {
            const confirmed = client.mergeSendMessageResponse(candidate, resp);
            serverEventsStore.update((events) => client.mergeServerEvents(events, [confirmed]));
        }
    }

    function removeMessage(messageId: bigint, userId: string) {
        unconfirmed.delete(unconfirmedKey, messageId);
        if (userId === client.user.userId) {
            client.sendRtcMessage([...$currentChatUserIds], {
                kind: "remote_user_removed_message",
                chatType: chat.kind,
                chatId: chat.chatId,
                messageId: messageId,
                userId: userId,
                threadRootMessageIndex,
            });
        }
    }

    function getNextEventAndMessageIndexes(events: EventWrapper<ChatEvent>[]): [number, number] {
        return events.reduce(
            ([maxEvtIdx, maxMsgIdx], evt) => {
                const msgIdx =
                    evt.event.kind === "message"
                        ? Math.max(evt.event.messageIndex + 1, maxMsgIdx)
                        : maxMsgIdx;
                const evtIdx = Math.max(evt.index + 1, maxEvtIdx);
                return [evtIdx, msgIdx];
            },
            [0, 0]
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
        client.startTyping(chat, client.user.userId, threadRootMessageIndex);
    }

    function onStopTyping() {
        client.stopTyping(chat, client.user.userId, threadRootMessageIndex);
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
        if (!client.canCreatePolls(chat)) return;

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

    function registerVote(
        ev: CustomEvent<{
            messageIndex: number;
            messageId: bigint;
            answerIndex: number;
            type: "register" | "delete";
        }>
    ) {
        if (ev.detail.messageId === rootEvent.event.messageId) {
            relayPublish({ kind: "relayed_register_vote", data: ev.detail });
            return;
        }

        if ($selectedChatId !== undefined) {
            client.registerPollVote(
                client.api,
                client.user.userId,
                $selectedChatId,
                threadRootMessageIndex,
                ev.detail.messageId,
                ev.detail.messageIndex,
                ev.detail.answerIndex,
                ev.detail.type
            );
        }
    }

    function onDeleteMessage(ev: CustomEvent<Message>): void {
        if (ev.detail.messageId === rootEvent.event.messageId) {
            relayPublish({ kind: "relayed_delete_message", message: ev.detail });
            return;
        }

        client.deleteMessage(
            client.api,
            chat,
            client.user.userId,
            threadRootMessageIndex,
            ev.detail.messageId
        );
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        draftThreadMessages.setReplyingTo(threadRootMessageIndex, ev.detail);
    }

    function onSelectReaction(ev: CustomEvent<{ message: Message; reaction: string }>) {
        if (ev.detail.message === rootEvent.event) {
            relayPublish({ kind: "relayed_select_reaction", ...ev.detail });
            return;
        }

        if (!canReact) return;

        const { message, reaction } = ev.detail;

        const kind = client.containsReaction(client.user.userId, reaction, message.reactions)
            ? "remove"
            : "add";

        client
            .selectReaction(
                client.api,
                chat,
                client.user.userId,
                threadRootMessageIndex,
                message.messageId,
                reaction,
                client.user.username,
                kind
            )
            .then((success) => {
                if (success && kind === "add") {
                    client.trackEvent("reacted_to_message");
                }
            });
    }

    function clearFocusIndex() {
        focusMessageIndex = undefined;
        chatStateStore.setProp(chat.chatId, "focusThreadMessageIndex", undefined);
    }

    function goToMessageIndex(index: number) {
        if (index < 0) {
            clearFocusIndex();
            return;
        }

        focusMessageIndex = index;
        const element = document.querySelector(`.thread-messages [data-index='${index}']`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => {
                clearFocusIndex();
            }, 200);
        } else {
            console.log(`message index ${index} not found`);
        }
    }

    function onGoToMessageIndex(
        ev: CustomEvent<{ index: number; preserveFocus: boolean; messageId: bigint }>
    ) {
        if (ev.detail.messageId === rootEvent.event.messageId) {
            relayPublish({ kind: "relayed_goto_message", ...ev.detail });
            return;
        }
        goToMessageIndex(ev.detail.index);
    }

    function scrollBottom() {
        tick().then(() => {
            messagesDiv?.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        });
    }

    function onScroll() {
        $fromBottom = calculateFromBottom();
    }

    function shareMessage(ev: CustomEvent<Message>) {
        shareFunctions.shareMessage(
            $_,
            client.user.userId,
            ev.detail.sender === client.user.userId,
            ev.detail
        );
    }

    function copyMessageUrl(ev: CustomEvent<Message>) {
        shareFunctions.copyMessageUrl(chat.chatId, ev.detail.messageIndex, threadRootMessageIndex);
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
        on:sendTransfer={sendMessageWithContent}
        on:close={() => (creatingCryptoTransfer = undefined)} />
{/if}

<div
    title={$_("goToLatestMessage")}
    class:show={!$withinThreshold}
    class="fab to-bottom"
    class:rtl={$rtlStore}>
    <Fab on:click={scrollBottom}>
        <ArrowDown size={$iconSize} color={"#fff"} />
    </Fab>
</div>

<ThreadHeader
    {threadRootMessageIndex}
    on:createPoll={createPoll}
    on:closeThread
    {rootEvent}
    {pollsAllowed}
    chatSummary={chat} />

<div bind:this={messagesDiv} class="thread-messages" on:scroll={onScroll}>
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
                    {#each userGroup as evt, i (evt.event.messageId.toString())}
                        <ChatMessage
                            senderId={evt.event.sender}
                            focused={evt.event.messageIndex === focusMessageIndex}
                            {observer}
                            confirmed={!unconfirmed.contains(unconfirmedKey, evt.event.messageId)}
                            senderTyping={client.isTyping(
                                $typing,
                                evt.event.sender,
                                chat.chatId,
                                threadRootMessageIndex
                            )}
                            readByMe={true}
                            readByThem={true}
                            chatId={chat.chatId}
                            chatType={chat.kind}
                            user={client.user}
                            me={evt.event.sender === client.user.userId}
                            first={i === 0}
                            last={i + 1 === userGroup.length}
                            {preview}
                            inThread={true}
                            pinned={false}
                            supportsEdit={evt.event.messageId !== rootEvent.event.messageId}
                            supportsReply={evt.event.messageId !== rootEvent.event.messageId}
                            canPin={client.canPinMessages(chat)}
                            canBlockUser={client.canBlockUsers(chat)}
                            canDelete={client.canDeleteOtherUsersMessages(chat)}
                            canQuoteReply={canSend}
                            canReact={client.canReactToMessages(chat)}
                            canStartThread={false}
                            publicGroup={chat.kind === "group_chat" && chat.public}
                            editing={$editingEvent === evt}
                            on:chatWith
                            on:goToMessageIndex={onGoToMessageIndex}
                            on:replyPrivatelyTo
                            on:replyTo={replyTo}
                            on:selectReaction={onSelectReaction}
                            on:deleteMessage={onDeleteMessage}
                            on:blockUser
                            on:registerVote={registerVote}
                            on:editMessage={() => editEvent(evt)}
                            on:shareMessage={shareMessage}
                            on:copyMessageUrl={copyMessageUrl}
                            on:upgrade
                            on:forward
                            eventIndex={evt.index}
                            timestamp={evt.timestamp}
                            msg={evt.event} />
                    {/each}
                {/each}
            </div>
        {/each}
    {/if}
</div>

{#if !preview}
    <Footer
        {chat}
        fileToAttach={$fileToAttach}
        editingEvent={$editingEvent}
        replyingTo={$replyingTo}
        textContent={$textContent}
        members={$currentChatMembers}
        blockedUsers={$currentChatBlockedUsers}
        user={client.user}
        joining={undefined}
        {preview}
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
        on:createPoll={createPoll} />
{/if}

<style type="text/scss">
    .thread-messages {
        flex: auto;
        background-color: var(--panel-bg);
        padding: $sp3 $sp3;
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        position: relative;
        display: flex;
        flex-direction: column-reverse;

        @include nice-scrollbar();

        @include mobile() {
            padding: 10px;
            -webkit-overflow-scrolling: touch;
        }
    }

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

    .fab {
        transition: opacity ease-in-out 300ms;
        position: absolute;
        @include z-index("fab");
        right: 20px;
        bottom: 0;
        opacity: 0;
        pointer-events: none;

        &.show {
            opacity: 1;
            pointer-events: all;
        }

        &.rtl {
            left: $sp6;
            right: unset;
        }
    }

    .to-bottom {
        bottom: 80px;
    }
</style>
