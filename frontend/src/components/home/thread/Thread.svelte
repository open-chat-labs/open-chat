<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Footer from "../Footer.svelte";
    import type {
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageContent,
        ThreadSummary,
    } from "../../../domain/chat/chat";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { formatMessageDate } from "../../../utils/date";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import type { CreatedUser, User } from "../../../domain/user/user";
    import { currentUserKey } from "../../../fsm/home.controller";
    import type { ChatController } from "../../../fsm/chat.controller";
    import ChatMessage from "../ChatMessage.svelte";
    import type { MessageReadState } from "../../../stores/markRead";
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
    import {
        getNextEventAndMessageIndexes,
        threadStore,
        threadSummaryStore,
    } from "../../../stores/thread";
    import { derived, readable } from "svelte/store";
    import { draftThreadMessages } from "../../../stores/draftThreadMessages";
    import { remainingStorage } from "../../../stores/storage";
    import PollBuilder from "../PollBuilder.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import type { Cryptocurrency } from "../../../domain/crypto";
    import { lastCryptoSent } from "../../../stores/crypto";
    import { trackEvent } from "../../../utils/tracking";

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let controller: ChatController;
    export let threadSummary: ThreadSummary | undefined;
    export let rootEvent: EventWrapper<Message>;

    let observer: IntersectionObserver = new IntersectionObserver(() => {});
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;

    $: {
        window.setTimeout(() => {
            // todo this annoyingly fires twice - sigh
            console.log("adding root message to thread");
            threadStore.addMessageToThread(rootEvent.event.messageIndex, rootEvent, rootEvent);
        }, 500);
    }

    $: chat = controller.chat;
    $: messageIndex = rootEvent.event.messageIndex;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;
    $: markRead = controller.markRead;
    $: pinned = controller.pinnedMessages;
    $: blocked = $chat.kind === "direct_chat" && $blockedUsers.has($chat.them);
    $: draftMessage = readable(draftThreadMessages.get(messageIndex), (set) =>
        draftThreadMessages.subscribe((d) => set(d[messageIndex] ?? {}))
    );
    $: textContent = derived(draftMessage, (d) => d.textContent);
    $: replyingTo = derived(draftMessage, (d) => d.replyingTo);
    $: fileToAttach = derived(draftMessage, (d) => d.attachment);
    $: editingEvent = derived(draftMessage, (d) => d.editingEvent);
    $: canSend = canSendMessages($chat, $userStore);
    $: canReact = canReactToMessages($chat);
    $: messages = groupEvents(
        $threadStore[rootEvent.event.messageIndex] ?? []
    ).reverse() as EventWrapper<Message>[][][];

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function dateGroupKey(group: EventWrapper<Message>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function isReadByMe(_store: MessageReadState, evt: EventWrapper<Message>): boolean {
        if (evt.event.kind === "message") {
            return controller.markRead.isRead(
                $chat.chatId,
                evt.event.messageIndex,
                evt.event.messageId
            );
        }
        return true;
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        console.log("send message: ", ev.detail);
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            editMessageWithAttachment(text, $fileToAttach, $editingEvent);
        } else {
            sendMessageWithAttachment(text, mentioned, $fileToAttach);
        }
        draftThreadMessages.delete(messageIndex);
    }

    // todo - lots of duplication here with chatController.editEvent
    // todo - there is a problem when editing the root message of a thread (in either middle or thread panel)
    // the edit needs to also be reflected in the other window - maybe this will just work when the update loop stuff is done
    function editEvent(ev: EventWrapper<Message>): void {
        draftThreadMessages.setEditingEvent(messageIndex, ev);
        draftThreadMessages.setAttachment(
            messageIndex,
            ev.event.content.kind !== "text_content" ? ev.event.content : undefined
        );
        draftThreadMessages.setReplyingTo(
            messageIndex,
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

            const [nextEventIndex, nextMessageIndex] = getNextEventAndMessageIndexes(
                $threadStore,
                messageIndex
            );

            const msg = newMessage(textContent, fileToAttach, nextMessageIndex);

            // we don't have an api for this yet so let's just write the message to the thread store
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };
            threadStore.addMessageToThread(messageIndex, rootEvent, event);

            // api.sendMessage($chat, controller.user, mentioned, msg)
            //     .then((resp) => {
            //         if (resp.kind === "success" || resp.kind === "transfer_success") {
            //             controller.confirmMessage(msg, resp);
            //             if (msg.kind === "message" && msg.content.kind === "crypto_content") {
            //                 api.refreshAccountBalance(
            //                     msg.content.transfer.token,
            //                     currentUser.cryptoAccount
            //                 );
            //             }
            //             if ($chat.kind === "direct_chat") {
            //                 trackEvent("sent_direct_message");
            //             } else {
            //                 if ($chat.public) {
            //                     trackEvent("sent_public_group_message");
            //                 } else {
            //                     trackEvent("sent_private_group_message");
            //                 }
            //             }
            //             if (msg.repliesTo !== undefined) {
            //                 // double counting here which I think is OK since we are limited to string events
            //                 trackEvent("replied_to_message");
            //             }
            //         } else {
            //             controller.removeMessage(msg.messageId, controller.user.userId);
            //             rollbar.warn("Error response sending message", resp);
            //             toastStore.showFailureToast("errorSendingMessage");
            //         }
            //     })
            //     .catch((err) => {
            //         controller.removeMessage(msg.messageId, controller.user.userId);
            //         console.log(err);
            //         toastStore.showFailureToast("errorSendingMessage");
            //         rollbar.error("Exception sending message", err);
            //     });
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
            threadStore.replaceMessageInThread(messageIndex, event);
            // controller.sendMessage(event);

            // api.editMessage($chat, msg!)
            //     .then((resp) => {
            //         if (resp !== "success") {
            //             rollbar.warn("Error response editing", resp);
            //             toastStore.showFailureToast("errorEditingMessage");
            //         }
            //     })
            //     .catch((err) => {
            //         rollbar.error("Exception sending message", err);
            //         toastStore.showFailureToast("errorEditingMessage");
            //     });
        }
    }

    function cancelReply() {
        draftThreadMessages.setReplyingTo(messageIndex, undefined);
    }

    function clearAttachment() {
        draftThreadMessages.setAttachment(messageIndex, undefined);
    }

    function cancelEditEvent() {
        draftThreadMessages.delete(messageIndex);
    }

    function setTextContent(ev: CustomEvent<string | undefined>) {
        draftThreadMessages.setTextContent(messageIndex, ev.detail);
    }

    function startTyping() {
        controller.startTyping();
    }

    function stopTyping() {
        controller.stopTyping();
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        draftThreadMessages.setAttachment(messageIndex, ev.detail);
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

    function deleteMessage(ev: CustomEvent<Message>): void {
        threadStore.replaceMessageContent(rootEvent.event.messageIndex, ev.detail.messageIndex, {
            kind: "deleted_content",
            deletedBy: currentUser.userId,
            timestamp: BigInt(Date.now()),
        });
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        draftThreadMessages.setReplyingTo(messageIndex, ev.detail);
    }

    function selectReaction(ev: CustomEvent<{ message: Message; reaction: string }>) {
        if (!canReact) return;
        // optimistic update

        // todo - this is not exactly going to work at the moment because the controller method goes through the list of
        // loaded events whereas we need to go through the thread events
        controller.toggleReaction(
            ev.detail.message.messageId,
            ev.detail.reaction,
            controller.user.userId
        );

        // const apiPromise =
        //     $chat.kind === "group_chat"
        //         ? api.toggleGroupChatReaction(
        //               $chat.chatId,
        //               ev.detail.message.messageId,
        //               ev.detail.reaction
        //           )
        //         : api.toggleDirectChatReaction(
        //               $chat.them,
        //               ev.detail.message.messageId,
        //               ev.detail.reaction
        //           );

        // apiPromise
        //     .then((resp) => {
        //         if (resp !== "added" && resp !== "removed") {
        //             // toggle again to undo
        //             controller.toggleReaction(
        //                 ev.detail.message.messageId,
        //                 ev.detail.reaction,
        //                 controller.user.userId
        //             );
        //         } else {
        //             if (resp === "added") {
        //                 trackEvent("reacted_to_message");
        //             }
        //         }
        //     })
        //     .catch((err) => {
        //         // toggle again to undo
        //         console.log("Reaction failed: ", err);
        //         controller.toggleReaction(
        //             ev.detail.message.messageId,
        //             ev.detail.reaction,
        //             controller.user.userId
        //         );
        //     });
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
            {#each dayGroup as userGroup, _ui (controller.userGroupKey(userGroup))}
                {#each userGroup as evt, _i (evt.event.messageId.toString())}
                    <ChatMessage
                        senderId={evt.event.sender}
                        focused={false}
                        {observer}
                        confirmed={!unconfirmed.contains($chat.chatId, evt.event.messageId)}
                        readByMe={isReadByMe($markRead, evt)}
                        readByThem={false}
                        chatId={$chat.chatId}
                        chatType={$chat.kind}
                        user={controller.user}
                        me={evt.event.sender === currentUser.userId}
                        first={true}
                        last={false}
                        preview={false}
                        inThread={true}
                        pinned={$pinned.has(evt.event.messageIndex)}
                        canPin={canPinMessages($chat)}
                        canBlockUser={canBlockUsers($chat)}
                        canDelete={canDeleteOtherUsersMessages($chat)}
                        canSend={canSendMessages($chat, $userStore)}
                        canReact={canReactToMessages($chat)}
                        publicGroup={$chat.kind === "group_chat" && $chat.public}
                        editing={$editingEvent === evt}
                        threadSummary={undefined}
                        selectedThreadMessageIndex={undefined}
                        on:chatWith
                        on:goToMessageIndex
                        on:replyPrivatelyTo
                        on:replyTo={replyTo}
                        on:replyInThread
                        on:selectReaction={selectReaction}
                        on:deleteMessage={deleteMessage}
                        on:blockUser
                        on:pinMessage
                        on:unpinMessage
                        on:registerVote
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
