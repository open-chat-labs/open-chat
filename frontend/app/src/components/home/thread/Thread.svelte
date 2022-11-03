<script lang="ts">
    import ThreadHeader from "./ThreadHeader.svelte";
    import Footer from "../Footer.svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import {
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageContent,
        ThreadSummary,
        User,
        Cryptocurrency,
        ThreadMessagesLoaded,
        SentThreadMessage,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
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
    import { relayPublish } from "../../../stores/relay";
    import * as shareFunctions from "../../../utils/share";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "stores/toast";

    const FROM_BOTTOM_THRESHOLD = 600;

    const client = getContext<OpenChat>("client");

    export let rootEvent: EventWrapper<Message>;
    export let chat: ChatSummary;

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
    let fromBottom: Writable<number> = writable(0);
    let withinThreshold: Readable<boolean> = derived([fromBottom], ([$fromBottom]) => {
        return $fromBottom < FROM_BOTTOM_THRESHOLD;
    });

    let previousRootEvent: EventWrapper<Message> | undefined;

    $: currentChatMembers = client.currentChatMembers;
    $: selectedChatId = client.selectedChatId;
    $: lastCryptoSent = client.lastCryptoSent;
    $: typing = client.typing;
    $: draftThreadMessages = client.draftThreadMessages;
    $: unconfirmed = client.unconfirmed;
    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: threadEvents = client.threadEvents;

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof SentThreadMessage) {
            onSentMessage(ev.detail);
        }
        if (ev instanceof ThreadMessagesLoaded) {
            if (ev.detail && $withinThreshold) {
                scrollBottom();
            }
            tick().then(() => {
                if (focusMessageIndex !== undefined) {
                    goToMessageIndex(focusMessageIndex);
                }
            });
        }
    }

    $: {
        if (rootEvent.event.messageIndex !== previousRootEvent?.event.messageIndex) {
            // this we move into client.openThread
            previousRootEvent = rootEvent;
            initialised = false;
            if (thread !== undefined) {
                loading = true;
                client
                    .loadThreadMessages(
                        chat.chatId,
                        rootEvent,
                        thread,
                        [0, thread.latestEventIndex],
                        thread.latestEventIndex,
                        false,
                        threadRootMessageIndex,
                        true
                    )
                    .finally(() => {
                        loading = false;
                        initialised = true;
                    });
            } else {
                client.clearThreadEvents();
            }
        } else {
            // we haven't changed the thread we are looking at, but the thread's latest index has changed (i.e. an event has been added by someone else)
            if (
                thread !== undefined &&
                thread.latestEventIndex !== previousRootEvent?.event.thread?.latestEventIndex
            ) {
                loading = true;
                client
                    .loadThreadMessages(
                        chat.chatId,
                        rootEvent,
                        thread,
                        [0, thread.latestEventIndex],
                        (previousRootEvent?.event.thread?.latestEventIndex ?? -1) + 1,
                        true,
                        threadRootMessageIndex,
                        false
                    )
                    .finally(() => {
                        loading = false;
                        initialised = true;
                    });
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
    $: canSend = client.canReplyInThread(chat.chatId);
    $: canReact = client.canReactToMessages(chat.chatId);
    $: messages = client
        .groupEvents([rootEvent, ...$threadEvents])
        .reverse() as EventWrapper<Message>[][][];
    $: preview = client.isPreviewing(chat.chatId);
    $: pollsAllowed = client.canCreatePolls(chat.chatId);
    $: selectedThreadKey = client.selectedThreadKey;

    function onSentMessage(event: EventWrapper<Message>) {
        const summary: ThreadSummary = {
            participantIds: new Set<string>([client.user.userId]),
            numberOfReplies: event.event.messageIndex + 1,
            latestEventIndex: event.index,
            latestEventTimestamp: event.timestamp,
        };
        client.markThreadSummaryUpdated(rootEvent.event.messageId.toString(), summary);
    }

    function calculateFromBottom(): number {
        return -(messagesDiv?.scrollTop ?? 0);
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
            client
                .registerPollVote(
                    $selectedChatId,
                    threadRootMessageIndex,
                    ev.detail.messageId,
                    ev.detail.messageIndex,
                    ev.detail.answerIndex,
                    ev.detail.type
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast("poll.voteFailed");
                    }
                });
        }
    }

    function onDeleteMessage(ev: CustomEvent<Message>): void {
        if (ev.detail.messageId === rootEvent.event.messageId) {
            relayPublish({ kind: "relayed_delete_message", message: ev.detail });
            return;
        }

        client.deleteMessage(chat.chatId, threadRootMessageIndex, ev.detail.messageId);
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
                chat.chatId,
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

    function defaultCryptoTransferReceiver(): string | undefined {
        return $replyingTo?.sender?.userId;
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
                            confirmed={!unconfirmed.contains(
                                $selectedThreadKey ?? "",
                                evt.event.messageId
                            )}
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
                            canPin={client.canPinMessages(chat.chatId)}
                            canBlockUser={client.canBlockUsers(chat.chatId)}
                            canDelete={client.canDeleteOtherUsersMessages(chat.chatId)}
                            canQuoteReply={canSend}
                            canReact={client.canReactToMessages(chat.chatId)}
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
