<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Footer from "../Footer.svelte";
    import type { EventWrapper, Message, ThreadSummary } from "../../../domain/chat/chat";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import type { RemoteData } from "../../../utils/remoteData";
    import Loading from "../../Loading.svelte";
    import { formatMessageDate } from "../../../utils/date";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import type { CreatedUser } from "../../../domain/user/user";
    import { currentUserKey } from "../../../fsm/home.controller";
    import type { ChatController } from "../../../fsm/chat.controller";
    import ChatMessage from "../ChatMessage.svelte";
    import type { MessageReadState } from "../../../stores/markRead";
    import { unconfirmed } from "../../../stores/unconfirmed";
    import {
        canBlockUsers,
        canDeleteOtherUsersMessages,
        canPinMessages,
        canReactToMessages,
        canSendMessages,
        groupEvents,
    } from "../../../domain/chat/chat.utils";
    import { userStore } from "../../../stores/user";
    import { threadStore } from "../../../stores/thread";
    import { derived, readable } from "svelte/store";
    import { draftThreadMessages } from "../../../stores/draftThreadMessages";

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let controller: ChatController;
    export let threadSummary: ThreadSummary | undefined;
    export let rootEvent: EventWrapper<Message>;

    let observer: IntersectionObserver = new IntersectionObserver(() => {});

    $: chat = controller.chat;
    $: messageIndex = rootEvent.event.messageIndex;

    // TODO - all these things need to be stored in their own store rather than the chat controller
    // should we create a threadController or is it better to try to get away from controllers
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

    let messages: RemoteData<EventWrapper<Message>[][][], string> = { kind: "idle" };

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    onMount(() => {
        // fake load of message thread
        setTimeout(() => {
            console.log("ThreadSummary: ", threadSummary);
            if (threadSummary !== undefined) {
                messages = {
                    kind: "success",
                    data: groupEvents(
                        [rootEvent, ...($threadStore[rootEvent.event.messageIndex] ?? [])] ?? [
                            rootEvent,
                        ]
                    ) as EventWrapper<Message>[][][],
                };
            }
        }, 1000);
    });

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

    function sendMessage(ev: CustomEvent<EventWrapper<Message>>): void {
        console.log("send message");
    }

    function cancelReply() {
        console.log("cancel reply");
    }

    function clearAttachment() {
        console.log("clearAttachment");
    }

    function cancelEditEvent() {
        console.log("cancelEditEvent");
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

    function fileSelected() {
        console.log("fileSelected");
    }

    function attachGif() {
        console.log("attachGif");
    }

    function tokenTransfer() {
        console.log("tokenTransfer");
    }

    function searchChat() {
        console.log("searchChat");
    }

    function createPoll() {
        console.log("createPoll");
    }
</script>

<SectionHeader flush={true} shadow={true}>
    <h4>{$_("thread.title")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="thread-messages">
    {#if messages.kind !== "success"}
        <Loading />
    {:else}
        {#each messages.data as dayGroup, _di (dateGroupKey(dayGroup))}
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
                            pinned={$pinned.has(evt.event.messageIndex)}
                            canPin={canPinMessages($chat)}
                            canBlockUser={canBlockUsers($chat)}
                            canDelete={canDeleteOtherUsersMessages($chat)}
                            canSend={canSendMessages($chat, $userStore)}
                            canReact={canReactToMessages($chat)}
                            publicGroup={$chat.kind === "group_chat" && $chat.public}
                            editing={$editingEvent === evt}
                            threadSummary={undefined}
                            on:chatWith
                            on:goToMessageIndex
                            on:replyPrivatelyTo
                            on:replyTo
                            on:replyInThread
                            on:selectReaction
                            on:deleteMessage
                            on:blockUser
                            on:pinMessage
                            on:unpinMessage
                            on:registerVote
                            on:editMessage
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
    on:searchChat={searchChat}
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
