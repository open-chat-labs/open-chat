<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { rollbar } from "../../utils/logging";
    import { closeNotificationsForChat } from "../../utils/notifications";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import type { ChatController } from "../../fsm/chat.controller";
    import { createEventDispatcher, getContext, onDestroy, tick } from "svelte";
    import {
        canForward,
        canInviteUsers,
        getFirstUnreadMention,
        getFirstUnreadMessageIndex,
        getMessageContent,
        getStorageRequiredForMessage,
        isPreviewing,
        newMessageId,
    } from "../../domain/chat/chat.utils";
    import type {
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Mention,
        Message,
        MessageContent,
    } from "../../domain/chat/chat";
    import PollBuilder from "./PollBuilder.svelte";
    import CryptoTransferBuilder from "./CryptoTransferBuilder.svelte";
    import { remainingStorage } from "../../stores/storage";
    import { userStore } from "../../stores/user";
    import {
        canBlockUsers,
        canCreatePolls,
        canDeleteOtherUsersMessages,
        canPinMessages,
        canReactToMessages,
        canSendMessages,
    } from "../../domain/chat/chat.utils";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import type { Cryptocurrency } from "../../domain/crypto";
    import { lastCryptoSent } from "../../stores/crypto";
    import { trackEvent } from "../../utils/tracking";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import type { CreatedUser, User } from "../../domain/user/user";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import { currentUserKey } from "../../stores/user";
    import { messagesRead } from "../../stores/markRead";

    export let controller: ChatController;
    export let blocked: boolean;
    export let joining: GroupChatSummary | undefined;
    export let selectedThreadMessageIndex: number | undefined;

    const dispatch = createEventDispatcher();
    const api = getContext<ServiceContainer>(apiKey);
    const createdUser = getContext<CreatedUser>(currentUserKey);

    let chatId = controller.chatId;
    let unreadMessages = 0;
    let firstUnreadMessage: number | undefined;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let showSearchHeader = false;
    let searchTerm = "";

    $: pinned = controller.pinnedMessages;
    $: showFooter = !showSearchHeader;
    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: editingEvent = controller.editingEvent;
    $: replyingTo = controller.replyingTo;
    $: textContent = controller.textContent;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;

    $: canSend = canSendMessages($chat, $userStore);
    $: preview = isPreviewing($chat);
    $: {
        if (chatId !== controller.chatId) {
            showSearchHeader = false;
            chatId = controller.chatId;
            unreadMessages = controller.unreadMessageCount;
            firstUnreadMention = getFirstUnreadMention(controller.chatVal);
            firstUnreadMessage = getFirstUnreadMessageIndex(controller.chatVal);

            tick().then(() => {
                if ($messageToForwardStore !== undefined) {
                    forwardMessage($messageToForwardStore);
                    messageToForwardStore.set(undefined);
                }
            });
        }
    }
    let unsub = messagesRead.subscribe(() => {
        unreadMessages = controller.unreadMessageCount;
        firstUnreadMention = getFirstUnreadMention(controller.chatVal);
        firstUnreadMessage = getFirstUnreadMessageIndex(controller.chatVal);
    });

    function onWindowFocus() {
        closeNotificationsForChat(chatId);
    }

    onDestroy(unsub);

    function toggleMuteNotifications() {
        const op = controller.notificationsMuted ? "unmuted" : "muted";
        controller.api
            .toggleMuteNotifications(controller.chatId, !controller.notificationsMuted)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                        values: { operation: $_(op) },
                    });
                } else {
                    toastStore.showSuccessToast("toggleMuteNotificationsSucceeded", {
                        values: { operation: $_(op) },
                    });
                }
            })
            .catch((err) => {
                rollbar.error("Error toggling mute notifications", err);
                toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                    values: { operation: $_(op) },
                });
            });
    }

    function markAllRead() {
        controller.markAllRead();
    }

    function messageRead(
        ev: CustomEvent<{ chatId: string; messageIndex: number; messageId: bigint }>
    ) {
        controller.messageRead(ev.detail.messageIndex, ev.detail.messageId);
    }

    function createPoll() {
        if (!canCreatePolls($chat)) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function tokenTransfer(ev: CustomEvent<{ token: Cryptocurrency; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            token: $lastCryptoSent,
            amount: BigInt(0),
        };
    }

    function fileSelected(ev: CustomEvent<MessageContent>) {
        controller.attachFile(ev.detail);
    }

    function attachGif(ev: CustomEvent<string>) {
        selectingGif = true;
        if (giphySelector !== undefined) {
            giphySelector.reset(ev.detail);
        }
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        showSearchHeader = false;
        controller.replyTo(ev.detail);
    }

    function searchChat(ev: CustomEvent<string>) {
        showSearchHeader = true;
        searchTerm = ev.detail;
    }

    function sendMessage(ev: CustomEvent<[string | undefined, User[]]>) {
        if (!canSend) return;
        let [text, mentioned] = ev.detail;
        if ($editingEvent !== undefined) {
            editMessageWithAttachment(text, $fileToAttach, $editingEvent);
        } else {
            sendMessageWithAttachment(text, mentioned, $fileToAttach);
        }
    }

    function editMessageWithAttachment(
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>
    ) {
        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                edited: true,
                content: getMessageContent(textContent ?? undefined, fileToAttach),
            };

            api.editMessage($chat, msg!)
                .then((resp) => {
                    if (resp !== "success") {
                        rollbar.warn("Error response editing", resp);
                        toastStore.showFailureToast("errorEditingMessage");
                    }
                })
                .catch((err) => {
                    rollbar.error("Exception sending message", err);
                    toastStore.showFailureToast("errorEditingMessage");
                });

            const event = { ...editingEvent, event: msg! };
            controller.sendMessage(event);
        }
    }

    function sendMessageWithAttachment(
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined
    ) {
        if (!canSend) return;
        if (textContent || fileToAttach) {
            const storageRequired = getStorageRequiredForMessage(fileToAttach);
            if ($remainingStorage < storageRequired) {
                dispatch("upgrade", "explain");
                return;
            }

            const msg = controller.createMessage(textContent, fileToAttach);
            api.sendMessage($chat, controller.user, mentioned, msg)
                .then((resp) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        controller.confirmMessage(msg, resp);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            api.refreshAccountBalance(
                                msg.content.transfer.token,
                                createdUser.cryptoAccount
                            );
                        }
                        if ($chat.kind === "direct_chat") {
                            trackEvent("sent_direct_message");
                        } else {
                            if ($chat.public) {
                                trackEvent("sent_public_group_message");
                            } else {
                                trackEvent("sent_private_group_message");
                            }
                        }
                        if (msg.repliesTo !== undefined) {
                            // double counting here which I think is OK since we are limited to string events
                            trackEvent("replied_to_message");
                        }
                    } else {
                        controller.removeMessage(msg.messageId, controller.user.userId);
                        rollbar.warn("Error response sending message", resp);
                        toastStore.showFailureToast("errorSendingMessage");
                    }
                })
                .catch((err) => {
                    controller.removeMessage(msg.messageId, controller.user.userId);
                    console.log(err);
                    toastStore.showFailureToast("errorSendingMessage");
                    rollbar.error("Exception sending message", err);
                });

            const nextEventIndex = controller.getNextEventIndex();
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };
            controller.sendMessage(event);
        }
    }

    export function sendMessageWithContent(ev: CustomEvent<[MessageContent, string | undefined]>) {
        sendMessageWithAttachment(ev.detail[1], [], ev.detail[0]);
    }

    function forwardMessage(msg: Message) {
        if (!canSend || !canForward(msg.content)) return;

        // TODO check storage requirements

        // Only forward the primary content not the caption
        let content = { ...msg.content };
        if ("caption" in content) {
            content.caption = "";
        }

        msg = {
            kind: "message",
            messageId: newMessageId(),
            messageIndex: controller.getNextMessageIndex(),
            sender: controller.user.userId,
            content,
            repliesTo: undefined,
            reactions: [],
            edited: false,
            forwarded: msg.content.kind !== "giphy_content",
        };

        controller.api
            .forwardMessage($chat, controller.user, [], msg)
            .then((resp) => {
                if (resp.kind === "success") {
                    controller.confirmMessage(msg, resp);
                    trackEvent("forward_message");
                } else {
                    controller.removeMessage(msg.messageId, controller.user.userId);
                    rollbar.warn("Error response forwarding message", resp);
                    toastStore.showFailureToast("errorSendingMessage");
                }
            })
            .catch((err) => {
                controller.removeMessage(msg.messageId, controller.user.userId);
                console.log(err);
                toastStore.showFailureToast("errorSendingMessage");
                rollbar.error("Exception forwarding message", err);
            });

        const nextEventIndex = controller.getNextEventIndex();
        const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };
        controller.sendMessage(event);
    }

    function setTextContent(ev: CustomEvent<string | undefined>): void {
        controller.setTextContent(ev.detail);
    }
