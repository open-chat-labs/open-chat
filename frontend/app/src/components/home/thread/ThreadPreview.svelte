<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        chatListScopeStore,
        chatSummariesStore,
        currentUserIdStore,
        type EventWrapper,
        type Message,
        messagesRead,
        type MultiUserChat,
        OpenChat,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
        type ThreadPreview,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import { pop } from "../../../utils/transition";
    import Avatar from "../../Avatar.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import Translatable from "../../Translatable.svelte";
    import ChatMessage from "../ChatMessage.svelte";
    import IntersectionObserverComponent from "../IntersectionObserver.svelte";
    import Markdown from "../Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        thread: ThreadPreview;
        observer: IntersectionObserver;
    }

    let { thread, observer }: Props = $props();

    let missingMessages = $derived(thread.totalReplies - thread.latestReplies.length);
    let threadRootMessageIndex = $derived(thread.rootMessage.event.messageIndex);
    let chat = $derived($chatSummariesStore.get(thread.chatId) as MultiUserChat | undefined);
    let muted = $derived(chat?.membership?.notificationsMuted || false);
    let syncDetails = $derived(
        chat?.membership?.latestThreads?.find(
            (t) => t.threadRootMessageIndex === threadRootMessageIndex,
        ),
    );
    let unreadCount = $derived(
        syncDetails
            ? client.unreadThreadMessageCount(
                  thread.chatId,
                  threadRootMessageIndex,
                  syncDetails.latestMessageIndex,
              )
            : 0,
    );
    let chatData = $derived({
        name: chat?.name,
        avatarUrl: client.groupAvatarUrl(chat, $selectedCommunitySummaryStore),
    });

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

    let grouped = $derived(client.groupBySender(thread.latestReplies));

    let open = $state(false);

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

    function selectThread() {
        page(
            `${routeForChatIdentifier($chatListScopeStore.kind, thread.chatId)}/${
                thread.rootMessage.event.messageIndex
            }?open=true`,
        );
    }
</script>

{#if chat !== undefined}
    <div class="wrapper">
        <CollapsibleCard
            onToggle={() => (open = !open)}
            {open}
            headerText={i18nKey("userInfoHeader")}>
            {#snippet titleSlot()}
                <div class="header">
                    <div class="avatar">
                        <Avatar url={chatData.avatarUrl} size={AvatarSize.Default} />
                    </div>
                    <div class="details">
                        <div class="title-and-link">
                            <h4 class="title">
                                {(chat.kind === "group_chat" || chat.kind === "channel") &&
                                    chat.name}
                            </h4>
                            <LinkButton underline="hover" onClick={selectThread}
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
            {/snippet}
            <IntersectionObserverComponent onIntersecting={isIntersecting}>
                <div class="body">
                    <div class="root-msg">
                        <ChatMessage
                            sender={$allUsersStore.get(thread.rootMessage.event.sender)}
                            focused={false}
                            {observer}
                            accepted
                            confirmed
                            failed={false}
                            senderTyping={false}
                            readByMe
                            chatId={thread.chatId}
                            chatType={chat.kind}
                            me={thread.rootMessage.event.sender === $currentUserIdStore}
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
                            senderContext={thread.rootMessage.event.senderContext} />
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
                                sender={$allUsersStore.get(evt.event.sender)}
                                focused={false}
                                {observer}
                                accepted
                                confirmed
                                failed={false}
                                senderTyping={false}
                                readByMe
                                chatId={thread.chatId}
                                chatType={chat.kind}
                                me={evt.event.sender === $currentUserIdStore}
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
                                senderContext={evt.event.senderContext} />
                        {/each}
                    {/each}
                    <LinkButton underline="hover" onClick={selectThread}
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
