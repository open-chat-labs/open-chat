<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        Avatar,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        CountBadge,
        IconButton,
        MenuItem,
        MenuTrigger,
        Title,
    } from "component-lib";
    import {
        allUsersStore,
        chatSummariesStore,
        currentUserIdStore,
        type EventWrapper,
        type Message,
        messagesRead,
        type MultiUserChat,
        OpenChat,
        selectedCommunitySummaryStore,
        type ThreadPreview,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
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

    let expanded = $state(false);
    let missingMessages = $derived(thread.totalReplies - thread.latestReplies.length);
    let threadRootMessageIndex = $derived(thread.rootMessage.event.messageIndex);
    let chat = $derived($chatSummariesStore.get(thread.chatId) as MultiUserChat | undefined);
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

    function markAllRead() {
        if (chat !== undefined && syncDetails !== undefined) {
            const context = {
                chatId: chat.id,
                threadRootMessageIndex,
            };
            messagesRead.markReadUpTo(context, syncDetails?.latestMessageIndex);
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

    let grouped = $derived(client.groupBySender(thread.latestReplies));

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

    function clickedThread() {
        if (expanded) {
            selectThread();
        } else {
            expanded = true;
        }
    }

    function selectThread() {
        /**
         * Note that we are deliberately not changing the route here. This is kind of
         * peaking a thread, rather than loading it.
         * This *should* make loading the thread faster because we don't load the chat and its
         * messages *as well*.
         */
        client.openThread(thread.chatId, thread.rootMessage, false);
    }

    function unfollow() {
        client.followThread(thread.chatId, thread.rootMessage.event, false).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("unfollowThreadFailed"));
            }
        });
    }
</script>

{#if chat !== undefined}
    <Container direction={"vertical"}>
        <Container
            background={ColourVars.background1}
            padding={["lg", "md"]}
            onClick={clickedThread}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            gap={"md"}>
            <div class="avatar">
                <Avatar url={chatData.avatarUrl} size={"lg"} />
            </div>
            <Container width={{ kind: "fill" }} gap={"xxs"} direction={"vertical"}>
                <Container width={{ kind: "hug" }} gap={"sm"}>
                    <Title ellipsisTruncate fontWeight={"semi-bold"}>
                        {(chat.kind === "group_chat" || chat.kind === "channel") && chat.name}
                    </Title>
                </Container>
                <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
                    <BodySmall ellipsisTruncate colour={"textSecondary"}>
                        <Markdown
                            text={client.getContentAsText($_, thread.rootMessage.event.content)}
                            oneLine
                            suppressLinks />
                    </BodySmall>
                </Container>
            </Container>
            {#if unreadCount > 0}
                <CountBadge>{unreadCount > 999 ? "999+" : unreadCount}</CountBadge>
            {/if}
            <MenuTrigger position={"bottom"} align={"end"}>
                <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                    {#snippet icon(color)}
                        <DotsVertical {color} />
                    {/snippet}
                </IconButton>
                {#snippet menuItems()}
                    <MenuItem onclick={unfollow}>
                        <Translatable resourceKey={i18nKey("unfollowThread")} />
                    </MenuItem>
                    <MenuItem onclick={markAllRead}>
                        <Translatable resourceKey={i18nKey("Mark all as read")} />
                    </MenuItem>
                {/snippet}
            </MenuTrigger>
        </Container>
        {#if expanded}
            <IntersectionObserverComponent onIntersecting={isIntersecting}>
                <Container gap={"sm"} padding={"md"} direction={"vertical"}>
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
                        eventIndex={thread.rootMessage.index}
                        timestamp={thread.rootMessage.timestamp}
                        expiresAt={thread.rootMessage.expiresAt}
                        dateFormatter={(date) => client.toDatetimeString(date)}
                        msg={thread.rootMessage.event}
                        senderContext={thread.rootMessage.event.senderContext} />
                    {#if missingMessages > 0}
                        <BodySmall
                            height={{ kind: "fixed", size: "2rem" }}
                            colour={"textSecondary"}
                            align={"center"}
                            fontWeight={"bold"}>
                            <Translatable
                                resourceKey={i18nKey("thread.moreMessages", {
                                    number: missingMessages.toString(),
                                })} />
                        </BodySmall>
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
                                eventIndex={evt.index}
                                timestamp={evt.timestamp}
                                expiresAt={evt.expiresAt}
                                dateFormatter={(date) => client.toDatetimeString(date)}
                                msg={evt.event}
                                senderContext={evt.event.senderContext} />
                        {/each}
                    {/each}

                    <Container mainAxisAlignment={"end"}>
                        <CommonButton mode={"active"} size={"medium"} onClick={selectThread}>
                            <Translatable resourceKey={i18nKey("View thread")} />
                        </CommonButton>
                    </Container>
                </Container>
            </IntersectionObserverComponent>
        {/if}
    </Container>
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

    .separator {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-90);
    }

    .unfollow {
        padding: 0 $sp2;
    }
</style>
