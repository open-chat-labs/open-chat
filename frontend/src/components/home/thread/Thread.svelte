<script lang="ts">
    import ThreadHeader from "./ThreadHeader.svelte";
    import Footer from "../Footer.svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import type {
        ChatEvent,
        EnhancedReplyContext,
        EventsResponse,
        EventWrapper,
        Message,
        MessageContent,
        SendMessageSuccess,
        TransferSuccess,
    } from "../../../domain/chat/chat";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Loading from "../../Loading.svelte";
    import Fab from "../../Fab.svelte";
    import { formatMessageDate } from "../../../utils/date";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import type { CreatedUser, User } from "../../../domain/user/user";
    import { currentUserKey } from "../../../stores/user";
    import { iconSize } from "../../../stores/iconSize";
    import { rtlStore } from "../../../stores/rtl";
    import type { ChatController } from "../../../fsm/chat.controller";
    import ChatMessage from "../ChatMessage.svelte";
    import {
        canBlockUsers,
        canCreatePolls,
        canDeleteOtherUsersMessages,
        canPinMessages,
        canReactToMessages,
        canReplyInThread,
        canSendMessages,
        createMessage,
        getMessageContent,
        getStorageRequiredForMessage,
        groupEvents,
        makeRtcConnections,
        mergeSendMessageResponse,
        replaceAffected,
        replaceLocal,
        serialiseMessageForRtc,
        updateEventPollContent,
        userIdsFromEvents,
    } from "../../../domain/chat/chat.utils";
    import { userStore } from "../../../stores/user";
    import { derived, Readable, readable, writable, Writable } from "svelte/store";
    import { draftThreadMessages } from "../../../stores/draftThreadMessages";
    import { remainingStorage } from "../../../stores/storage";
    import PollBuilder from "../PollBuilder.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import type { Cryptocurrency } from "../../../domain/crypto";
    import { lastCryptoSent } from "../../../stores/crypto";
    import { trackEvent } from "../../../utils/tracking";
    import { rollbar } from "../../../utils/logging";
    import { toastStore } from "../../../stores/toast";
    import { dedupe } from "../../../utils/list";
    import { selectReaction, toggleReactionInEventList } from "../../../stores/reactions";
    import { immutableStore } from "../../../stores/immutable";
    import { isPreviewing } from "../../../domain/chat/chat.utils.shared";
    import { relayPublish } from "../../../stores/relay";
    import * as shareFunctions from "../../../domain/share";
    import { isTyping, typing } from "../../../stores/typing";
    import { rtcConnectionsManager } from "../../../domain/webrtc/RtcConnectionsManager";
    import type {
        RemoteUserDeletedMessage,
        RemoteUserRemovedMessage,
        RemoteUserSentMessage,
        RemoteUserToggledReaction,
        WebRtcMessage,
    } from "../../../domain/webrtc/webrtc";
    import { filterWebRtcMessage, parseWebRtcMessage } from "../../../domain/webrtc/rtcHandler";
    import { messagesRead } from "../../../stores/markRead";
    import { unconfirmed } from "../../../stores/unconfirmed";

    const FROM_BOTTOM_THRESHOLD = 600;
    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let controller: ChatController;
    export let rootEvent: EventWrapper<Message>;
    export let focusMessageIndex: number | undefined;

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

    let events: Writable<EventWrapper<ChatEvent>[]> = immutableStore([]);

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
            }
        } else {
            // we haven't changed the thread we are looking at, but the threads latest index has changed (i.e. an event has been added by someone else)
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
    $: chat = controller.chat;
    $: threadRootMessageIndex = rootEvent.event.messageIndex;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;
    $: blocked = $chat.kind === "direct_chat" && $blockedUsers.has($chat.them);
    $: draftMessage = readable(draftThreadMessages.get(threadRootMessageIndex), (set) =>
        draftThreadMessages.subscribe((d) => set(d[threadRootMessageIndex] ?? {}))
    );
    $: textContent = derived(draftMessage, (d) => d.textContent);
    $: replyingTo = derived(draftMessage, (d) => d.replyingTo);
    $: fileToAttach = derived(draftMessage, (d) => d.attachment);
    $: editingEvent = derived(draftMessage, (d) => d.editingEvent);
    $: canSend = canSendMessages($chat, $userStore);
    $: canReact = canReactToMessages($chat);
    $: messages = groupEvents([rootEvent, ...$events]).reverse() as EventWrapper<Message>[][][];
    $: preview = isPreviewing($chat);
    $: pollsAllowed = canCreatePolls($chat);
    $: unconfirmedKey = `${$chat.chatId}_${threadRootMessageIndex}`;

    const dispatch = createEventDispatcher();

    async function loadThreadMessages(
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        clearEvents: boolean
    ): Promise<void> {
        if (thread === undefined || controller.chatVal === undefined) return;
        loading = true;

        const eventsResponse = await api.chatEvents(
            controller.chatVal,
            range,
            startIndex,
            ascending,
            threadRootMessageIndex
        );

        if (eventsResponse !== undefined && eventsResponse !== "events_failed") {
            if (clearEvents) {
                events.set([]);
            }
            const updated = await handleEventsResponse($events, eventsResponse);
            events.set(
                dedupe(
                    (a, b) => a.index === b.index,
                    updated.sort((a, b) => a.index - b.index)
                )
            );
            makeRtcConnections(currentUser.userId, $chat, $events, $userStore);
            if (ascending && $withinThreshold) {
                scrollBottom();
            }
            tick().then(() => {
                if (focusMessageIndex !== undefined) {
                    goToMessageIndex(focusMessageIndex);
                }
            });
            const lastLoadedMessageIdx = lastMessageIndex($events);
            if (lastLoadedMessageIdx !== undefined) {
                messagesRead.markThreadRead(
                    $chat.chatId,
                    threadRootMessageIndex,
                    lastLoadedMessageIdx
                );
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
        events: EventWrapper<ChatEvent>[],
        resp: EventsResponse<ChatEvent>
    ): Promise<EventWrapper<ChatEvent>[]> {
        if (resp === "events_failed") return [];

        const updated = replaceAffected(
            replaceLocal(
                currentUser.userId,
                $chat.chatId,
                $chat.readByMe,
                events,
                resp.events,
                threadRootMessageIndex
            ),
            resp.affectedEvents
        );

        const userIds = userIdsFromEvents(updated);
        await controller.updateUserStore(userIds);

        return updated;
    }

    function dateGroupKey(group: EventWrapper<Message>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            editMessageWithAttachment(text, $fileToAttach, $editingEvent);
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
        return createMessage(
            currentUser.userId,
            nextMessageIndex,
            textContent,
            $replyingTo,
            fileToAttach
        );
    }

    export function messageId(): bigint {
        return rootEvent.event.messageId;
    }

    export function handleWebRtcMessage(msg: WebRtcMessage): void {
        const chatId = filterWebRtcMessage(msg);
        if (chatId === undefined) return;

        // make sure the chatId matches
        if (chatId !== controller.chatId) return;

        // make sure that the root message index matches
        if (msg.threadRootMessageIndex !== rootEvent.event.messageIndex) return;

        const parsed = parseWebRtcMessage(chatId, msg);
        const { kind } = parsed;

        if (kind === "remote_user_typing") {
            typing.startTyping(chatId, parsed.userId, parsed.threadRootMessageIndex);
        }
        if (kind === "remote_user_stopped_typing") {
            typing.stopTyping(parsed.userId);
        }
        if (kind === "remote_user_toggled_reaction") {
            remoteUserToggledReaction(parsed);
        }
        if (kind === "remote_user_removed_message") {
            remoteUserRemovedMessage(parsed);
        }
        if (kind === "remote_user_deleted_message") {
            remoteUserDeletedMessage(parsed);
        }
        if (kind === "remote_user_undeleted_message") {
            replaceMessageContent(parsed.message.messageId, parsed.message.content);
        }
        if (kind === "remote_user_sent_message") {
            remoteUserSentMessage(parsed);
        }
    }

    function remoteUserRemovedMessage(message: RemoteUserRemovedMessage): void {
        unconfirmed.delete(unconfirmedKey, message.messageId);
        removeMessage(message.messageId, message.userId);
    }

    function remoteUserDeletedMessage(message: RemoteUserDeletedMessage): void {
        replaceMessageContent(message.messageId, {
            kind: "deleted_content",
            deletedBy: currentUser.userId,
            timestamp: BigInt(Date.now()),
        });
    }

    function remoteUserToggledReaction(message: RemoteUserToggledReaction): void {
        events.update((events) =>
            toggleReactionInEventList(
                $chat,
                message.userId,
                events,
                message.messageId,
                message.reaction,
                controller.chatUserIds,
                currentUser.userId,
                threadRootMessageIndex
            )
        );
    }

    function remoteUserSentMessage(message: RemoteUserSentMessage) {
        appendMessage(message.messageEvent);

        // since we will only get here if we actually have the thread open
        // we should mark read up to this message too
        messagesRead.markThreadRead(
            $chat.chatId,
            threadRootMessageIndex,
            message.messageEvent.event.messageIndex
        );
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        if (!canSend) return;

        if (textContent || fileToAttach) {
            const storageRequired = getStorageRequiredForMessage(fileToAttach);
            if ($remainingStorage < storageRequired) {
                dispatch("upgrade", "explain");
                return;
            }

            const [nextEventIndex, nextMessageIndex] = getNextEventAndMessageIndexes($events);

            const msg = newMessage(textContent, fileToAttach, nextMessageIndex);
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

            unconfirmed.add(unconfirmedKey, event);
            events.update((evts) => [...evts, event]);
            scrollBottom();
            messagesRead.markThreadRead($chat.chatId, threadRootMessageIndex, nextMessageIndex);

            api.sendMessage($chat, controller.user, mentioned, msg, threadRootMessageIndex)
                .then(([resp, msg]) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        confirmMessage(msg, resp);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            api.refreshAccountBalance(
                                msg.content.transfer.token,
                                currentUser.cryptoAccount
                            );
                        }
                        trackEvent("sent_threaded_message");
                    } else {
                        unconfirmed.delete(unconfirmedKey, msg.messageId);
                        removeMessage(msg.messageId, currentUser.userId);
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                    }
                })
                .catch((err) => {
                    console.log(err);
                    unconfirmed.delete(unconfirmedKey, msg.messageId);
                    removeMessage(msg.messageId, currentUser.userId);
                    toastStore.showFailureToast("errorSendingMessage");
                    rollbar.error("Exception sending message", err);
                });

            rtcConnectionsManager.sendMessage([...controller.chatUserIds], {
                kind: "remote_user_sent_message",
                chatType: $chat.kind,
                chatId: $chat.chatId,
                messageEvent: serialiseMessageForRtc(event),
                userId: currentUser.userId,
                threadRootMessageIndex,
            });
        }
    }

    function confirmMessage(candidate: Message, resp: SendMessageSuccess | TransferSuccess): void {
        if (unconfirmed.delete(unconfirmedKey, candidate.messageId)) {
            const confirmed = {
                event: mergeSendMessageResponse(candidate, resp),
                index: resp.eventIndex,
                timestamp: resp.timestamp,
            };
            events.update((events) =>
                events.map((e) => {
                    if (e.event === candidate) {
                        return confirmed;
                    }
                    return e;
                })
            );
        }
    }

    function removeMessage(messageId: bigint, userId: string) {
        events.update((evts) =>
            evts.filter((e) => e.event.kind !== "message" || e.event.messageId !== messageId)
        );
        if (userId === currentUser.userId) {
            rtcConnectionsManager.sendMessage([...controller.chatUserIds], {
                kind: "remote_user_removed_message",
                chatType: $chat.kind,
                chatId: $chat.chatId,
                messageId: messageId,
                userId: userId,
                threadRootMessageIndex,
            });
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

            const event = { ...editingEvent, event: msg! };
            const original = replaceEvent(event);
            api.editMessage($chat, msg, threadRootMessageIndex)
                .then((resp) => {
                    if (resp !== "success") {
                        rollbar.warn("Error response editing", resp);
                        toastStore.showFailureToast("errorEditingMessage");
                        if (original !== undefined) {
                            replaceEvent(original);
                        }
                    }
                })
                .catch((err) => {
                    rollbar.error("Exception sending message", err);
                    toastStore.showFailureToast("errorEditingMessage");
                    if (original !== undefined) {
                        replaceEvent(original);
                    }
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

    function startTyping() {
        controller.startTyping(threadRootMessageIndex);
    }

    function stopTyping() {
        controller.stopTyping(threadRootMessageIndex);
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
        if (!canCreatePolls($chat)) return;

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
        ev: CustomEvent<{ messageIndex: number; answerIndex: number; type: "register" | "delete" }>
    ) {
        events.update((events) =>
            events.map((e) =>
                updateEventPollContent(
                    ev.detail.messageIndex,
                    ev.detail.answerIndex,
                    ev.detail.type,
                    currentUser.userId,
                    e
                )
            )
        );

        api.registerPollVote(
            $chat,
            ev.detail.messageIndex,
            ev.detail.answerIndex,
            ev.detail.type,
            threadRootMessageIndex
        )
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("poll.voteFailed");
                    rollbar.error("Poll vote failed: ", resp);
                    console.log("poll vote failed: ", resp);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("poll.voteFailed");
                rollbar.error("Poll vote failed: ", err);
                console.log("poll vote failed: ", err);
            });
    }

    function undeleteMessage(message: Message): void {
        rtcConnectionsManager.sendMessage([...controller.chatUserIds], {
            kind: "remote_user_undeleted_message",
            chatType: $chat.kind,
            chatId: $chat.chatId,
            message: message,
            userId: currentUser.userId,
            threadRootMessageIndex,
        });
        replaceMessageContent(BigInt(message.messageId), message.content);
    }

    function deleteMessage(ev: CustomEvent<Message>): void {
        if (ev.detail.messageId === rootEvent.event.messageId) {
            relayPublish({ kind: "relayed_delete_message", message: ev.detail });
            return;
        }

        const messageId = ev.detail.messageId;

        replaceMessageContent(messageId, {
            kind: "deleted_content",
            deletedBy: currentUser.userId,
            timestamp: BigInt(Date.now()),
        });

        api.deleteMessage($chat, messageId, threadRootMessageIndex)
            .then((resp) => {
                // check it worked - undo if it didn't
                if (resp !== "success") {
                    toastStore.showFailureToast("deleteFailed");
                    undeleteMessage(ev.detail);
                }
            })
            .catch((_err) => {
                toastStore.showFailureToast("deleteFailed");
                undeleteMessage(ev.detail);
            });

        rtcConnectionsManager.sendMessage([...controller.chatUserIds], {
            kind: "remote_user_deleted_message",
            chatType: $chat.kind,
            chatId: $chat.chatId,
            messageId: messageId,
            userId: currentUser.userId,
            threadRootMessageIndex,
        });
    }

    function replaceMessageContent(messageId: unknown, content: MessageContent) {
        events.update((evts) =>
            evts.map((e) => {
                if (e.event.kind === "message" && e.event.messageId === messageId) {
                    return { ...e, event: { ...e.event, content } };
                }
                return e;
            })
        );
    }

    function replaceEvent(evt: EventWrapper<ChatEvent>): EventWrapper<ChatEvent> | undefined {
        let original: EventWrapper<ChatEvent> | undefined = undefined;
        events.update((evts) =>
            evts.map((e) => {
                if (e.index === evt.index) {
                    original = e;
                    return evt;
                }
                return e;
            })
        );
        return original;
    }

    function appendMessage(message: EventWrapper<Message>): boolean {
        const existing = $events.find(
            (ev) => ev.event.kind === "message" && ev.event.messageId === message.event.messageId
        );

        if (existing !== undefined) return false;

        events.update((events) => [...events, message]);
        return true;
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

        selectReaction(
            api,
            events,
            $chat,
            currentUser.userId,
            ev.detail.message.messageId,
            ev.detail.reaction,
            controller.chatUserIds,
            currentUser.userId,
            threadRootMessageIndex
        ).then((added) => {
            if (added) {
                trackEvent("reacted_to_message");
            }
        });
    }

    function goToMessageIndex(index: number) {
        if (index < 0) {
            focusMessageIndex = undefined;
            return;
        }

        focusMessageIndex = index;
        const element = document.querySelector(`.thread-messages [data-index='${index}']`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => {
                focusMessageIndex = undefined;
            }, 200);
        } else {
            console.log(`message index ${index} not found`);
        }
    }

    function onGoToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
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
            controller.user.userId,
            ev.detail.sender === controller.user.userId,
            ev.detail
        );
    }

    function copyMessageUrl(ev: CustomEvent<Message>) {
        shareFunctions.copyMessageUrl(
            controller.chatId,
            ev.detail.messageIndex,
            threadRootMessageIndex
        );
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
        token={creatingCryptoTransfer.token}
        draftAmountE8s={creatingCryptoTransfer.amount}
        on:sendTransfer={sendMessageWithContent}
        on:close={() => (creatingCryptoTransfer = undefined)}
        {controller} />
{/if}

<div
    title={$_("goToFirstMessage")}
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
    chatSummary={$chat} />

<div bind:this={messagesDiv} class="thread-messages" on:scroll={onScroll}>
    {#if loading && !initialised}
        <Loading />
    {:else}
        {#each messages as dayGroup, _di (dateGroupKey(dayGroup))}
            <div class="day-group">
                <div class="date-label">
                    {formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
                </div>
                {#each dayGroup as userGroup}
                    {#each userGroup as evt, i (evt.event.messageId.toString())}
                        <ChatMessage
                            senderId={evt.event.sender}
                            focused={evt.event.messageIndex === focusMessageIndex}
                            {observer}
                            confirmed={!unconfirmed.contains(unconfirmedKey, evt.event.messageId)}
                            senderTyping={isTyping(
                                $typing,
                                evt.event.sender,
                                $chat.chatId,
                                threadRootMessageIndex
                            )}
                            readByMe={true}
                            readByThem={true}
                            chatId={$chat.chatId}
                            chatType={$chat.kind}
                            user={controller.user}
                            me={evt.event.sender === currentUser.userId}
                            first={i === 0}
                            last={i + 1 === userGroup.length}
                            {preview}
                            inThread={true}
                            pinned={false}
                            supportsEdit={evt.event.messageId !== rootEvent.event.messageId}
                            supportsReply={evt.event.messageId !== rootEvent.event.messageId}
                            canPin={canPinMessages($chat)}
                            canBlockUser={canBlockUsers($chat)}
                            canDelete={canDeleteOtherUsersMessages($chat)}
                            canSend={canSendMessages($chat, $userStore)}
                            canReact={canReactToMessages($chat)}
                            canReplyInThread={canReplyInThread($chat)}
                            publicGroup={$chat.kind === "group_chat" && $chat.public}
                            editing={$editingEvent === evt}
                            on:chatWith
                            on:goToMessageIndex={onGoToMessageIndex}
                            on:replyPrivatelyTo
                            on:replyTo={replyTo}
                            on:selectReaction={onSelectReaction}
                            on:deleteMessage={deleteMessage}
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
        chat={$chat}
        fileToAttach={$fileToAttach}
        editingEvent={$editingEvent}
        replyingTo={$replyingTo}
        textContent={$textContent}
        participants={$participants}
        blockedUsers={$blockedUsers}
        user={controller.user}
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
        on:startTyping={startTyping}
        on:stopTyping={stopTyping}
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
