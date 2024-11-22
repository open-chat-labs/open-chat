<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { closeNotificationsForChat } from "../../utils/notifications";
    import { getContext, onMount, tick } from "svelte";
    import {
        type ChatEvent,
        type ChatSummary,
        type EnhancedReplyContext,
        type EventWrapper,
        type Mention,
        type Message,
        type OpenChat,
        type FilteredProposals,
        type User,
        type ChatIdentifier,
        chatIdentifiersEqual,
        type MultiUserChat,
        CommunityMap,
        type CommunitySummary,
        type AttachmentContent,
        LEDGER_CANISTER_ICP,
        type MessageContent,
        currentUser as user,
        suspendedUser,
        currentChatTextContent,
        currentChatReplyingTo,
        currentChatPinnedMessages,
        currentChatAttachment,
        currentChatEditingEvent,
        draftMessagesStore,
        lastCryptoSent,
        messagesRead,
        blockedUsers as directlyBlockedUsers,
        communities,
        selectedCommunity,
        CreatePoll,
        CreateTestMessages,
        SearchChat,
        AttachGif,
        TokenTransfer,
    } from "openchat-client";
    import PollBuilder from "./PollBuilder.svelte";
    import CryptoTransferBuilder from "./CryptoTransferBuilder.svelte";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import MemeBuilder from "./MemeBuilder.svelte";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import { toastStore } from "../../stores/toast";
    import ImportToCommunity from "./communities/Import.svelte";
    import { randomSentence } from "../../utils/randomMsg";
    import { framed } from "../../stores/xframe";
    import { rightPanelHistory } from "../../stores/rightPanel";
    import { mobileWidth } from "../../stores/screenDimensions";
    import PrizeContentBuilder from "./PrizeContentBuilder.svelte";
    import P2PSwapContentBuilder from "./P2PSwapContentBuilder.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ExternalContent from "./ExternalContent.svelte";

    export let joining: MultiUserChat | undefined;
    export let chat: ChatSummary;
    export let currentChatMessages: CurrentChatMessages | undefined;
    export let events: EventWrapper<ChatEvent>[];
    export let filteredProposals: FilteredProposals | undefined;

    const client = getContext<OpenChat>("client");

    let previousChatId: ChatIdentifier | undefined = undefined;
    let unreadMessages = 0;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingCryptoTransfer: { ledger: string; amount: bigint } | undefined = undefined;
    let creatingPrizeMessage = false;
    let creatingP2PSwapMessage = false;
    let selectingGif = false;
    let buildingMeme = false;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let memeBuilder: MemeBuilder;
    let showSearchHeader = false;
    let searchTerm = "";
    let importToCommunities: CommunityMap<CommunitySummary> | undefined;
    let removeLinkPreviewDetails: { event: EventWrapper<Message>; url: string } | undefined =
        undefined;

    $: showChatHeader = !$mobileWidth || !$framed;
    $: messageContext = { chatId: chat.id };
    $: showFooter = !showSearchHeader && !$suspendedUser;
    $: blocked = isBlocked(chat, $directlyBlockedUsers);
    $: frozen = client.isChatOrCommunityFrozen(chat, $selectedCommunity);
    $: canSendAny = client.canSendMessage(chat.id, "message");
    $: preview = client.isPreviewing(chat.id);
    $: lapsed = client.isLapsed(chat.id);
    $: canPin = client.canPinMessages(chat.id);
    $: canBlockUsers = client.canBlockUsers(chat.id);
    $: canDelete = client.canDeleteOtherUsersMessages(chat.id);
    $: canReplyInThread = client.canSendMessage(chat.id, "thread");
    $: canReact = client.canReactToMessages(chat.id);
    $: canInvite = client.canInviteUsers(chat.id);
    $: readonly = client.isChatReadOnly(chat.id);
    $: externalUrl = chat.kind === "channel" ? chat.externalUrl : undefined;
    $: privateChatPreview = client.maskChatMessages(chat);

    $: {
        if (previousChatId === undefined || !chatIdentifiersEqual(chat.id, previousChatId)) {
            previousChatId = chat.id;
            showSearchHeader = false;
            unreadMessages = getUnreadMessageCount(chat);
            firstUnreadMention = client.getFirstUnreadMention(chat);

            tick().then(() => {
                if ($messageToForwardStore !== undefined) {
                    forwardMessage($messageToForwardStore);
                    messageToForwardStore.set(undefined);
                }
            });
        }
    }

    onMount(() => {
        client.addEventListener("openchat_event", clientEvent);
        const unsub = messagesRead.subscribe(() => {
            unreadMessages = getUnreadMessageCount(chat);
            firstUnreadMention = client.getFirstUnreadMention(chat);
        });
        return () => {
            unsub();
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof CreatePoll) {
            if (
                ev.detail.chatId === messageContext.chatId &&
                ev.detail.threadRootMessageIndex === undefined
            ) {
                createPoll();
            }
        }
        if (ev instanceof CreateTestMessages) {
            const [{ chatId, threadRootMessageIndex }, num] = ev.detail;
            if (chatId === messageContext.chatId && threadRootMessageIndex === undefined) {
                createTestMessages(num);
            }
        }
        if (ev instanceof TokenTransfer) {
            const { context } = ev.detail;
            if (
                context.chatId === messageContext.chatId &&
                context.threadRootMessageIndex === undefined
            ) {
                tokenTransfer(ev);
            }
        }
        if (ev instanceof AttachGif) {
            const [{ chatId, threadRootMessageIndex }, search] = ev.detail;
            if (chatId === messageContext.chatId && threadRootMessageIndex === undefined) {
                attachGif(new CustomEvent("openchat_client", { detail: search }));
            }
        }
        if (ev instanceof SearchChat) {
            searchChat(ev);
        }
    }

    function importToCommunity() {
        importToCommunities = $communities.filter((c) => c.membership.role === "owner");
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
        closeNotificationsForChat(chat.id);
    }

    function createPoll() {
        if (!client.canSendMessage(chat.id, "message", "poll")) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function tokenTransfer(ev: CustomEvent<{ ledger: string; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            ledger: $lastCryptoSent ?? LEDGER_CANISTER_ICP,
            amount: BigInt(0),
        };
    }

    function createPrizeMessage() {
        creatingPrizeMessage = true;
    }

    function createP2PSwapMessage() {
        creatingP2PSwapMessage = true;
    }

    function fileSelected(ev: CustomEvent<AttachmentContent>) {
        draftMessagesStore.setAttachment({ chatId: chat.id }, ev.detail);
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
        showSearchHeader = false;
        draftMessagesStore.setReplyingTo({ chatId: chat.id }, ev.detail);
    }

    function searchChat(ev: CustomEvent<string>) {
        showSearchHeader = true;
        searchTerm = ev.detail;
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
        if ($currentChatEditingEvent !== undefined) {
            client
                .editMessageWithAttachment(
                    messageContext,
                    text,
                    blockLevelMarkdown,
                    $currentChatAttachment,
                    $currentChatEditingEvent,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("errorEditingMessage"));
                    }
                });
        } else {
            sendMessageWithAttachment(text, blockLevelMarkdown, $currentChatAttachment, mentioned);
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

    function setTextContent(ev: CustomEvent<string | undefined>): void {
        draftMessagesStore.setTextContent({ chatId: chat.id }, ev.detail);
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

    function isBlocked(chatSummary: ChatSummary, blockedUsers: Set<string>): boolean {
        return chatSummary.kind === "direct_chat" && blockedUsers.has(chatSummary.them.userId);
    }

    function defaultCryptoTransferReceiver(): string | undefined {
        return $currentChatReplyingTo?.sender?.userId;
    }

    function sendMessageWithContent(ev: CustomEvent<{ content: MessageContent }>) {
        client.sendMessageWithContent(messageContext, ev.detail.content, false);
    }
</script>

<svelte:window on:focus={onWindowFocus} />

{#if removeLinkPreviewDetails !== undefined}
    <AreYouSure title={i18nKey("removePreviewQuestion")} action={removePreview} />
{/if}

{#if importToCommunities !== undefined}
    <ImportToCommunity
        on:successfulImport
        groupId={chat.id}
        on:cancel={() => (importToCommunities = undefined)}
        ownedCommunities={importToCommunities} />
{/if}

<PollBuilder
    on:sendMessageWithContent={sendMessageWithContent}
    bind:this={pollBuilder}
    bind:open={creatingPoll} />

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

{#if creatingPrizeMessage}
    <PrizeContentBuilder
        context={messageContext}
        {chat}
        ledger={$lastCryptoSent ?? LEDGER_CANISTER_ICP}
        draftAmount={0n}
        on:close={() => (creatingPrizeMessage = false)} />
{/if}

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

<div class="wrapper">
    {#if showSearchHeader}
        <CurrentChatSearchHeader
            {chat}
            bind:searchTerm
            on:goToMessageIndex
            on:close={() => (showSearchHeader = false)} />
    {:else if showChatHeader}
        <CurrentChatHeader
            on:clearSelection
            on:toggleMuteNotifications
            on:showInviteGroupUsers
            on:showProposalFilters
            on:makeProposal
            on:showGroupMembers
            on:leaveGroup
            on:upgrade
            on:startVideoCall
            on:createPoll={createPoll}
            on:searchChat={searchChat}
            on:convertGroupToCommunity
            on:importToCommunity={importToCommunity}
            {blocked}
            {readonly}
            selectedChatSummary={chat}
            hasPinned={$currentChatPinnedMessages.size > 0} />
    {/if}
    {#if externalUrl !== undefined}
        <ExternalContent {privateChatPreview} {frozen} {externalUrl} />
    {:else}
        <CurrentChatMessages
            bind:this={currentChatMessages}
            on:replyPrivatelyTo
            on:replyTo={replyTo}
            on:chatWith
            on:upgrade
            on:forward
            on:retrySend
            on:startVideoCall
            on:removePreview={onRemovePreview}
            {privateChatPreview}
            {chat}
            {events}
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
            attachment={$currentChatAttachment}
            editingEvent={$currentChatEditingEvent}
            replyingTo={$currentChatReplyingTo}
            textContent={$currentChatTextContent}
            user={$user}
            mode={"message"}
            {joining}
            {preview}
            {lapsed}
            {blocked}
            {messageContext}
            externalContent={externalUrl !== undefined}
            on:joinGroup
            on:upgrade
            on:cancelReply={() => draftMessagesStore.setReplyingTo({ chatId: chat.id }, undefined)}
            on:clearAttachment={() =>
                draftMessagesStore.setAttachment({ chatId: chat.id }, undefined)}
            on:cancelEditEvent={() => draftMessagesStore.delete({ chatId: chat.id })}
            on:setTextContent={setTextContent}
            on:startTyping={() => client.startTyping(chat, $user.userId)}
            on:stopTyping={() => client.stopTyping(chat, $user.userId)}
            on:fileSelected={fileSelected}
            on:audioCaptured={fileSelected}
            on:sendMessage={sendMessage}
            on:attachGif={attachGif}
            on:makeMeme={makeMeme}
            on:tokenTransfer={tokenTransfer}
            on:createPrizeMessage={createPrizeMessage}
            on:createP2PSwapMessage={createP2PSwapMessage}
            on:searchChat={searchChat}
            on:createPoll={createPoll} />
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
