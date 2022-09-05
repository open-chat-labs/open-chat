<script lang="ts">
    import type {
        ThreadPreview,
        GroupChatSummary,
        EventWrapper,
        Message,
    } from "../../../domain/chat/chat";
    import { pop } from "../../../utils/transition";
    import { _ } from "svelte-i18n";
    import { push } from "svelte-spa-router";
    import { chatSummariesStore } from "../../../stores/chat";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ChatMessage from "../ChatMessage.svelte";
    import IntersectionObserverComponent from "../IntersectionObserver.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import { getContext, onDestroy } from "svelte";
    import { CreatedUser, AvatarSize } from "../../../domain/user/user";
    import Markdown from "../Markdown.svelte";
    import { currentUserKey } from "../../../stores/user";
    import { groupAvatarUrl } from "../../../domain/user/user.utils";
    import Avatar from "../../Avatar.svelte";
    import { getContentAsText, groupBySender } from "../../../domain/chat/chat.utils";
    import LinkButton from "../../LinkButton.svelte";
    import { messagesRead } from "../../../stores/markRead";
    import { toDatetimeString } from "../../../utils/date";

    const currentUser = getContext<CreatedUser>(currentUserKey);

    export let thread: ThreadPreview;
    export let observer: IntersectionObserver;

    $: missingMessages = thread.totalReplies - thread.latestReplies.length;
    $: threadRootMessageIndex = thread.rootMessage.event.messageIndex;
    $: chat = $chatSummariesStore[thread.chatId] as GroupChatSummary;
    $: syncDetails = chat?.latestThreads?.find(
        (t) => t.threadRootMessageIndex === threadRootMessageIndex
    );
    $: unreadCount = syncDetails
        ? messagesRead.unreadThreadMessageCount(
              thread.chatId,
              threadRootMessageIndex,
              syncDetails.latestMessageIndex
          )
        : 0;
    $: chatData = {
        name: chat.name,
        avatarUrl: groupAvatarUrl(chat),
    };
    $: user = {
        kind: "user" as "user",
        userId: currentUser.userId,
        username: currentUser.username,
        lastOnline: Date.now(),
        updated: BigInt(Date.now()),
    };

    $: grouped = groupBySender(thread.latestReplies);

    let open = false;

    function lastMessageIndex(events: EventWrapper<Message>[]): number | undefined {
        for (let i = events.length - 1; i >= 0; i--) {
            const evt = events[i].event;
            if (evt.kind === "message") {
                return evt.messageIndex;
            }
        }
        return undefined;
    }

    function isIntersecting() {
        // if we can see *all* of the unread messages in this thread, then mark it as read.
        if (unreadCount > 0 && unreadCount < thread.latestReplies.length + 1) {
            const lastMsgIdx = lastMessageIndex(thread.latestReplies);
            if (lastMsgIdx !== undefined) {
                console.log("Marking thread as read");
                messagesRead.markThreadRead(chat.chatId, threadRootMessageIndex, lastMsgIdx);
            }
        }
    }

    const unsub = messagesRead.subscribe(() => {
        if (syncDetails !== undefined) {
            unreadCount = messagesRead.unreadThreadMessageCount(
                thread.chatId,
                threadRootMessageIndex,
                syncDetails.latestMessageIndex
            );
        }
    });

    function selectThread() {
        push(`/${thread.chatId}/${thread.rootMessage.event.messageIndex}?open=true`);
    }

    onDestroy(unsub);
</script>

<div class="wrapper">
    <CollapsibleCard
        transparent={true}
        bordered={$mobileWidth}
        on:toggle={() => (open = !open)}
        {open}
        headerText={$_("userInfoHeader")}>
        <div slot="titleSlot" class="header">
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
                        suppressLinks={true} />
                </div>
            </div>
            {#if unreadCount > 0}
                <div
                    in:pop={{ duration: 1500 }}
                    title={$_("chatSummary.unread", { values: { count: unreadCount.toString() } })}
                    class="unread">
                    {unreadCount > 999 ? "999+" : unreadCount}
                </div>
            {/if}
        </div>
        <IntersectionObserverComponent on:intersecting={isIntersecting}>
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
                        canQuoteReply={false}
                        canReact={false}
                        canStartThread={false}
                        publicGroup={chat.kind === "group_chat" && chat.public}
                        editing={false}
                        eventIndex={thread.rootMessage.index}
                        timestamp={thread.rootMessage.timestamp}
                        dateFormatter={toDatetimeString}
                        msg={thread.rootMessage.event} />
                </div>
                {#if missingMessages > 0}
                    <div class="separator">
                        {$_("thread.moreMessages", {
                            values: { number: missingMessages.toString() },
                        })}
                    </div>
                {/if}
                {#each grouped as userGroup}
                    {#each userGroup as evt, i (evt.event.messageId)}
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
                            last={i === userGroup.length - 1}
                            preview={true}
                            inThread={true}
                            pinned={false}
                            supportsEdit={false}
                            supportsReply={false}
                            canPin={false}
                            canBlockUser={false}
                            canDelete={false}
                            canQuoteReply={false}
                            canReact={false}
                            canStartThread={false}
                            publicGroup={chat.kind === "group_chat" && chat.public}
                            editing={false}
                            eventIndex={evt.index}
                            timestamp={evt.timestamp}
                            dateFormatter={toDatetimeString}
                            msg={evt.event} />
                    {/each}
                {/each}
                <LinkButton underline="hover" on:click={selectThread}
                    >{$_("thread.openThread")}&#8594;</LinkButton>
            </div>
        </IntersectionObserverComponent>
    </CollapsibleCard>
</div>

<style type="text/scss">
    :global(.threads .link-button) {
        color: var(--timeline-txt);
        @include font(book, normal, fs-90);
        display: block;
        text-align: right;
    }

    :global(.threads .card > .header) {
        padding: $sp3;
    }

    :global(.threads .card.bordered) {
        border: none;
        border-top: var(--collapsible-header-bd);
    }

    .wrapper {
        background-color: var(--thread-preview-bg);
        margin-bottom: $sp3;

        @include mobile() {
            margin-bottom: 0;
        }
    }
    .separator {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-90);
    }
    .header {
        position: relative;
        display: flex;
        align-items: center;
        width: calc(100% - 24px);
        color: var(--section-txt);
        gap: $sp4;

        @include mobile() {
            gap: $sp3;
        }
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
    .unread {
        @include unread();
        margin: 0 $sp2;
    }
</style>
