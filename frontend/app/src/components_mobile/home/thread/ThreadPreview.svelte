<script lang="ts">
    import Spinner from "@src/components/icons/Spinner.svelte";
    import Tooltip from "@src/components/tooltip/Tooltip.svelte";
    import { toastStore } from "@src/stores/toast";
    import { Avatar, BodySmall, Container, CountBadge, Title } from "component-lib";
    import {
        allUsersStore,
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
    import EyeOffIcon from "svelte-material-icons/EyeOffOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
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

    let unfollowing = $state(false);
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

    function unfollow(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        unfollowing = true;
        client
            .followThread(thread.chatId, thread.rootMessage.event, false)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("unfollowThreadFailed"));
                    unfollowing = false;
                }
            })
            .catch(() => (unfollowing = false));
    }
</script>

{#if chat !== undefined}
    <Container padding={["zero", "lg"]}>
        <CollapsibleCard
            onToggle={() => (open = !open)}
            {open}
            headerText={i18nKey("userInfoHeader")}>
            {#snippet titleSlot()}
                <Container
                    supplementalClass={"thread_preview_header"}
                    mainAxisAlignment={"spaceBetween"}
                    crossAxisAlignment={"center"}
                    gap={"lg"}>
                    <div class="avatar">
                        <Avatar url={chatData.avatarUrl} size={"lg"} />
                    </div>
                    <Container width={{ kind: "fill" }} gap={"xxs"} direction={"vertical"}>
                        <Container width={{ kind: "hug" }} gap={"sm"}>
                            <Title ellipsisTruncate fontWeight={"semi-bold"}>
                                {(chat.kind === "group_chat" || chat.kind === "channel") &&
                                    chat.name}
                            </Title>
                            <LinkButton underline="hover" onClick={selectThread}
                                ><Translatable
                                    resourceKey={i18nKey("thread.open")} />&#8594;</LinkButton>
                            <Tooltip position={"bottom"} align={"middle"}>
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <div onclick={unfollow} class="unfollow">
                                    {#if !unfollowing}
                                        <EyeOffIcon
                                            size={"1.2em"}
                                            color={"var(--icon-inverted-txt)"} />
                                    {:else}
                                        <Spinner
                                            backgroundColour={"rgba(0,0,0,0.3)"}
                                            foregroundColour={"var(--button-spinner)"} />
                                    {/if}
                                </div>
                                {#snippet popupTemplate()}
                                    <Translatable resourceKey={i18nKey("unfollowThread")}
                                    ></Translatable>
                                {/snippet}
                            </Tooltip>
                        </Container>
                        <Container
                            gap={"xs"}
                            mainAxisAlignment={"spaceBetween"}
                            crossAxisAlignment={"end"}>
                            <BodySmall ellipsisTruncate colour={"textSecondary"}>
                                <Markdown
                                    text={client.getContentAsText(
                                        $_,
                                        thread.rootMessage.event.content,
                                    )}
                                    oneLine
                                    suppressLinks />
                            </BodySmall>
                            {#if unreadCount > 0}
                                <CountBadge>{unreadCount > 999 ? "999+" : unreadCount}</CountBadge>
                            {/if}
                        </Container>
                    </Container>
                </Container>
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
