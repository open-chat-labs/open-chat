import { push } from "svelte-spa-router";
import { get } from "svelte/store";
import type {
    ChatSummary,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    GroupChatSummary,
    Message,
    MemberRole,
    MessageContent,
} from "../domain/chat/chat";
import { userIdsFromEvents } from "../domain/chat/chat.utils";
import type { DataContent } from "../domain/data/data";
import type { Notification } from "../domain/notifications";
import type { CreatedUser } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import type {
    WebRtcMessage,
    RemoteUserToggledReaction,
    RemoteUserDeletedMessage,
    RemoteUserUndeletedMessage,
    RemoteUserRemovedMessage,
    RemoteUserReadMessage,
    RemoteUserSentMessage,
} from "../domain/webrtc/webrtc";
import type { ServiceContainer } from "../services/serviceContainer";
import { draftMessages } from "../stores/draftMessages";
import { toastStore } from "../stores/toast";
import { typing } from "../stores/typing";
import { unconfirmed, unconfirmedReadByThem } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { rollbar } from "../utils/logging";
import type { ChatController } from "./chat.controller";
import { setCachedMessageFromNotification } from "../utils/caching";
import {
    chatSummariesListStore,
    chatSummariesStore,
    createDirectChat,
    selectedChatStore,
    serverChatSummariesStore,
    setSelectedChat,
} from "../stores/chat";
import type { IMessageReadTracker } from "../stores/markRead";

export class HomeController {
    constructor(
        public api: ServiceContainer,
        public user: CreatedUser,
        public messagesRead: IMessageReadTracker
    ) {}

    updateUserAvatar(data: DataContent): void {
        this.user = {
            ...this.user,
            ...data,
        };

        const partialUser = get(userStore)[this.user.userId];
        if (partialUser) {
            userStore.add({
                ...partialUser,
                ...data,
            });
        }

        this.api
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .setUserAvatar(data.blobData!)
            .then((_resp) => toastStore.showSuccessToast("avatarUpdated"))
            .catch((err) => {
                rollbar.error("Failed to update user's avatar", err);
                toastStore.showFailureToast("avatarUpdateFailed");
            });
    }

    /**
     * We may wish to look at chats without joining them.
     * If the chat is either a public group or a private group with an invite code then
     * we load the chat summary directly.
     * We will then add that chat to our chat list locally with a custom role of "Previewer"
     * This will allow us to interact with the chat in a readonly mode.
     *
     * We will load the chat and then add it to the chat list. If we refresh the page
     * it will just disppear (unless of course we still have the canisterId in the url)
     */
    previewChat(chatId: string): Promise<boolean> {
        return this.api.getPublicGroupSummary(chatId).then((maybeChat) => {
            if (maybeChat === undefined) {
                return false;
            }
            this.addOrReplaceChat(maybeChat);
            return true;
        });
    }

    clearSelectedChat(): void {
        selectedChatStore.update((controller) => {
            if (controller !== undefined) {
                controller.destroy();
                push("/");
            }
            return undefined;
        });
    }

