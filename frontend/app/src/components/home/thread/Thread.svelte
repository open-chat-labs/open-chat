<script lang="ts">
    import ThreadHeader from "./ThreadHeader.svelte";
    import Footer from "../Footer.svelte";
    import type {
        AttachmentContent,
        ChatSummary,
        ChatEvent as ChatEventType,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        OpenChat,
        User,
        TimelineItem,
        MessageContent,
    } from "openchat-client";
    import {
        AttachGif,
        CreatePoll,
        CreateTestMessages,
        LEDGER_CANISTER_ICP,
        TokenTransfer,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Loading from "../../Loading.svelte";
    import { derived, readable } from "svelte/store";
    import PollBuilder from "../PollBuilder.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import MemeBuilder from "../MemeBuilder.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import { toastStore } from "../../../stores/toast";
    import ChatEvent from "../ChatEvent.svelte";
    import ChatEventList from "../ChatEventList.svelte";
    import { randomSentence } from "../../../utils/randomMsg";
    import TimelineDate from "../TimelineDate.svelte";
    import { reverseScroll } from "../../../stores/scrollPos";
    import { i18nKey } from "../../../i18n/i18n";
    import P2PSwapContentBuilder from "../P2PSwapContentBuilder.svelte";
    import AreYouSure from "../../AreYouSure.svelte";
    import {
        currentUser as user,
        focusThreadMessageIndex as focusMessageIndex,
        lastCryptoSent,
        draftMessagesStore,
        unconfirmed,
        messagesRead,
        currentChatBlockedUsers,
        threadEvents,
        failedMessagesStore,
        expandedDeletedMessages,
        threadsFollowedByMeStore,
    } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let rootEvent: EventWrapper<Message>;
    export let chat: ChatSummary;

    let chatEventList: ChatEventList | undefined;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let memeBuilder: MemeBuilder;
    let creatingPoll = false;
    let creatingCryptoTransfer: { ledger: string; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let buildingMeme = false;
    let initialised = false;
    let messagesDiv: HTMLDivElement | undefined;
    let messagesDivHeight: number;
    let creatingP2PSwapMessage = false;
    let removeLinkPreviewDetails: { event: EventWrapper<Message>; url: string } | undefined =
        undefined;

    $: threadRootMessageIndex = rootEvent.event.messageIndex;
    $: messageContext = { chatId: chat.id, threadRootMessageIndex };
    $: threadRootMessage = rootEvent.event;
    $: blocked = chat.kind === "direct_chat" && $currentChatBlockedUsers.has(chat.them.userId);
    $: draftMessage = readable(draftMessagesStore.get(messageContext), (set) =>
        draftMessagesStore.subscribe((d) => set(d.get(messageContext) ?? {})),
    );
    $: textContent = derived(draftMessage, (d) => d.textContent);
    $: replyingTo = derived(draftMessage, (d) => d.replyingTo);
    $: attachment = derived(draftMessage, (d) => d.attachment);
    $: editingEvent = derived(draftMessage, (d) => d.editingEvent);
    $: canSendAny = client.canSendMessage(chat.id, "thread");
    $: canReact = client.canReactToMessages(chat.id);
    $: atRoot = $threadEvents.length === 0 || $threadEvents[0]?.index === 0;
    $: events = atRoot ? [rootEvent, ...$threadEvents] : $threadEvents;
    $: timeline = client.groupEvents(
        $reverseScroll ? [...events].reverse() : events,
        $user.userId,
        $expandedDeletedMessages,
        $reverseScroll,
    ) as TimelineItem<Message>[];
    $: readonly = client.isChatReadOnly(chat.id);
    $: thread = rootEvent.event.thread;
    $: loading = !initialised && $threadEvents.length === 0 && thread !== undefined;
    $: isFollowedByMe =
        $threadsFollowedByMeStore.get(chat.id)?.has(threadRootMessageIndex) ?? false;

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof CreatePoll) {
            if (
                ev.detail.chatId === messageContext.chatId &&
                ev.detail.threadRootMessageIndex === messageContext.threadRootMessageIndex
            ) {
                createPoll();
            }
        }
        if (ev instanceof TokenTransfer) {
            const { context } = ev.detail;
            if (
                context.chatId === messageContext.chatId &&
                context.threadRootMessageIndex === messageContext.threadRootMessageIndex
            ) {
                tokenTransfer(ev);
            }
        }
        if (ev instanceof AttachGif) {
            const [evContext, search] = ev.detail;
            if (
                evContext.chatId === messageContext.chatId &&
                evContext.threadRootMessageIndex === messageContext.threadRootMessageIndex
            ) {
                attachGif(new CustomEvent("openchat_client", { detail: search }));
            }
        }
        if (ev instanceof CreateTestMessages) {
            const [{ chatId, threadRootMessageIndex }, num] = ev.detail;
            if (
                chatId === messageContext.chatId &&
                threadRootMessageIndex === messageContext.threadRootMessageIndex
            ) {
                createTestMessages(num);
            }
        }
    }

    function createTestMessages(total: number): void {
        function send(n: number) {
            if (n === total) return;

            sendMessageWithAttachment(randomSentence(), false, undefined);

            window.setTimeout(() => send(n + 1), 500);
        }

        send(0);
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[], boolean]>) {
        if (!canSendAny) return;
        let [text, mentioned, blockLevelMarkdown] = ev.detail;
        if ($editingEvent !== undefined) {
            client
                .editMessageWithAttachment(
                    messageContext,
                    text,
                    blockLevelMarkdown,
                    $attachment,
                    $editingEvent,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("errorEditingMessage"));
                    }
                });
        } else {
            sendMessageWithAttachment(text, blockLevelMarkdown, $attachment, mentioned);
        }
    }

    function editEvent(ev: EventWrapper<Message>): void {
        draftMessagesStore.setEditing(messageContext, ev);
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        blockLevelMarkdown: boolean,
        attachment: AttachmentContent | undefined,
        mentioned: User[] = [],
    ) {
        client.sendMessageWithAttachment(
            messageContext,
            textContent,
            blockLevelMarkdown,
            attachment,
            mentioned,
        );
    }

    function cancelReply() {
        draftMessagesStore.setReplyingTo(messageContext, undefined);
    }

    function clearAttachment() {
        draftMessagesStore.setAttachment(messageContext, undefined);
    }

    function cancelEditEvent() {
        draftMessagesStore.delete(messageContext);
    }

    function setTextContent(ev: CustomEvent<string | undefined>) {
        draftMessagesStore.setTextContent(messageContext, ev.detail);
    }

    function onStartTyping() {
        client.startTyping(chat, $user.userId, threadRootMessageIndex);
    }

    function onStopTyping() {
        client.stopTyping(chat, $user.userId, threadRootMessageIndex);
    }

    function fileSelected(ev: CustomEvent<AttachmentContent>) {
        draftMessagesStore.setAttachment(messageContext, ev.detail);
    }

    function tokenTransfer(ev: CustomEvent<{ ledger: string; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            ledger: $lastCryptoSent ?? LEDGER_CANISTER_ICP,
            amount: BigInt(0),
        };
    }

    function createPoll() {
        if (!client.canSendMessage(chat.id, "thread", "poll")) return;

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

    function makeMeme() {
        buildingMeme = true;
        if (memeBuilder !== undefined) {
            memeBuilder.reset();
        }
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        draftMessagesStore.setReplyingTo(messageContext, ev.detail);
    }

    function defaultCryptoTransferReceiver(): string | undefined {
        return $replyingTo?.sender?.userId;
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "message") {
            return e.event.messageId.toString();
        } else {
            return e.index.toString();
        }
    }

    function goToMessageIndex(index: number) {
        chatEventList?.scrollToMessageIndex(messageContext, index, false);
    }

    function onGoToMessageIndex(
        ev: CustomEvent<{ index: number; preserveFocus: boolean; messageId: bigint }>,
    ) {
        goToMessageIndex(ev.detail.index);
    }

    function createP2PSwapMessage() {
        creatingP2PSwapMessage = true;
    }

    function onRemovePreview(ev: CustomEvent<{ event: EventWrapper<Message>; url: string }>): void {
        removeLinkPreviewDetails = ev.detail;
    }

    function removePreview(yes: boolean): Promise<void> {
        if (removeLinkPreviewDetails !== undefined && yes) {
            const { event, url } = removeLinkPreviewDetails;

            client.hideLinkPreview(messageContext, event, url).then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("errorRemovingLinkPreview"));
                }
            });
        }

        removeLinkPreviewDetails = undefined;
        return Promise.resolve();
    }

    function sendMessageWithContent(ev: CustomEvent<{ content: MessageContent }>) {
        client.sendMessageWithContent(messageContext, ev.detail.content, false);
    }
