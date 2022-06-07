<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Footer from "../Footer.svelte";
    import type { EventWrapper, Message } from "../../../domain/chat/chat";
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
    } from "domain/chat/chat.utils";
    import { userStore } from "../../../stores/user";
    import { threadStore, threadSummaryStore } from "../../../stores/thread";

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let controller: ChatController;
    export let threadId: string | undefined;

    let observer: IntersectionObserver = new IntersectionObserver(() => {});

    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: editingEvent = controller.editingEvent;
    $: replyingTo = controller.replyingTo;
    $: textContent = controller.textContent;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;
    $: markRead = controller.markRead;
    $: pinned = controller.pinnedMessages;
    $: blocked = $chat.kind === "direct_chat" && $blockedUsers.has($chat.them);

    let footer: Footer;
    let messages: RemoteData<EventWrapper<Message>[][], string> = { kind: "idle" };

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    /**
     * We need to manage a list of events here *and* potentially a draft event.
     *
     * AND we need that draft event to be persisted if we close the thread. So we need a thread store (which still only offers in memory persistence).
     *
     * The footer *must* be decoupled from the chat controller
     */

    onMount(() => {
        // fake load of message thread
        setTimeout(() => {
            console.log("ThreadId: ", threadId);
            if (threadId !== undefined) {
                messages = { kind: "success", data: [$threadStore[threadId] ?? []] };
            }
        }, 1000);
    });

    function dateGroupKey(group: EventWrapper<Message>[]): string {
        const first = group[0] && group[0] && group[0].timestamp;
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
                    {formatMessageDate(dayGroup[0]?.timestamp, $_("today"), $_("yesterday"))}
                </div>
                {#each dayGroup as message, _i (message.event.messageId)}
                    <ChatMessage
                        senderId={message.event.sender}
                        focused={false}
                        {observer}
                        confirmed={!unconfirmed.contains($chat.chatId, message.event.messageId)}
                        readByMe={isReadByMe($markRead, message)}
                        readByThem={false}
                        chatId={$chat.chatId}
                        chatType={$chat.kind}
                        user={controller.user}
                        me={message.event.sender === currentUser.userId}
                        first={true}
                        last={false}
                        preview={false}
                        pinned={$pinned.has(message.event.messageIndex)}
                        canPin={canPinMessages($chat)}
                        canBlockUser={canBlockUsers($chat)}
                        canDelete={canDeleteOtherUsersMessages($chat)}
                        canSend={canSendMessages($chat, $userStore)}
                        canReact={canReactToMessages($chat)}
                        publicGroup={$chat.kind === "group_chat" && $chat.public}
                        editing={$editingEvent === message}
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
                        eventIndex={message.index}
                        timestamp={message.timestamp}
                        msg={message.event} />
                {/each}
            </div>
        {/each}
    {/if}
</div>

<Footer
    bind:this={footer}
    thread={true}
    joining={undefined}
    preview={false}
    {blocked}
    chat={$chat}
    fileToAttach={$fileToAttach}
    editingEvent={$editingEvent}
    replyingTo={$replyingTo}
    textContent={$textContent}
    participants={$participants}
    blockedUsers={$blockedUsers}
    {controller}
    on:joinGroup
    on:cancelPreview
    on:upgrade
    on:attachGif
    on:cancelReply
    on:tokenTransfer
    on:searchChat
    on:createPoll />

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
