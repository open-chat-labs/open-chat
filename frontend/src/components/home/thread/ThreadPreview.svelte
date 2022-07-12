<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import type { ThreadPreview } from "../../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { push } from "svelte-spa-router";
    import { chatSummariesStore } from "../../../stores/chat";
    import ChatMessage from "../ChatMessage.svelte";
    import { getContext } from "svelte";
    import type { CreatedUser, UserSummary } from "../../../domain/user/user";
    import { currentUserKey } from "../../../stores/user";

    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let thread: ThreadPreview;

    // TODO - we can pass this in from the top since it doesn't do anything
    let observer: IntersectionObserver = new IntersectionObserver(() => {});

    $: missingMessages = thread.totalReplies - thread.latestReplies.length;

    $: chat = $chatSummariesStore[thread.chatId];

    $: user = {
        kind: "user",
        userId: currentUser.userId,
        username: currentUser.username,
        lastOnline: Date.now(),
        updated: BigInt(Date.now()),
    } as UserSummary;

    $: console.log("Thread Preview: ", thread);

    function selectThread() {
        push(`/${thread.chatId}/${thread.rootMessage.messageIndex}`);
    }
</script>

<div class="thread" on:click={selectThread}>
    <SectionHeader flush gap>
        <h4 class="title">
            {chat.kind === "group_chat" && chat.name}
        </h4>
    </SectionHeader>

    <div class="body">
        <div class="root-msg">
            <ChatMessage
                senderId={thread.rootMessage.sender}
                focused={false}
                {observer}
                confirmed={true}
                senderTyping={false}
                readByMe={true}
                readByThem={true}
                chatId={thread.chatId}
                chatType={chat.kind}
                {user}
                me={thread.rootMessage.sender === currentUser.userId}
                first={true}
                last={true}
                preview={true}
                inThread={true}
                pinned={false}
                supportsEdit={false}
                supportsReply={false}
                canPin={false}
                canBlockUser={false}
                canDelete={false}
                canSend={false}
                canReact={false}
                canReplyInThread={false}
                publicGroup={chat.kind === "group_chat" && chat.public}
                editing={false}
                eventIndex={0}
                timestamp={BigInt(0)}
                msg={thread.rootMessage} />
        </div>
        {#if missingMessages > 0}
            <div class="separator">
                {$_("thread.moreMessages", { values: { number: missingMessages.toString() } })}
            </div>
        {/if}
        {#each thread.latestReplies.reverse() as msg, i (msg.messageId)}
            <ChatMessage
                senderId={msg.sender}
                focused={false}
                {observer}
                confirmed={true}
                senderTyping={false}
                readByMe={true}
                readByThem={true}
                chatId={thread.chatId}
                chatType={chat.kind}
                {user}
                me={msg.sender === currentUser.userId}
                first={true}
                last={true}
                preview={true}
                inThread={true}
                pinned={false}
                supportsEdit={false}
                supportsReply={false}
                canPin={false}
                canBlockUser={false}
                canDelete={false}
                canSend={false}
                canReact={false}
                canReplyInThread={false}
                publicGroup={chat.kind === "group_chat" && chat.public}
                editing={false}
                eventIndex={0}
                timestamp={BigInt(0)}
                {msg} />
        {/each}
    </div>
</div>

<style type="text/scss">
    .thread {
        background-color: var(--currentChat-msgs-bg);
        background-color: rgba(255, 255, 255, 0.1);
        margin-bottom: $sp4;
        cursor: pointer;

        &:last-child {
            margin-bottom: 0;
        }

        .separator {
            padding: $sp2;
            background-color: var(--timeline-bg);
            margin: $sp4 auto;
            text-align: center;
            color: var(--timeline-txt);
            @include font(book, normal, fs-90);
        }
    }
    .body {
        padding: $sp4;
    }
</style>
