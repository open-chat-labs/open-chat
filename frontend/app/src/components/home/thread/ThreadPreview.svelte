<script lang="ts">
    import {
        type ThreadPreview,
        type EventWrapper,
        type Message,
        OpenChat,
        routeForChatIdentifier,
        type MultiUserChat,
        userStore,
        currentUser as user,
        chatListScopeStore as chatListScope,
        chatSummariesStore,
        messagesRead,
        selectedCommunity,
    } from "openchat-client";
    import { pop } from "../../../utils/transition";
    import { _ } from "svelte-i18n";
    import page from "page";
    import ChatMessage from "../ChatMessage.svelte";
    import IntersectionObserverComponent from "../IntersectionObserver.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import { getContext, onMount } from "svelte";
    import { AvatarSize } from "openchat-client";
    import Markdown from "../Markdown.svelte";
    import Avatar from "../../Avatar.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    export let thread: ThreadPreview;
    export let observer: IntersectionObserver;

    $: missingMessages = thread.totalReplies - thread.latestReplies.length;
    $: threadRootMessageIndex = thread.rootMessage.event.messageIndex;
    $: chat = $chatSummariesStore.get(thread.chatId) as MultiUserChat | undefined;
    $: muted = chat?.membership?.notificationsMuted || false;
    $: syncDetails = chat?.membership?.latestThreads?.find(
        (t) => t.threadRootMessageIndex === threadRootMessageIndex,
    );
    $: unreadCount = syncDetails
        ? client.unreadThreadMessageCount(
              thread.chatId,
              threadRootMessageIndex,
              syncDetails.latestMessageIndex,
          )
        : 0;
    $: chatData = {
        name: chat?.name,
        avatarUrl: client.groupAvatarUrl(chat, $selectedCommunity),
    };

    $: grouped = client.groupBySender(thread.latestReplies);

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
            if (lastMsgIdx !== undefined && chat !== undefined) {
                client.markThreadRead(chat.id, threadRootMessageIndex, lastMsgIdx);
            }
        }
    }

    onMount(() => {
        return messagesRead.subscribe(() => {
            if (syncDetails !== undefined) {
                unreadCount = client.unreadThreadMessageCount(
                    thread.chatId,
                    threadRootMessageIndex,
                    syncDetails.latestMessageIndex,
                );
            }
        });
    });

    function selectThread() {
        page(
            `${routeForChatIdentifier($chatListScope.kind, thread.chatId)}/${
                thread.rootMessage.event.messageIndex
            }?open=true`,
        );
    }
</script>

{#if chat !== undefined}
    <div class="wrapper">
        <CollapsibleCard
            on:toggle={() => (open = !open)}
            {open}
            headerText={i18nKey("userInfoHeader")}>
            <div slot="titleSlot" class="header">
                <div class="avatar">
                    <Avatar url={chatData.avatarUrl} size={AvatarSize.Default} />
                </div>
                <div class="details">
                    <div class="title-and-link">
                        <h4 class="title">
                            {(chat.kind === "group_chat" || chat.kind === "channel") && chat.name}
                        </h4>
                        <LinkButton underline="hover" on:click={selectThread}
                            ><Translatable
                                resourceKey={i18nKey("thread.open")} />&#8594;</LinkButton>
                    </div>
                    <div class="root-msg">
                        <Markdown
                            text={client.getContentAsText($_, thread.rootMessage.event.content)}
                            oneLine
                            suppressLinks />
                    </div>
                </div>
                {#if unreadCount > 0}
                    <div
                        in:pop={{ duration: 1500 }}
                        title={$_("chatSummary.unread", {
                            values: { count: unreadCount.toString() },
                        })}
                        class:muted
                        class="unread">
                        {unreadCount > 999 ? "999+" : unreadCount}
                    </div>
                {/if}
            </div>
            <IntersectionObserverComponent on:intersecting={isIntersecting}>
                <div class="body">
                    <div class="root-msg">
                        <ChatMessage
                            sender={$userStore.get(thread.rootMessage.event.sender)}
                            focused={false}
                            {observer}
                            accepted
                            confirmed
                            failed={false}
                            senderTyping={false}
                            readByMe
                            readByThem
                            chatId={thread.chatId}
                            chatType={chat.kind}
                            user={$user}
                            me={thread.rootMessage.event.sender === $user.userId}
                            first
                            last
                            readonly
                            threadRootMessage={thread.rootMessage.event}
                            pinned={false}
                            supportsEdit={false}
                            supportsReply={false}
                            canPin={false}
                            canBlockUsers={false}
                            canDelete={false}
                            canQuoteReply={false}
                            canReact={false}
                            canStartThread={false}
                            publicGroup={chat.kind === "group_chat" && chat.public}
                            editing={false}
                            eventIndex={thread.rootMessage.index}
                            timestamp={thread.rootMessage.timestamp}
                            expiresAt={thread.rootMessage.expiresAt}
                            dateFormatter={(date) => client.toDatetimeString(date)}
                            msg={thread.rootMessage.event}
                            botContext={thread.rootMessage.event.botContext} />
                    </div>
                    {#if missingMessages > 0}
                        <div class="separator">
                            <Translatable
                                resourceKey={i18nKey("thread.moreMessages", {
                                    number: missingMessages.toString(),
                                })} />
                        </div>
                    {/if}
                    {#each grouped as userGroup}
                        {#each userGroup as evt, i (evt.event.messageId)}
                            <ChatMessage
                                sender={$userStore.get(evt.event.sender)}
                                focused={false}
                                {observer}
                                accepted
                                confirmed
                                failed={false}
                                senderTyping={false}
                                readByMe
                                readByThem
                                chatId={thread.chatId}
                                chatType={chat.kind}
                                user={$user}
                                me={evt.event.sender === $user.userId}
                                first={i === 0}
                                last={i === userGroup.length - 1}
                                readonly
                                threadRootMessage={thread.rootMessage.event}
                                pinned={false}
                                supportsEdit={false}
                                supportsReply={false}
                                canPin={false}
                                canBlockUsers={false}
                                canDelete={false}
                                canQuoteReply={false}
                                canReact={false}
                                canStartThread={false}
                                publicGroup={chat.kind === "group_chat" && chat.public}
                                editing={false}
                                eventIndex={evt.index}
                                timestamp={evt.timestamp}
                                expiresAt={evt.expiresAt}
                                dateFormatter={(date) => client.toDatetimeString(date)}
                                msg={evt.event}
                                botContext={evt.event.botContext} />
                        {/each}
                    {/each}
                    <LinkButton underline="hover" on:click={selectThread}
                        ><Translatable
                            resourceKey={i18nKey("thread.openThread")} />&#8594;</LinkButton>
                </div>
            </IntersectionObserverComponent>
        </CollapsibleCard>
    </div>
{/if}

<style lang="scss">
    :global(.threads .link-button) {
        color: var(--timeline-txt);
        @include font(book, normal, fs-90);
        display: block;
        text-align: right;
    }

    :global(.threads .card.bordered) {
        border: none;
        border-top: 1px solid var(--bd);
    }

    .wrapper {
        background-color: var(--thread-preview-bg);
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

        .title-and-link {
            display: flex;
            gap: $sp3;
            align-items: center;
            margin-bottom: $sp1;
        }

        .title {
            @include font(book, normal, fs-100);
            color: var(--txt);
            @include ellipsis();
        }

        .root-msg {
            color: var(--txt-light);
            @include font(book, normal, fs-80);
        }
    }
    .unread {
        @include unread();
        margin: 0 $sp2;

        &.muted {
            background-color: var(--unread-mute);
            text-shadow: none;
        }
    }
</style>
