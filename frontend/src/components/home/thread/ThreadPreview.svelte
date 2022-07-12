<script lang="ts">
    import type { GroupChatSummary, Message, ThreadPreview } from "../../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { push } from "svelte-spa-router";
    import { chatSummariesStore } from "../../../stores/chat";
    import ChatMessage from "../ChatMessage.svelte";
    import { getContext } from "svelte";
    import { CreatedUser, UserSummary, AvatarSize } from "../../../domain/user/user";
    import Markdown from "../Markdown.svelte";
    import { currentUserKey } from "../../../stores/user";
    import { groupAvatarUrl } from "../../../domain/user/user.utils";
    import Avatar from "../../Avatar.svelte";
    import { getContentAsText } from "../../../domain/chat/chat.utils";

    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let thread: ThreadPreview;

    // TODO - we can pass this in from the top since it doesn't do anything
    let observer: IntersectionObserver = new IntersectionObserver(() => {});

    $: missingMessages = thread.totalReplies - thread.latestReplies.length;

    $: chat = $chatSummariesStore[thread.chatId] as GroupChatSummary;

    $: chatData = {
        name: chat.name,
        avatarUrl: groupAvatarUrl(chat),
    };

    $: user = {
        kind: "user",
        userId: currentUser.userId,
        username: currentUser.username,
        lastOnline: Date.now(),
        updated: BigInt(Date.now()),
    } as UserSummary;

    $: console.log("Thread Preview: ", thread);

    function selectThread() {
        push(`/${thread.chatId}/${thread.rootMessage.event.messageIndex}`);
    }
</script>

<div class="thread" on:click={selectThread}>
    <div class="header">
        <div class="avatar">
            <Avatar url={chatData.avatarUrl} size={AvatarSize.Small} />
        </div>
        <div class="details">
            <h4 class="title">
                {chat.kind === "group_chat" && chat.name}
            </h4>
            <div class="root-msg">
                <Markdown
                    text={getContentAsText(thread.rootMessage.event.content)}
                    oneLine={true}
                    suppressLinks={true}
                    inline={false} />
            </div>
        </div>
    </div>

    <div class="body">
        <div class="root-msg">
            <ChatMessage
                senderId={thread.rootMessage.event.sender}
                focused={false}
                {observer}
                confirmed={true}
                senderTyping={false}
                readByMe={true}
                readByThem={true}
                chatId={thread.chatId}
                chatType={chat.kind}
                {user}
                me={thread.rootMessage.event.sender === currentUser.userId}
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
                eventIndex={thread.rootMessage.index}
                timestamp={thread.rootMessage.timestamp}
                msg={thread.rootMessage.event} />
        </div>
        {#if missingMessages > 0}
            <div class="separator">
                {$_("thread.moreMessages", { values: { number: missingMessages.toString() } })}
            </div>
        {/if}
        {#each thread.latestReplies as evt, i (evt.event.messageId)}
            <ChatMessage
                senderId={evt.event.sender}
                focused={false}
                {observer}
                confirmed={true}
                senderTyping={false}
                readByMe={true}
                readByThem={true}
                chatId={thread.chatId}
                chatType={chat.kind}
                {user}
                me={evt.event.sender === currentUser.userId}
                first={i === 0}
                last={i === thread.latestReplies.length - 1}
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
                eventIndex={evt.index}
                timestamp={evt.timestamp}
                msg={evt.event} />
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
    .header {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        padding: $sp3;
        height: toRem(60);
        margin-bottom: $sp3;
        background-color: var(--section-bg);
        border: 1px solid var(--section-bd);
        color: var(--section-txt);
        gap: $sp4;
    }
    .avatar {
        flex: 0 0 40px;
    }
    .details {
        flex: 1;
        overflow: hidden;

        .title {
            @include font(book, normal, fs-100);
            color: var(--chatSummary-txt1);
            @include ellipsis();
        }

        .root-msg {
            color: var(--chatSummary-txt2);
            @include font(book, normal, fs-80);
        }
    }
</style>
