<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Footer from "../Footer.svelte";
    import type {
        ChatEvent,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageContent,
    } from "../../../domain/chat/chat";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { formatMessageDate } from "../../../utils/date";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import type { CreatedUser, User } from "../../../domain/user/user";
    import { currentUserKey } from "../../../stores/user";
    import type { ChatController } from "../../../fsm/chat.controller";
    import ChatMessage from "../ChatMessage.svelte";
    import { unconfirmed } from "../../../stores/unconfirmed";
    import {
        canBlockUsers,
        canCreatePolls,
        canDeleteOtherUsersMessages,
        canPinMessages,
        canReactToMessages,
        canSendMessages,
        createMessage,
        getMessageContent,
        getStorageRequiredForMessage,
        groupEvents,
    } from "../../../domain/chat/chat.utils";
    import { userStore } from "../../../stores/user";
    import { getNextEventAndMessageIndexes, threadStore } from "../../../stores/thread";
    import { derived, readable } from "svelte/store";
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
    import { dedupe } from "utils/list";

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let controller: ChatController;
    export let rootEvent: EventWrapper<Message>;

    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let focusMessageIndex: number | undefined = undefined;
    let loading = false;

    let previousRootEvent: EventWrapper<Message> | undefined;

    let events: EventWrapper<ChatEvent>[] = [];

    $: {
        if (rootEvent.event.messageIndex !== previousRootEvent?.event.messageIndex) {
            console.log("thread: loading old ", thread?.latestEventIndex ?? 0);
            previousRootEvent = rootEvent;
            events = [];

            if (thread !== undefined) {
                loadThreadMessages(
                    [0, thread.latestEventIndex],
                    thread.latestEventIndex,
                    false,
                    threadRootMessageIndex
                );
            }
        } else {
            // we haven't changed the thread we are looking at, but the threads latest index has changed (i.e. an event has been added by someone else)
            if (
                thread !== undefined &&
                thread.latestEventIndex !== previousRootEvent?.event.thread?.latestEventIndex
            ) {
                console.log(
                    "thread: loading new ",
                    previousRootEvent?.event.thread?.latestEventIndex ?? 0
                );
                loadThreadMessages(
                    [0, thread.latestEventIndex],
                    (previousRootEvent?.event.thread?.latestEventIndex ?? -1) + 1,
                    true,
                    threadRootMessageIndex
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
    $: messages = groupEvents([rootEvent, ...events]).reverse() as EventWrapper<Message>[][][];

    const dispatch = createEventDispatcher();

    async function loadThreadMessages(
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number
    ): Promise<void> {
        if (thread === undefined || controller.chatVal === undefined) return;
        loading = true;

        const eventsPromise =
            controller.chatVal.kind === "direct_chat"
                ? api.directChatEvents(
                      range,
                      controller.chatVal.them,
                      startIndex,
                      ascending,
                      threadRootMessageIndex
                  )
                : api.groupChatEvents(
                      range,
                      controller.chatVal.chatId,
                      startIndex,
                      ascending,
                      threadRootMessageIndex
                  );

        const eventsResponse = await eventsPromise;

        if (eventsResponse !== undefined && eventsResponse !== "events_failed") {
            events = dedupe(
                (a, b) => a.index === b.index,
                [...events, ...eventsResponse.events].sort((a, b) => a.index - b.index)
            );
        }

        console.log("Events: ", events);
        loading = false;
    }

    function close() {
        dispatch("close");
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

    // todo - lots of duplication here with chatController.editEvent
    // todo - there is a problem when editing the root message of a thread (in either middle or thread panel)
    // the edit needs to also be reflected in the other window - maybe this will just work when the update loop stuff is done
    function editEvent(ev: EventWrapper<Message>): void {
        draftThreadMessages.setEditingEvent(threadRootMessageIndex, ev);
        draftThreadMessages.setAttachment(
            threadRootMessageIndex,
            ev.event.content.kind !== "text_content" ? ev.event.content : undefined
        );
        draftThreadMessages.setReplyingTo(
            threadRootMessageIndex,
            ev.event.repliesTo && ev.event.repliesTo.kind === "rehydrated_reply_context"
                ? {
                      ...ev.event.repliesTo,
                      content: ev.event.content,
                      sender: $userStore[ev.event.sender],
                  }
                : undefined
        );
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

            const [nextEventIndex, nextMessageIndex] = getNextEventAndMessageIndexes(events);

            const msg = newMessage(textContent, fileToAttach, nextMessageIndex);
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

            unconfirmed.add($chat.chatId, event);
            events = [...events, event];

            api.sendMessage($chat, controller.user, mentioned, msg, threadRootMessageIndex)
                .then((resp) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        unconfirmed.delete($chat.chatId, msg.messageId);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            api.refreshAccountBalance(
                                msg.content.transfer.token,
                                currentUser.cryptoAccount
                            );
                        }
                        replaceMessage({
                            ...event,
                            index: resp.eventIndex,
                            event: { ...event.event, messageIndex: resp.messageIndex },
                        });
                        trackEvent("sent_threaded_message");
                    } else {
                        removeMessage(msg);
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                    }
                })
                .catch((err) => {
                    console.log(err);
                    unconfirmed.delete($chat.chatId, msg.messageId);
                    removeMessage(msg);
                    toastStore.showFailureToast("errorSendingMessage");
                    rollbar.error("Exception sending message", err);
                });
        }
    }

    function replaceMessage(evt: EventWrapper<Message>) {
        events = events.map((e) => {
            return e.event.kind === "message" && e.event.messageId === evt.event.messageId
                ? evt
                : e;
        });
    }

    function removeMessage(msg: Message) {
        events = events.filter(
            (e) => e.event.kind !== "message" || e.event.messageId !== msg.messageId
        );
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
        controller.startTyping();
    }

    function stopTyping() {
        controller.stopTyping();
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
        console.log("register vote - todo");

        // update the store
        threadStore.registerVote(
            threadRootMessageIndex,
            ev.detail.messageIndex,
            ev.detail.answerIndex,
            ev.detail.type,
            currentUser.userId
        );

        // make the api call
        const promise =
            $chat.kind === "group_chat"
                ? api.registerGroupChatPollVote(
                      $chat.chatId,
                      ev.detail.messageIndex,
                      ev.detail.answerIndex,
                      ev.detail.type,
                      threadRootMessageIndex
                  )
                : api.registerDirectChatPollVote(
                      $chat.them,
                      ev.detail.messageIndex,
                      ev.detail.answerIndex,
                      ev.detail.type,
                      threadRootMessageIndex
                  );

        promise
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

    function deleteMessage(ev: CustomEvent<Message>): void {
        replaceMessageContent(ev.detail.messageId, {
            kind: "deleted_content",
            deletedBy: currentUser.userId,
            timestamp: BigInt(Date.now()),
        });

        const apiPromise =
            $chat.kind === "group_chat"
                ? api.deleteGroupMessage($chat.chatId, ev.detail.messageId, threadRootMessageIndex)
                : api.deleteDirectMessage($chat.them, ev.detail.messageId, threadRootMessageIndex);

        apiPromise
            .then((resp) => {
                // check it worked - undo if it didn't
                if (resp !== "success") {
                    toastStore.showFailureToast("deleteFailed");
                    replaceMessageContent(ev.detail.messageId, ev.detail.content);
                }
            })
            .catch((_err) => {
                toastStore.showFailureToast("deleteFailed");
                replaceMessageContent(ev.detail.messageId, ev.detail.content);
            });
    }

    function replaceMessageContent(messageId: unknown, content: MessageContent) {
        events = events.map((e) => {
            return e.event.kind === "message" && e.event.messageId === messageId
                ? { ...e, event: { ...e.event, content } }
                : e;
        });
    }

    function replaceEvent(evt: EventWrapper<ChatEvent>): EventWrapper<ChatEvent> | undefined {
        let original: EventWrapper<ChatEvent> | undefined = undefined;
        events = events.map((e) => {
            if (e.index === evt.index) {
                original = e;
                return evt;
            }
            return e;
        });
        return original;
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        draftThreadMessages.setReplyingTo(threadRootMessageIndex, ev.detail);
    }

    function selectReaction(ev: CustomEvent<{ message: Message; reaction: string }>) {
        if (!canReact) return;
        // optimistic update

        // todo - we need to separate what this controller method does so that we can have a thread version
        // and that needs to be done in a way that minimises duplication
        // controller.toggleReaction(
        //     ev.detail.message.messageId,
        //     ev.detail.reaction,
        //     controller.user.userId
        // );

        const apiPromise =
            $chat.kind === "group_chat"
                ? api.toggleGroupChatReaction(
                      $chat.chatId,
                      ev.detail.message.messageId,
                      ev.detail.reaction,
                      threadRootMessageIndex
                  )
                : api.toggleDirectChatReaction(
                      $chat.them,
                      ev.detail.message.messageId,
                      ev.detail.reaction,
                      threadRootMessageIndex
                  );

        apiPromise
            .then((resp) => {
                if (resp !== "added" && resp !== "removed") {
                    // toggle again to undo
                    console.log("Reaction failed: ", resp);
                    // controller.toggleReaction(
                    //     ev.detail.message.messageId,
                    //     ev.detail.reaction,
                    //     controller.user.userId
                    // );
                } else {
                    if (resp === "added") {
                        trackEvent("reacted_to_message");
                    }
                }
            })
            .catch((err) => {
                // toggle again to undo
                console.log("Reaction failed: ", err);
                // controller.toggleReaction(
                //     ev.detail.message.messageId,
                //     ev.detail.reaction,
                //     controller.user.userId
                // );
            });
    }

    // TODO - this is another piece of (almost) duplication that we need to get rid of
    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
        if (ev.detail.index < 0) {
            focusMessageIndex = undefined;
            return;
        }

        focusMessageIndex = ev.detail.index;
        const element = document.querySelector(
            `.thread-messages [data-index='${ev.detail.index}']`
        );
        if (element) {
            element.scrollIntoView({ behavior: "auto", block: "center" });
            setTimeout(() => {
                focusMessageIndex = undefined;
            }, 200);
        } else {
            console.log(`message index ${ev.detail.index} not found`);
        }
    }

    function userGroupKey(group: EventWrapper<Message>[]): string {
        return group[0].event.sender;
    }

    $: console.log("Grouped: ", messages);
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

<SectionHeader flush={true} shadow={true}>
    <h4>{$_("thread.title")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="thread-messages">
    {#each messages as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
            </div>
            {#each dayGroup as userGroup}
                {#each userGroup as evt, _i (evt.event.messageId.toString())}
                    <ChatMessage
                        senderId={evt.event.sender}
                        focused={evt.event.messageIndex === focusMessageIndex}
                        {observer}
                        confirmed={!unconfirmed.contains($chat.chatId, evt.event.messageId)}
                        readByMe={true}
                        readByThem={true}
                        chatId={$chat.chatId}
                        chatType={$chat.kind}
                        user={controller.user}
                        me={evt.event.sender === currentUser.userId}
                        first={true}
                        last={false}
                        preview={false}
                        inThread={true}
                        pinned={false}
                        canPin={canPinMessages($chat)}
                        canBlockUser={canBlockUsers($chat)}
                        canDelete={canDeleteOtherUsersMessages($chat)}
                        canSend={canSendMessages($chat, $userStore)}
                        canReact={canReactToMessages($chat)}
                        publicGroup={$chat.kind === "group_chat" && $chat.public}
                        editing={$editingEvent === evt}
                        selectedThreadMessageIndex={undefined}
                        on:chatWith
                        on:goToMessageIndex={goToMessageIndex}
                        on:replyPrivatelyTo
                        on:replyTo={replyTo}
                        on:replyInThread
                        on:selectReaction={selectReaction}
                        on:deleteMessage={deleteMessage}
                        on:blockUser
                        on:pinMessage
                        on:unpinMessage
                        on:registerVote={registerVote}
                        on:editMessage={() => editEvent(evt)}
                        on:upgrade
                        on:forward
                        eventIndex={evt.index}
                        timestamp={evt.timestamp}
                        msg={evt.event} />
                {/each}
            {/each}
        </div>
    {/each}
</div>

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
    on:startTyping={startTyping}
    on:stopTyping={stopTyping}
    on:fileSelected={fileSelected}
    on:audioCaptured={fileSelected}
    on:sendMessage={sendMessage}
    on:attachGif={attachGif}
    on:tokenTransfer={tokenTransfer}
    on:createPoll={createPoll} />

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .close {
        flex: 0 0 30px;
    }
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
</style>