</script>

{#if removeLinkPreviewDetails !== undefined}
    <AreYouSure title={i18nKey("removePreviewQuestion")} action={removePreview} />
{/if}

<PollBuilder
    on:sendMessageWithContent={sendMessageWithContent}
    bind:this={pollBuilder}
    bind:open={creatingPoll} />

{#if creatingP2PSwapMessage}
    <P2PSwapContentBuilder
        fromLedger={$lastCryptoSent ?? LEDGER_CANISTER_ICP}
        {messageContext}
        on:upgrade
        on:close={() => (creatingP2PSwapMessage = false)} />
{/if}

<GiphySelector
    on:sendMessageWithContent={sendMessageWithContent}
    bind:this={giphySelector}
    bind:open={selectingGif} />

<MemeBuilder
    on:sendMessageWithContent={sendMessageWithContent}
    bind:this={memeBuilder}
    bind:open={buildingMeme} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        {chat}
        ledger={creatingCryptoTransfer.ledger}
        draftAmount={creatingCryptoTransfer.amount}
        defaultReceiver={defaultCryptoTransferReceiver()}
        {messageContext}
        on:upgrade
        on:close={() => (creatingCryptoTransfer = undefined)} />
{/if}

<ThreadHeader
    {threadRootMessageIndex}
    on:createPoll={createPoll}
    on:closeThread
    {rootEvent}
    chatSummary={chat} />

<ChatEventList
    threadRootEvent={rootEvent}
    rootSelector={"thread-messages"}
    maintainScroll={false}
    bind:this={chatEventList}
    scrollTopButtonEnabled
    {readonly}
    unreadMessages={0}
    firstUnreadMention={undefined}
    footer
    {events}
    {chat}
    bind:initialised
    bind:messagesDiv
    bind:messagesDivHeight
    let:isAccepted
    let:isConfirmed
    let:isFailed
    let:isReadByMe
    let:messageObserver
    let:labelObserver>
    {#if loading}
        <Loading />
    {:else}
        {#each timeline as timelineItem}
            {#if timelineItem.kind === "timeline_date"}
                <TimelineDate observer={labelObserver} timestamp={timelineItem.timestamp} />
            {:else}
                {#each timelineItem.group as userGroup}
                    {#each userGroup as evt, i (eventKey(evt))}
                        <ChatEvent
                            chatId={chat.id}
                            chatType={chat.kind}
                            user={$user}
                            event={evt}
                            first={$reverseScroll ? i + 1 === userGroup.length : i === 0}
                            last={$reverseScroll ? i === 0 : i + 1 === userGroup.length}
                            me={evt.event.sender === $user.userId}
                            accepted={isAccepted($unconfirmed, evt)}
                            confirmed={isConfirmed($unconfirmed, evt)}
                            failed={isFailed($failedMessagesStore, evt)}
                            readByMe={evt.event.messageId === rootEvent.event.messageId ||
                                !isFollowedByMe ||
                                isReadByMe($messagesRead, evt)}
                            readByThem
                            observer={messageObserver}
                            focused={evt.event.kind === "message" &&
                                $focusMessageIndex === evt.event.messageIndex}
                            {readonly}
                            {threadRootMessage}
                            pinned={false}
                            supportsEdit={evt.event.messageId !== rootEvent.event.messageId}
                            supportsReply={evt.event.messageId !== rootEvent.event.messageId}
                            canPin={client.canPinMessages(chat.id)}
                            canBlockUsers={client.canBlockUsers(chat.id)}
                            canDelete={client.canDeleteOtherUsersMessages(chat.id)}
                            publicGroup={(chat.kind === "group_chat" || chat.kind === "channel") &&
                                chat.public}
                            editing={$editingEvent === evt}
                            canSendAny
                            {canReact}
                            canInvite={false}
                            canReplyInThread={false}
                            collapsed={false}
                            on:chatWith
                            on:removePreview={onRemovePreview}
                            on:goToMessageIndex={onGoToMessageIndex}
                            on:replyPrivatelyTo
                            on:replyTo={replyTo}
                            on:editEvent={() => editEvent(evt)}
                            on:replyTo={replyTo}
                            on:upgrade
                            on:startVideoCall
                            on:forward />
                    {/each}
                {/each}
            {/if}
        {/each}
    {/if}
</ChatEventList>

{#if !readonly}
    <Footer
        {chat}
        attachment={$attachment}
        editingEvent={$editingEvent}
        replyingTo={$replyingTo}
        textContent={$textContent}
        user={$user}
        joining={undefined}
        preview={false}
        lapsed={false}
        mode={"thread"}
        {blocked}
        {messageContext}
        on:joinGroup
        on:cancelPreview
        on:upgrade
        on:cancelReply={cancelReply}
        on:clearAttachment={clearAttachment}
        on:cancelEditEvent={cancelEditEvent}
        on:setTextContent={setTextContent}
        on:startTyping={onStartTyping}
        on:stopTyping={onStopTyping}
        on:fileSelected={fileSelected}
        on:audioCaptured={fileSelected}
        on:sendMessage={sendMessage}
        on:attachGif={attachGif}
        on:makeMeme={makeMeme}
        on:tokenTransfer={tokenTransfer}
        on:createP2PSwapMessage={createP2PSwapMessage}
        on:createPoll={createPoll} />
{/if}
