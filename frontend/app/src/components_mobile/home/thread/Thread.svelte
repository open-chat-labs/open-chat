<script lang="ts">
    import { activeVideoCall } from "@src/stores/video";
    import { removeQueryStringParam, stripThreadFromUrl } from "@src/utils/urls";
    import { ColourVars, Container, onSwipeRight } from "component-lib";
    import type {
        AttachmentContent,
        ChatEvent as ChatEventType,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageContent,
        MessageContext,
        OpenChat,
        TimelineItem,
        User,
    } from "openchat-client";
    import {
        allUsersStore,
        currentUserIdStore,
        currentUserStore,
        failedMessagesStore,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        localUpdates,
        messageContextsEqual,
        messagesRead,
        pageReplace,
        publish,
        selectedChatBlockedUsersStore,
        selectedChatExpandedDeletedMessageStore,
        selectedThreadDraftMessageStore,
        subscribe,
        threadEventsStore,
        threadsFollowedByMeStore,
        unconfirmedStore,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import { randomSentence } from "../../../utils/randomMsg";
    import AreYouSure from "../../AreYouSure.svelte";
    import Loading from "../../Loading.svelte";
    import ChatEvent from "../ChatEvent.svelte";
    import ChatEventList from "../ChatEventList.svelte";
    import CryptoTransferBuilder from "../CryptoTransferBuilder.svelte";
    import DropTarget from "../DropTarget.svelte";
    import Footer from "../Footer.svelte";
    import GiphySelector from "../GiphySelector.svelte";
    import MemeBuilder from "../MemeBuilder.svelte";
    import P2PSwapContentBuilder from "../P2PSwapContentBuilder.svelte";
    import PollBuilder from "../PollBuilder.svelte";
    import TimelineDate from "../TimelineDate.svelte";
    import ThreadHeader from "./ThreadHeader.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        rootEvent: EventWrapper<Message>;
        chat: ChatSummary;
    }

    let { rootEvent, chat }: Props = $props();

    let chatEventList: ChatEventList | undefined = $state();
    //@ts-ignore
    let pollBuilder: PollBuilder = $state();
    //@ts-ignore
    let giphySelector: GiphySelector = $state();
    //@ts-ignore
    let memeBuilder: MemeBuilder = $state();
    let creatingPoll = $state(false);
    let creatingCryptoTransfer: { ledger: string; amount: bigint } | undefined = $state(undefined);
    let selectingGif = $state(false);
    let buildingMeme = $state(false);
    let initialised = $state(false);
    let messagesDiv: HTMLDivElement | undefined = $state();
    let messagesDivHeight: number = $state(0);
    let creatingP2PSwapMessage = $state(false);
    let removeLinkPreviewDetails: { event: EventWrapper<Message>; url: string } | undefined =
        $state(undefined);

    let threadRootMessageIndex = $derived(rootEvent?.event?.messageIndex ?? 0);
    let messageContext = $derived({ chatId: chat.id, threadRootMessageIndex });
    let threadRootMessage = $derived(rootEvent.event);
    let blocked = $derived(
        chat.kind === "direct_chat" && $selectedChatBlockedUsersStore.has(chat.them.userId),
    );
    let textContent = $derived($selectedThreadDraftMessageStore?.textContent);
    let replyingTo = $derived($selectedThreadDraftMessageStore?.replyingTo);
    let attachment = $derived($selectedThreadDraftMessageStore?.attachment);
    let editingEvent = $derived($selectedThreadDraftMessageStore?.editingEvent);
    let canSendAny = $derived(client.canSendMessage(chat.id, "thread"));
    let canReact = $derived(client.canReactToMessages(chat.id));
    let atRoot = $derived($threadEventsStore.length === 0 || $threadEventsStore[0]?.index === 0);
    let events = $derived(atRoot ? [rootEvent, ...$threadEventsStore] : $threadEventsStore);
    let timeline = $derived(
        client.groupEvents(
            [...events].reverse(),
            $currentUserIdStore,
            chat.kind === "channel" && chat.public,
            $selectedChatExpandedDeletedMessageStore,
        ) as TimelineItem<Message>[],
    );
    let readonly = $derived(client.isChatReadOnly(chat.id));
    let thread = $derived(rootEvent.event.thread);
    let loading = $derived(!initialised && $threadEventsStore.length === 0 && thread !== undefined);
    let isFollowedByMe = $derived(
        $threadsFollowedByMeStore.get(chat.id)?.has(threadRootMessageIndex) ?? false,
    );

    function onCloseThread() {
        pageReplace(stripThreadFromUrl(removeQueryStringParam("open")));
        activeVideoCall.threadOpen(false);
        publish("closeModalPage");
    }

    onMount(() => {
        const unsubs = [
            subscribe("createPoll", onCreatePoll),
            subscribe("attachGif", onAttachGif),
            subscribe("tokenTransfer", onTokenTransfer),
            subscribe("createTestMessages", onCreateTestMessages),
        ];
        return () => {
            unsubs.forEach((u) => u());
        };
    });

    function onCreatePoll(ctx: MessageContext) {
        if (messageContextsEqual(ctx, messageContext)) {
            createPoll();
        }
    }

    function onAttachGif([evContext, search]: [MessageContext, string]) {
        if (messageContextsEqual(messageContext, evContext)) {
            attachGif(search);
        }
    }

    function onTokenTransfer(args: { context: MessageContext; ledger?: string; amount?: bigint }) {
        if (messageContextsEqual(messageContext, args.context)) {
            tokenTransfer(args);
        }
    }

    function onCreateTestMessages([ctx, num]: [MessageContext, number]) {
        if (messageContextsEqual(ctx, messageContext)) {
            createTestMessages(num);
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

    function onSendMessage(detail: [string | undefined, User[], boolean]) {
        if (!canSendAny) return;
        let [text, mentioned, blockLevelMarkdown] = detail;
        if (editingEvent !== undefined) {
            client
                .editMessageWithAttachment(
                    messageContext,
                    text,
                    blockLevelMarkdown,
                    attachment,
                    editingEvent,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("errorEditingMessage"));
                    }
                });
        } else {
            sendMessageWithAttachment(text, blockLevelMarkdown, attachment, mentioned);
        }
    }

    function editEvent(ev: EventWrapper<Message>): void {
        localUpdates.draftMessages.setEditing(messageContext, ev, $allUsersStore);
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

    function onCancelReply() {
        localUpdates.draftMessages.setReplyingTo(messageContext, undefined);
    }

    function clearAttachment() {
        localUpdates.draftMessages.setAttachment(messageContext, undefined);
    }

    function cancelEditEvent() {
        localUpdates.draftMessages.delete(messageContext);
    }

    function onSetTextContent(txt?: string) {
        localUpdates.draftMessages.setTextContent(messageContext, txt);
    }

    function onStartTyping() {
        if (chat !== undefined) {
            client.startTyping(chat.id, $currentUserIdStore, threadRootMessageIndex);
        }
    }

    function onStopTyping() {
        if (chat !== undefined) {
            client.stopTyping(chat.id, $currentUserIdStore, threadRootMessageIndex);
        }
    }

    function onFileSelected(content: AttachmentContent) {
        localUpdates.draftMessages.setAttachment(messageContext, content);
    }

    function tokenTransfer(detail: { ledger?: string; amount?: bigint }) {
        creatingCryptoTransfer = {
            ledger: detail.ledger ?? $lastCryptoSent ?? LEDGER_CANISTER_ICP,
            amount: detail.amount ?? BigInt(0),
        };
    }

    function createPoll() {
        if (!client.canSendMessage(chat.id, "thread", "poll")) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function attachGif(search: string) {
        selectingGif = true;
        if (giphySelector !== undefined) {
            giphySelector.reset(search);
        }
    }

    function makeMeme() {
        buildingMeme = true;
        if (memeBuilder !== undefined) {
            memeBuilder.reset();
        }
    }

    function replyTo(replyContext: EnhancedReplyContext) {
        localUpdates.draftMessages.setReplyingTo(messageContext, replyContext);
    }

    function defaultCryptoTransferReceiver(): string | undefined {
        return replyingTo?.sender?.userId;
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "message") {
            return `${e.index}_${e.event.messageId}`;
        } else {
            return e.index.toString();
        }
    }

    function goToMessageIndex(index: number) {
        chatEventList?.scrollToMessageIndex(messageContext, index, false);
    }

    function onGoToMessageIndex(detail: { index: number }) {
        goToMessageIndex(detail.index);
    }

    function createP2PSwapMessage() {
        creatingP2PSwapMessage = true;
    }

    function onRemovePreview(event: EventWrapper<Message>, url: string): void {
        removeLinkPreviewDetails = {
            event,
            url,
        };
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

    function toggleMessageExpansion(ew: EventWrapper<ChatEventType>, expand: boolean) {
        if (ew.event.kind === "message" && ew.event.content.kind === "proposal_content") {
            client.toggleProposalFilterMessageExpansion(ew.event.messageId, expand);
        }
    }

    function onSendMessageWithContent(content: MessageContent) {
        client.sendMessageWithContent(messageContext, content, false);
    }
</script>

{#if removeLinkPreviewDetails !== undefined}
    <AreYouSure title={i18nKey("removePreviewQuestion")} action={removePreview} />
{/if}

<PollBuilder onSend={onSendMessageWithContent} bind:this={pollBuilder} bind:open={creatingPoll} />

{#if creatingP2PSwapMessage}
    <P2PSwapContentBuilder
        fromLedger={$lastCryptoSent ?? LEDGER_CANISTER_ICP}
        {messageContext}
        onClose={() => (creatingP2PSwapMessage = false)} />
{/if}

<GiphySelector
    onSend={onSendMessageWithContent}
    bind:this={giphySelector}
    bind:open={selectingGif} />

<MemeBuilder onSend={onSendMessageWithContent} bind:this={memeBuilder} bind:open={buildingMeme} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        {chat}
        ledger={creatingCryptoTransfer.ledger}
        draftAmount={creatingCryptoTransfer.amount}
        defaultReceiver={defaultCryptoTransferReceiver()}
        {messageContext}
        onClose={() => (creatingCryptoTransfer = undefined)} />
{/if}

<DropTarget {chat} mode={"thread"} {onFileSelected}>
    <Container
        onSwipe={onSwipeRight(onCloseThread)}
        background={ColourVars.background0}
        height={{ kind: "fill" }}
        direction={"vertical"}>
        <ThreadHeader {threadRootMessageIndex} {onCloseThread} {rootEvent} chatSummary={chat} />
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
            visible
            {events}
            {chat}
            bind:initialised
            bind:messagesDiv
            bind:messagesDivHeight>
            {#snippet children({
                isAccepted,
                isConfirmed,
                isFailed,
                isReadByMe,
                messageObserver,
                labelObserver,
                focusIndex,
            })}
                {#if loading}
                    <Loading />
                {:else}
                    {#each timeline as timelineItem}
                        {#if timelineItem.kind === "timeline_date"}
                            <TimelineDate
                                observer={labelObserver}
                                timestamp={timelineItem.timestamp} />
                        {:else}
                            {#each timelineItem.group as userGroup}
                                {#each userGroup as evt, i (eventKey(evt))}
                                    <ChatEvent
                                        chatId={chat.id}
                                        chatType={chat.kind}
                                        event={evt}
                                        first={i + 1 === userGroup.length}
                                        last={i === 0}
                                        me={evt.event.sender === $currentUserIdStore}
                                        accepted={isAccepted($unconfirmedStore, evt)}
                                        confirmed={isConfirmed($unconfirmedStore, evt)}
                                        failed={isFailed($failedMessagesStore, evt)}
                                        readByMe={evt.event.messageId ===
                                            rootEvent.event.messageId ||
                                            !isFollowedByMe ||
                                            isReadByMe($messagesRead, evt)}
                                        observer={messageObserver}
                                        focused={evt.event.kind === "message" &&
                                            focusIndex === evt.event.messageIndex}
                                        {readonly}
                                        {threadRootMessage}
                                        pinned={false}
                                        supportsEdit={evt.event.messageId !==
                                            rootEvent.event.messageId}
                                        supportsReply={evt.event.messageId !==
                                            rootEvent.event.messageId}
                                        canPin={client.canPinMessages(chat.id)}
                                        canBlockUsers={client.canBlockUsers(chat.id)}
                                        canDelete={client.canDeleteOtherUsersMessages(chat.id)}
                                        publicGroup={(chat.kind === "group_chat" ||
                                            chat.kind === "channel") &&
                                            chat.public}
                                        editing={editingEvent === evt}
                                        canSendAny
                                        {canReact}
                                        canInvite={false}
                                        canReplyInThread={false}
                                        collapsed={false}
                                        {onRemovePreview}
                                        {onGoToMessageIndex}
                                        onReplyTo={replyTo}
                                        onEditEvent={() => editEvent(evt)}
                                        onExpandMessage={() => toggleMessageExpansion(evt, true)}
                                        onCollapseMessage={() =>
                                            toggleMessageExpansion(evt, false)} />
                                {/each}
                            {/each}
                        {/if}
                    {/each}
                {/if}
            {/snippet}
        </ChatEventList>

        {#if !readonly}
            <Footer
                {chat}
                {attachment}
                {editingEvent}
                {replyingTo}
                {textContent}
                user={$currentUserStore}
                joining={undefined}
                preview={false}
                lapsed={false}
                mode={"thread"}
                {blocked}
                {messageContext}
                {onCancelReply}
                onClearAttachment={clearAttachment}
                onCancelEdit={cancelEditEvent}
                {onSetTextContent}
                {onStartTyping}
                {onStopTyping}
                {onFileSelected}
                {onSendMessage}
                onAttachGif={attachGif}
                onMakeMeme={makeMeme}
                onTokenTransfer={tokenTransfer}
                onCreateP2PSwapMessage={createP2PSwapMessage}
                onCreatePoll={createPoll} />
        {/if}
    </Container>
</DropTarget>