    deleteGroup(chatId: string): Promise<void> {
        this.clearSelectedChat();
        return this.api
            .deleteGroup(chatId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("deleteGroupSuccess");
                    this.removeChat(chatId);
                } else {
                    rollbar.warn("Unable to delete group", resp);
                    toastStore.showFailureToast("deleteGroupFailure");
                    push(`/${chatId}`);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("deleteGroupFailure");
                rollbar.error("Unable to delete group", err);
                push(`/${chatId}`);
            });
    }

    makeGroupPrivate(chatId: string): Promise<void> {
        return this.api
            .makeGroupPrivate(chatId)
            .then((resp) => {
                if (resp === "success") {
                    // TODO push this logic into the store itself
                    serverChatSummariesStore.update((summaries) => {
                        const summary = summaries[chatId];
                        if (summary === undefined || summary.kind !== "group_chat") {
                            return summaries;
                        }

                        return {
                            ...summaries,
                            [chatId]: {
                                ...summary,
                                public: false,
                            },
                        };
                    });
                } else {
                    toastStore.showFailureToast("makeGroupPrivateFailed");
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("makeGroupPrivateFailed");
                rollbar.error("Error making group private", err);
            });
    }

    leaveGroup(chatId: string): Promise<void> {
        this.clearSelectedChat();
        return this.api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success" || resp === "not_in_group" || resp === "group_not_found") {
                    toastStore.showSuccessToast("leftGroup");
                    this.removeChat(chatId);
                } else {
                    if (resp === "owner_cannot_leave") {
                        toastStore.showFailureToast("ownerCantLeave");
                    } else {
                        toastStore.showFailureToast("failedToLeaveGroup");
                    }
                    push(`/${chatId}`);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("failedToLeaveGroup");
                rollbar.error("Unable to leave group", err);
                push(`/${chatId}`);
            });
    }

    replyPrivatelyTo(context: EnhancedReplyContext): void {
        const chat = get(chatSummariesListStore).find((c) => {
            return c.kind === "direct_chat" && c.them === context.sender?.userId;
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const chatId = chat?.chatId ?? context.sender!.userId;
        draftMessages.delete(chatId);
        draftMessages.setReplyingTo(chatId, context);
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            createDirectChat(context.sender!.userId);
        }
    }

    private findDirectChatByUserId(userId: string): DirectChatSummary | undefined {
        return get(chatSummariesListStore).find(
            (c) => c.kind === "direct_chat" && c.them === userId
        ) as DirectChatSummary | undefined;
    }

    private findChatById(chatId: string): ChatSummary | undefined {
        return get(chatSummariesStore)[chatId];
    }

    private findChatByChatType(msg: WebRtcMessage): ChatSummary | undefined {
        return msg.chatType === "group_chat"
            ? this.findChatById(msg.chatId)
            : this.findDirectChatByUserId(msg.userId);
    }

    private handleWebRtcMessage(message: unknown): void {
        const parsedMsg = message as WebRtcMessage;

        const fromChat = this.findChatByChatType(parsedMsg);
        const selectedChat = get(selectedChatStore);

        // if the chat can't be found - ignore
        if (fromChat === undefined) {
            return;
        }

        if (
            fromChat.chatId === selectedChat?.chatId &&
            selectedChat?.isDirectChatWith(parsedMsg.userId) &&
            selectedChat?.isBlockedUser()
        ) {
            console.log("ignoring webrtc message from blocked user");
            return;
        }

        if (parsedMsg.kind === "remote_user_typing") {
            typing.add(fromChat.chatId, parsedMsg.userId);
        }
        if (parsedMsg.kind === "remote_user_stopped_typing") {
            typing.delete(fromChat.chatId, parsedMsg.userId);
        }
        if (parsedMsg.kind === "remote_user_toggled_reaction") {
            this.remoteUserToggledReaction({
                ...parsedMsg,
                chatId: fromChat.chatId,
                messageId: BigInt(parsedMsg.messageId),
            });
        }
        if (parsedMsg.kind === "remote_user_deleted_message") {
            this.remoteUserDeletedMessage({
                ...parsedMsg,
                chatId: fromChat.chatId,
                messageId: BigInt(parsedMsg.messageId),
            });
        }
        if (parsedMsg.kind === "remote_user_removed_message") {
            this.remoteUserRemovedMessage({
                ...parsedMsg,
                chatId: fromChat.chatId,
                messageId: BigInt(parsedMsg.messageId),
            });
        }
        if (parsedMsg.kind === "remote_user_undeleted_message") {
            this.remoteUserUndeletedMessage(parsedMsg);
        }
        if (parsedMsg.kind === "remote_user_sent_message") {
            parsedMsg.messageEvent.event.content = this.hydrateBigIntsInContent(
                parsedMsg.messageEvent.event.content
            );
            if (parsedMsg.messageEvent.event.repliesTo?.kind === "rehydrated_reply_context") {
                parsedMsg.messageEvent.event.repliesTo = {
                    ...parsedMsg.messageEvent.event.repliesTo,
                    messageId: BigInt(parsedMsg.messageEvent.event.messageId),
                    content: this.hydrateBigIntsInContent(
                        parsedMsg.messageEvent.event.repliesTo.content
                    ),
                };
            }
            this.remoteUserSentMessage({
                ...parsedMsg,
                chatId: fromChat.chatId,
                messageEvent: {
                    ...parsedMsg.messageEvent,
                    event: {
                        ...parsedMsg.messageEvent.event,
                        messageId: BigInt(parsedMsg.messageEvent.event.messageId),
                    },
                    timestamp: BigInt(Date.now()),
                },
            });
        }
        if (parsedMsg.kind === "remote_user_read_message") {
            this.remoteUserReadMessage({
                ...parsedMsg,
                chatId: fromChat.chatId,
                messageId: BigInt(parsedMsg.messageId),
            });
        }
    }

    remoteUserToggledReaction(message: RemoteUserToggledReaction): void {
        this.delegateToChatController(message, (chat) =>
            chat.toggleReaction(message.messageId, message.reaction, message.userId)
        );
    }

    remoteUserDeletedMessage(message: RemoteUserDeletedMessage): void {
        this.delegateToChatController(message, (chat) =>
            chat.deleteMessage(message.messageId, message.userId)
        );
    }

    remoteUserUndeletedMessage(message: RemoteUserUndeletedMessage): void {
        this.delegateToChatController(message, (chat) =>
            chat.undeleteMessage(message.message, message.userId)
        );
    }

    remoteUserRemovedMessage(message: RemoteUserRemovedMessage): void {
        this.delegateToChatController(message, (chat) =>
            chat.removeMessage(message.messageId, message.userId)
        );
    }

    remoteUserSentMessage(message: RemoteUserSentMessage): void {
        console.log("remote user sent message");
        if (
            !this.delegateToChatController(message, (chat) =>
                chat.handleMessageSentByOther(message.messageEvent, false)
            )
        ) {
            unconfirmed.add(message.chatId, message.messageEvent);
        }
    }

    remoteUserReadMessage(message: RemoteUserReadMessage): void {
        unconfirmedReadByThem.add(BigInt(message.messageId));
    }

    notificationReceived(notification: Notification): void {
        let chatId: string;
        let message: EventWrapper<Message>;
        switch (notification.kind) {
            case "direct_notification": {
                chatId = notification.sender;
                message = notification.message;
                break;
            }
            case "group_notification": {
                chatId = notification.chatId;
                message = notification.message;
                break;
            }
            case "added_to_group_notification":
                return;
        }

        const chat = this.findChatById(chatId);
        if (chat === undefined) {
            return;
        }
        const chatType = chat.kind === "direct_chat" ? "direct" : "group";
        setCachedMessageFromNotification(notification);
        Promise.all([
            this.api.rehydrateMessage(chatType, chatId, message),
            this.addMissingUsersFromMessage(message),
        ]).then(([m, _]) => {
            this.updateSummaryWithConfirmedMessage(chatId, m);

            const selectedChat = get(selectedChatStore);
            if (selectedChat?.chatId === chatId) {
                selectedChat.handleMessageSentByOther(m, true);
            }
        });
    }

    private delegateToChatController(
        msg: WebRtcMessage,
        fn: (selectedChat: ChatController) => void
    ): boolean {
        const chat = this.findChatByChatType(msg);
        if (chat === undefined) return false;
        const selectedChat = get(selectedChatStore);
        if (selectedChat === undefined) return false;
        if (chat.chatId !== selectedChat.chatId) return false;
        fn(selectedChat);
        return true;
    }

    private updateSummaryWithConfirmedMessage(
        chatId: string,
        message: EventWrapper<Message>
    ): void {
        // TODO maybe push this into the store
        serverChatSummariesStore.update((summaries) => {
            const summary = summaries[chatId];
            if (summary === undefined) return summaries;

            const latestEventIndex = Math.max(message.index, summary.latestEventIndex);
            const overwriteLatestMessage =
                summary.latestMessage === undefined ||
                message.index > summary.latestMessage.index ||
                // If they are the same message, take the confirmed one since it'll have the correct timestamp
                message.event.messageId === summary.latestMessage.event.messageId;

            const latestMessage = overwriteLatestMessage ? message : summary.latestMessage;

            return {
                ...summaries,
                [chatId]: {
                    ...summary,
                    latestEventIndex,
                    latestMessage,
                },
            };
        });
    }

    addOrReplaceChat(chat: ChatSummary): void {
        // TODO push into the store
        serverChatSummariesStore.update((summaries) => {
            return {
                ...summaries,
                [chat.chatId]: chat,
            };
        });
    }

    removeChat(chatId: string): void {
        // TODO push into the store
        serverChatSummariesStore.update((summaries) => {
            return Object.entries(summaries).reduce((agg, [k, v]) => {
                if (k !== chatId) {
                    agg[k] = v;
                }
                return agg;
            }, {} as Record<string, ChatSummary>);
        });
    }

    joinGroup(group: GroupChatSummary): Promise<boolean> {
        return this.api
            .joinGroup(group.chatId)
            .then((resp) => {
                if (resp.kind === "group_chat") {
                    this.addOrReplaceChat(resp);
                    setSelectedChat(this.api, this.messagesRead, group.chatId, undefined);
                    return true;
                } else if (resp.kind === "already_in_group") {
                    this.addOrReplaceChat({
                        ...group,
                        myRole: "participant" as MemberRole,
                    });
                    setSelectedChat(this.api, this.messagesRead, group.chatId, undefined);
                    return true;
                } else {
                    if (resp.kind === "blocked") {
                        toastStore.showFailureToast("youreBlocked");
                    } else {
                        toastStore.showFailureToast("joinGroupFailed");
                    }
                    return false;
                }
            })
            .catch((err) => {
                rollbar.error("Unable to join group", err);
                toastStore.showFailureToast("joinGroupFailed");
                return false;
            });
    }

    private async addMissingUsersFromMessage(message: EventWrapper<Message>): Promise<void> {
        const users = userIdsFromEvents([message]);
        const missingUsers = missingUserIds(get(userStore), users);
        if (missingUsers.length > 0) {
            const usersResp = await this.api.getUsers(
                {
                    userGroups: [
                        {
                            users: missingUsers,
                            updatedSince: BigInt(0),
                        },
                    ],
                },
                true
            );
            userStore.addMany(usersResp.users);
        }
    }

    private hydrateBigIntsInContent(content: MessageContent): MessageContent {
        if (content.kind === "crypto_content") {
            if (content.transfer.kind === "pending") {
                return {
                    ...content,
                    transfer: {
                        ...content.transfer,
                        amountE8s: BigInt(content.transfer.amountE8s),
                        feeE8s:
                            content.transfer.feeE8s !== undefined
                                ? BigInt(content.transfer.feeE8s)
                                : undefined,
                        memo:
                            content.transfer.memo !== undefined
                                ? BigInt(content.transfer.memo)
                                : undefined,
                    },
                };
            }
            if (content.transfer.kind === "completed") {
                return {
                    ...content,
                    transfer: {
                        ...content.transfer,
                        amountE8s: BigInt(content.transfer.amountE8s),
                        feeE8s: BigInt(content.transfer.feeE8s),
                        memo: BigInt(content.transfer.memo),
                        blockIndex: BigInt(content.transfer.blockIndex),
                    },
                };
            }
        }
        return content;
    }
}
