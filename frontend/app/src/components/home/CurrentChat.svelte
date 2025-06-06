<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        type AttachmentContent,
        blockedUsersStore,
        botState,
        type ChatIdentifier,
        chatIdentifiersEqual,
        type ChatSummary,
        communitiesStore,
        CommunityMap,
        type CommunitySummary,
        currentUserIdStore,
        currentUserStore,
        type EnhancedReplyContext,
        type EventWrapper,
        type FilteredProposals,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        localUpdates,
        type Mention,
        type Message,
        type MessageContent,
        type MessageContext,
        messageContextsEqual,
        messagesRead,
        mobileWidth,
        type MultiUserChat,
        type OpenChat,
        type ReadonlySet,
        rightPanelHistory,
        ROLE_OWNER,
        runningInIframe,
        selectedChatDraftMessageStore,
        selectedChatPinnedMessagesStore,
        selectedCommunitySummaryStore,
        subscribe,
        suspendedUserStore,
        type User,
    } from "openchat-client";
    import { getContext, onMount, tick } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import { toastStore } from "../../stores/toast";
    import { randomSentence } from "../../utils/randomMsg";
    import AreYouSure from "../AreYouSure.svelte";
    import DirectChatHeader from "../bots/DirectChatHeader.svelte";
    import ImportToCommunity from "./communities/Import.svelte";
    import CryptoTransferBuilder from "./CryptoTransferBuilder.svelte";
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";
    import ExternalContent from "./ExternalContent.svelte";
    import Footer from "./Footer.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import MemeBuilder from "./MemeBuilder.svelte";
    import P2PSwapContentBuilder from "./P2PSwapContentBuilder.svelte";
    import PollBuilder from "./PollBuilder.svelte";
    import PrizeContentBuilder from "./PrizeContentBuilder.svelte";

    interface Props {
        joining: MultiUserChat | undefined;
        chat: ChatSummary;
        filteredProposals: FilteredProposals | undefined;
    }

    let { joining, chat, filteredProposals }: Props = $props();

    let currentChatMessages = $state<CurrentChatMessages>();

    const client = getContext<OpenChat>("client");

    let previousChatId: ChatIdentifier | undefined = $state(undefined);
    let unreadMessages = $state<number>(0);
    let firstUnreadMention = $state<Mention | undefined>();
    let creatingPoll = $state(false);
    let creatingCryptoTransfer: { ledger: string; amount: bigint } | undefined = $state(undefined);
    let creatingPrizeMessage = $state(false);
    let creatingP2PSwapMessage = $state(false);
    let selectingGif = $state(false);
    let buildingMeme = $state(false);
    //@ts-ignore
    let pollBuilder: PollBuilder = $state();
    //@ts-ignore
    let giphySelector: GiphySelector = $state();
    //@ts-ignore
    let memeBuilder: MemeBuilder = $state();
    let showSearchHeader = $state(false);
    let searchTerm = $state("");
    let importToCommunities: CommunityMap<CommunitySummary> | undefined = $state();
    let removeLinkPreviewDetails: { event: EventWrapper<Message>; url: string } | undefined =
        $state(undefined);

    onMount(() => {
        const unsubs = [
            messagesRead.subscribe(() => {
                unreadMessages = getUnreadMessageCount(chat);
                firstUnreadMention = client.getFirstUnreadMention(chat);
            }),
            subscribe("createPoll", onCreatePoll),
            subscribe("attachGif", onAttachGif),
            subscribe("tokenTransfer", onTokenTransfer),
            subscribe("createTestMessages", onCreateTestMessages),
            subscribe("searchChat", onSearchChat),
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

    function importToCommunity() {
        importToCommunities = $communitiesStore.filter((c) => c.membership.role === ROLE_OWNER);
        if (importToCommunities.size === 0) {
            toastStore.showFailureToast(i18nKey("communities.noOwned"));
            importToCommunities = undefined;
        } else {
            rightPanelHistory.set([]);
        }
    }

    function getUnreadMessageCount(chat: ChatSummary): number {
        if (client.isPreviewing(chat.id) || client.isLapsed(chat.id)) return 0;

        return messagesRead.unreadMessageCount(chat.id, chat.latestMessage?.event.messageIndex);
    }

    function onWindowFocus() {
        client.closeNotificationsForChat(chat.id);
    }

    function createPoll() {
        if (!client.canSendMessage(chat.id, "message", "poll")) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function tokenTransfer(detail: { ledger?: string; amount?: bigint }) {
        creatingCryptoTransfer = {
            ledger: detail.ledger ?? $lastCryptoSent ?? LEDGER_CANISTER_ICP,
            amount: detail.amount ?? BigInt(0),
        };
    }

    function createPrizeMessage() {
        creatingPrizeMessage = true;
    }

    function createP2PSwapMessage() {
        creatingP2PSwapMessage = true;
    }

    function onFileSelected(content: AttachmentContent) {
        localUpdates.draftMessages.setAttachment({ chatId: chat.id }, content);
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

    function replyTo(ctx: EnhancedReplyContext) {
        showSearchHeader = false;
        localUpdates.draftMessages.setReplyingTo({ chatId: chat.id }, ctx);
    }

    function searchChat(search: string) {
        onSearchChat(search);
    }

    function onSearchChat(term: string) {
        showSearchHeader = true;
        searchTerm = term;
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
        if ($selectedChatDraftMessageStore?.editingEvent !== undefined) {
            client
                .editMessageWithAttachment(
                    messageContext,
                    text,
                    blockLevelMarkdown,
                    $selectedChatDraftMessageStore.attachment,
                    $selectedChatDraftMessageStore.editingEvent,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("errorEditingMessage"));
                    }
                });
        } else {
            sendMessageWithAttachment(
                text,
                blockLevelMarkdown,
                $selectedChatDraftMessageStore?.attachment,
                mentioned,
            );
        }
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

    function forwardMessage(msg: Message) {
        client.forwardMessage(messageContext, msg);
    }

    function onSetTextContent(txt?: string): void {
        localUpdates.draftMessages.setTextContent({ chatId: chat.id }, txt);
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

    function isBlocked(chatSummary: ChatSummary, blockedUsers: ReadonlySet<string>): boolean {
        return chatSummary.kind === "direct_chat" && blockedUsers.has(chatSummary.them.userId);
    }

    function defaultCryptoTransferReceiver(): string | undefined {
        return $selectedChatDraftMessageStore?.replyingTo?.sender?.userId;
    }

    function onSendMessageWithContent(content: MessageContent) {
        client.sendMessageWithContent(messageContext, content, false);
    }
    let showChatHeader = $derived(!$mobileWidth || !$runningInIframe);
    let messageContext = $derived({ chatId: chat.id });

    trackedEffect("current-chat", () => {
        if (previousChatId === undefined || !chatIdentifiersEqual(chat.id, previousChatId)) {
            previousChatId = chat.id;
            showSearchHeader = false;
            tick().then(() => {
                if ($messageToForwardStore !== undefined) {
                    forwardMessage($messageToForwardStore);
                    messageToForwardStore.set(undefined);
                }
            });
        }
    });
    let showFooter = $derived(!showSearchHeader && !$suspendedUserStore);
    let blocked = $derived(isBlocked(chat, $blockedUsersStore));
    let frozen = $derived(client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore));
    let canSendAny = $derived(client.canSendMessage(chat.id, "message"));
    let preview = $derived(client.isPreviewing(chat.id));
    let lapsed = $derived(client.isLapsed(chat.id));
    let canPin = $derived(client.canPinMessages(chat.id));
    let canBlockUsers = $derived(client.canBlockUsers(chat.id));
    let canDelete = $derived(client.canDeleteOtherUsersMessages(chat.id));
    let canReplyInThread = $derived(client.canSendMessage(chat.id, "thread"));
    let canReact = $derived(client.canReactToMessages(chat.id));
    let canInvite = $derived(client.canInviteUsers(chat.id));
    let readonly = $derived(client.isChatReadOnly(chat.id));
    let externalUrl = $derived(chat.kind === "channel" ? chat.externalUrl : undefined);
    let privateChatPreview = $derived(client.maskChatMessages(chat));
    let bot = $derived(
        chat.kind === "direct_chat" ? botState.externalBots.get(chat.them.userId) : undefined,
    );

    function onGoToMessageIndex(args: { index: number; preserveFocus: boolean }) {
        currentChatMessages?.scrollToMessageIndex(args.index, args.preserveFocus);
    }
</script>

<svelte:window onfocus={onWindowFocus} />

{#if removeLinkPreviewDetails !== undefined}
    <AreYouSure title={i18nKey("removePreviewQuestion")} action={removePreview} />
{/if}

{#if importToCommunities !== undefined}
    <ImportToCommunity
        groupId={chat.id}
        onCancel={() => (importToCommunities = undefined)}
        ownedCommunities={importToCommunities} />
{/if}

<PollBuilder onSend={onSendMessageWithContent} bind:this={pollBuilder} bind:open={creatingPoll} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        {chat}
        ledger={creatingCryptoTransfer.ledger}
        draftAmount={creatingCryptoTransfer.amount}
        defaultReceiver={defaultCryptoTransferReceiver()}
        {messageContext}
        onClose={() => (creatingCryptoTransfer = undefined)} />
{/if}

{#if creatingPrizeMessage}
    <PrizeContentBuilder
        context={messageContext}
        {chat}
        ledger={$lastCryptoSent ?? LEDGER_CANISTER_ICP}
        draftAmount={0n}
        onClose={() => (creatingPrizeMessage = false)} />
{/if}

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

<div class="wrapper">
    {#if showSearchHeader}
        <CurrentChatSearchHeader
            {chat}
            bind:searchTerm
            {onGoToMessageIndex}
            onClose={() => (showSearchHeader = false)} />
    {:else if showChatHeader}
        {#if bot !== undefined && chat.kind === "direct_chat"}
            <DirectChatHeader {bot} {chat} {onSearchChat}></DirectChatHeader>
        {:else}
            <CurrentChatHeader
                onSearchChat={searchChat}
                onImportToCommunity={importToCommunity}
                {blocked}
                {readonly}
                selectedChatSummary={chat}
                hasPinned={$selectedChatPinnedMessagesStore.size > 0} />
        {/if}
    {/if}
    {#if externalUrl !== undefined}
        <ExternalContent {privateChatPreview} {frozen} {externalUrl} />
    {:else}
        <CurrentChatMessages
            bind:this={currentChatMessages}
            onReplyTo={replyTo}
            {onRemovePreview}
            {privateChatPreview}
            {chat}
            {filteredProposals}
            {canPin}
            {canBlockUsers}
            {canDelete}
            {canReplyInThread}
            {canSendAny}
            {canReact}
            {canInvite}
            {readonly}
            {firstUnreadMention}
            footer={showFooter}
            {unreadMessages} />
    {/if}
    {#if showFooter}
        <Footer
            {chat}
            attachment={$selectedChatDraftMessageStore?.attachment}
            editingEvent={$selectedChatDraftMessageStore?.editingEvent}
            replyingTo={$selectedChatDraftMessageStore?.replyingTo}
            textContent={$selectedChatDraftMessageStore?.textContent}
            user={$currentUserStore}
            mode={"message"}
            {joining}
            {preview}
            {lapsed}
            {blocked}
            {messageContext}
            externalContent={externalUrl !== undefined}
            onCancelReply={() =>
                localUpdates.draftMessages.setReplyingTo({ chatId: chat.id }, undefined)}
            onClearAttachment={() =>
                localUpdates.draftMessages.setAttachment({ chatId: chat.id }, undefined)}
            onCancelEdit={() => localUpdates.draftMessages.delete({ chatId: chat.id })}
            {onSetTextContent}
            onStartTyping={() => client.startTyping(chat, $currentUserIdStore)}
            onStopTyping={() => client.stopTyping(chat, $currentUserIdStore)}
            {onFileSelected}
            {onSendMessage}
            onAttachGif={attachGif}
            onMakeMeme={makeMeme}
            onTokenTransfer={tokenTransfer}
            onCreatePrizeMessage={createPrizeMessage}
            onCreateP2PSwapMessage={createP2PSwapMessage}
            onCreatePoll={createPoll} />
    {/if}
</div>

<style lang="scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        position: relative;
    }
</style>