</script>

<svelte:window on:focus={onWindowFocus} />

<PollBuilder
    bind:this={pollBuilder}
    on:sendPoll={sendMessageWithContent}
    bind:open={creatingPoll} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        token={creatingCryptoTransfer.token}
        draftAmountE8s={creatingCryptoTransfer.amount}
        on:sendTransfer={sendMessageWithContent}
        on:close={() => (creatingCryptoTransfer = undefined)}
        {controller} />
{/if}

<GiphySelector
    bind:this={giphySelector}
    bind:open={selectingGif}
    on:sendGiphy={sendMessageWithContent} />

<div class="wrapper">
    {#if showSearchHeader}
        <CurrentChatSearchHeader
            chat={$chat}
            bind:searchTerm
            on:goToMessageIndex
            on:close={() => (showSearchHeader = false)} />
    {:else}
        <CurrentChatHeader
            on:clearSelection
            on:blockUser
            on:unblockUser
            on:markAllRead={markAllRead}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:addParticipants
            on:showGroupDetails
            on:showParticipants
            on:leaveGroup
            on:showPinned
            on:createPoll={createPoll}
            on:searchChat={searchChat}
            {blocked}
            {preview}
            {unreadMessages}
            selectedChatSummary={chat}
            hasPinned={$pinned.size > 0} />
    {/if}
    <CurrentChatMessages
        on:replyPrivatelyTo
        on:replyTo={replyTo}
        on:replyInThread
        on:messageRead={messageRead}
        on:chatWith
        on:upgrade
        on:forward
        {controller}
        {selectedThreadMessageIndex}
        canPin={canPinMessages($chat)}
        canBlockUser={canBlockUsers($chat)}
        canDelete={canDeleteOtherUsersMessages($chat)}
        {canSend}
        canReact={canReactToMessages($chat)}
        canInvite={canInviteUsers($chat)}
        {preview}
        {firstUnreadMention}
        {firstUnreadMessage}
        footer={showFooter}
        {unreadMessages} />
    {#if showFooter}
        <Footer
            chat={$chat}
            fileToAttach={$fileToAttach}
            editingEvent={$editingEvent}
            replyingTo={$replyingTo}
            textContent={$textContent}
            participants={$participants}
            blockedUsers={$blockedUsers}
            user={controller.user}
            mode={"message"}
            {joining}
            {preview}
            {blocked}
            on:joinGroup
            on:cancelPreview
            on:upgrade
            on:cancelReply={() => controller.cancelReply()}
            on:clearAttachment={() => controller.clearAttachment()}
            on:cancelEditEvent={() => controller.cancelEditEvent()}
            on:setTextContent={setTextContent}
            on:startTyping={() => controller.startTyping()}
            on:stopTyping={() => controller.stopTyping()}
            on:fileSelected={fileSelected}
            on:audioCaptured={fileSelected}
            on:sendMessage={sendMessage}
            on:attachGif={attachGif}
            on:tokenTransfer={tokenTransfer}
            on:searchChat={searchChat}
            on:createPoll={createPoll} />
    {/if}
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        position: relative;
    }
</style>
