import { push } from "svelte-spa-router";
import { derived, get, readable, Readable, Writable, writable } from "svelte/store";
import DRange from "drange";
import type {
    ChatSummary,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    Message,
} from "../domain/chat/chat";
import {
    compareChats,
    mergeUnconfirmedIntoSummary,
    updateArgsFromChats,
} from "../domain/chat/chat.utils";
import type { DataContent } from "../domain/data/data";
import type { Notification } from "../domain/notifications";
import type { User, UsersResponse } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
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
import { blockedUsers } from "../stores/blockedUsers";
import { draftMessages } from "../stores/draftMessages";
import { IMessageReadTracker, MessageReadTracker } from "../stores/markRead";
import { toastStore } from "../stores/toast";
import { typing } from "../stores/typing";
import { unconfirmed, unconfirmedReadByThem } from "../stores/unconfirmed";
import { userStore } from "../stores/user";
import { chunk, groupBy } from "../utils/list";
import { rollbar } from "../utils/logging";
import { closeNotificationsForChat } from "../utils/notifications";
import { ChatController } from "./chat.controller";
import { Poller } from "./poller";

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;
const MAX_USERS_TO_UPDATE_PER_BATCH = 1000;

export class HomeController {
    public messagesRead: IMessageReadTracker;
    private chatUpdatesSince?: bigint;
    private serverChatSummaries: Writable<Record<string, ChatSummary>> = writable({});
    public chatSummaries: Readable<Record<string, ChatSummary>> = derived(
        [this.serverChatSummaries, unconfirmed],
        ([summaries, unconfirmed]) => {
            return Object.entries(summaries).reduce<Record<string, ChatSummary>>(
                (result, [chatId, summary]) => {
                    result[chatId] = mergeUnconfirmedIntoSummary(
                        this.user.userId,
                        summary,
                        unconfirmed[chatId]?.messages
                    );
                    return result;
                },
                {}
            );
        }
    );
    public chatSummariesList = derived(this.chatSummaries, (summaries) =>
        Object.values(summaries).sort(compareChats)
    );
    public initialised = false;
    public selectedChat: Writable<ChatController | undefined> = writable(undefined);
    public loading = writable(false);
    private chatPoller: Poller | undefined;
    private usersPoller: Poller | undefined;

    constructor(public api: ServiceContainer, public user: User) {
        this.messagesRead = new MessageReadTracker(api);
        if (process.env.NODE_ENV !== "test") {
            this.loadChats().then(() => {
                this.chatPoller = new Poller(
                    () => this.loadChats(),
                    CHAT_UPDATE_INTERVAL,
                    CHAT_UPDATE_IDLE_INTERVAL
                );
                this.usersPoller = new Poller(() => this.updateUsers(), USER_UPDATE_INTERVAL);
                rtcConnectionsManager.subscribe((msg) => this.handleWebRtcMessage(msg));
            });
        }
    }

    private async updateUsers() {
        try {
            const allUsers = get(userStore);
            const usersToUpdate = new Set<string>();

            // Update all users we have direct chats with
            for (const chat of Object.values(get(this.chatSummaries))) {
                if (chat.kind == "direct_chat") {
                    usersToUpdate.add(chat.them);
                }
            }

            // Also update any users who haven't been updated for at least an hour
            const now = BigInt(Date.now());
            for (const user of Object.values(allUsers)) {
                if (now - user.updated > ONE_HOUR) {
                    usersToUpdate.add(user.userId);
                }
            }

            console.log(`getting updates for ${usersToUpdate.size} user(s)`);
            for (const batch of chunk(Array.from(usersToUpdate), MAX_USERS_TO_UPDATE_PER_BATCH)) {
                const userGroups = groupBy<string, bigint>(batch, (u) => {
                    return allUsers[u]?.updated ?? BigInt(0);
                });

                const usersResp = await this.api.getUsers({
                    userGroups: Array.from(userGroups).map(([updatedSince, users]) => ({
                        users,
                        updatedSince,
                    })),
                });
                userStore.addMany(usersResp.users);
                userStore.setUpdated(batch, usersResp.timestamp);
            }
            console.log("users updated");
        } catch (err) {
            rollbar.error("Error updating users", err as Error);
        }
    }

    private async loadChats() {
        try {
            this.loading.set(!this.initialised);
            const chats = Object.values(get(this.serverChatSummaries));
            const chatsResponse =
                this.chatUpdatesSince === undefined
                    ? await this.api.getInitialState(this.messagesRead)
                    : await this.api.getUpdates(
                          chats,
                          updateArgsFromChats(this.chatUpdatesSince, chats),
                          this.messagesRead
                      );

            this.chatUpdatesSince = chatsResponse.timestamp;

            if (chatsResponse.wasUpdated) {
                const userIds = this.userIdsFromChatSummaries(chatsResponse.chatSummaries);
                userIds.add(this.user.userId);
                const usersResponse = await this.api.getUsers({
                    userGroups: [
                        {
                            users: missingUserIds(get(userStore), userIds),
                            updatedSince: BigInt(0),
                        },
                    ],
                });

                userStore.addMany(usersResponse.users);
                blockedUsers.set(chatsResponse.blockedUsers);

                const selectedChat = get(this.selectedChat);

                let selectedChatInvalid = true;

                this.serverChatSummaries.set(
                    chatsResponse.chatSummaries.reduce<Record<string, ChatSummary>>((rec, chat) => {
                        rec[chat.chatId] = chat;
                        if (selectedChat !== undefined && selectedChat.chatId === chat.chatId) {
                            selectedChatInvalid = false;
                            selectedChat.chatUpdated();
                        }
                        return rec;
                    }, {})
                );

                if (selectedChatInvalid) {
                    this.clearSelectedChat();
                }

                this.initialised = true;
            }
            toastStore.hideToast();
            console.log("loaded chats");
        } catch (err) {
            toastStore.showFailureToast("errorLoadingChats");
            rollbar.error("Error loading chats", err as Error);
            throw err;
        } finally {
            this.loading.set(false);
        }
    }

    private userIdsFromChatSummaries(chats: ChatSummary[]): Set<string> {
        const userIds = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them);
            } else if (chat.latestMessage !== undefined) {
                userIds.add(chat.latestMessage.event.sender);
            }
        });
        return userIds;
    }

    public destroy(): void {
        this.messagesRead.stop();
        this.chatPoller?.stop();
        this.usersPoller?.stop();
        this.clearSelectedChat();
    }

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

    selectChat(chatId: string, messageIndex?: number): void {
        closeNotificationsForChat(chatId);

        const chat = get(this.serverChatSummaries)[chatId];
        if (chat !== undefined) {
            const user = {
                userId: this.user.userId,
                username: this.user.username,
                lastOnline: Date.now(),
                updated: BigInt(Date.now()),
            };

            this.selectedChat.update((selectedChat) => {
                if (selectedChat !== undefined) {
                    selectedChat.destroy();
                }

                const readableChatSummary = readable(chat, (set) =>
                    this.serverChatSummaries.subscribe((summaries) => {
                        if (summaries[chatId] !== undefined) {
                            set(summaries[chatId]);
                        }
                    })
                );

                return new ChatController(
                    this.api,
                    user,
                    readableChatSummary,
                    this.messagesRead,
                    messageIndex,
                    (message) => this.onConfirmedMessage(chatId, message)
                );
            });
        } else {
            this.clearSelectedChat();
        }
    }

    clearSelectedChat(): void {
        this.selectedChat.update((selectedChat) => {
            if (selectedChat !== undefined) {
                selectedChat.destroy();
                push("/");
            }
            return undefined;
        });
    }

    deleteGroup(chatId: string): Promise<boolean> {
        return this.api
            .deleteGroup(chatId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("deleteGroupSuccess");
                    this.clearSelectedChat();
                    this.serverChatSummaries.update((summaries) => {
                        delete summaries[chatId];
                        return summaries;
                    });
                } else {
                    rollbar.warn("Unable to delete group", resp);
                    toastStore.showFailureToast("deleteGroupFailure");
                }
                return true;
            })
            .catch((err) => {
                toastStore.showFailureToast("deleteGroupFailure");
                rollbar.error("Unable to delete group", err);
                return false;
            });
    }

    leaveGroup(chatId: string): Promise<void> {
        return this.api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("leftGroup");
                    this.clearSelectedChat();
                    this.serverChatSummaries.update((summaries) => {
                        delete summaries[chatId];
                        return summaries;
                    });
                } else {
                    if (resp === "owner_cannot_leave") {
                        toastStore.showFailureToast("ownerCantLeave");
                    } else {
                        toastStore.showFailureToast("failedToLeaveGroup");
                    }
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("failedToLeaveGroup");
                rollbar.error("Unable to leave group", err);
            });
    }

    goToMessageIndex(messageIndex: number): void {
        get(this.selectedChat)?.externalGoToMessage(messageIndex);
    }

    createDirectChat(chatId: string): void {
        this.serverChatSummaries.update((chatSummaries) => {
            chatSummaries[chatId] = {
                kind: "direct_chat",
                them: chatId,
                chatId,
                readByMe: new DRange(),
                readByThem: new DRange(),
                latestMessage: undefined,
                latestEventIndex: 0,
                dateCreated: BigInt(Date.now()),
                notificationsMuted: false,
            };
            return chatSummaries;
        });
        push(`/${chatId}`);
    }

    replyPrivatelyTo(context: EnhancedReplyContext): void {
        const chat = get(this.chatSummariesList).find((c) => {
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
            this.createDirectChat(context.sender!.userId);
        }
    }

    private findDirectChatByUserId(userId: string): DirectChatSummary | undefined {
        return get(this.chatSummariesList).find(
            (c) => c.kind === "direct_chat" && c.them === userId
        ) as DirectChatSummary | undefined;
    }

    private findChatById(chatId: string): ChatSummary | undefined {
        return get(this.chatSummaries)[chatId];
    }

    private findChatByChatType(msg: WebRtcMessage): ChatSummary | undefined {
        return msg.chatType === "group_chat"
            ? this.findChatById(msg.chatId)
            : this.findDirectChatByUserId(msg.userId);
    }

    private handleWebRtcMessage(message: unknown): void {
        const parsedMsg = message as WebRtcMessage;

        const fromChat = this.findChatByChatType(parsedMsg);
        const selectedChat = get(this.selectedChat);

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
                chat.sendMessage(message.messageEvent, message.userId)
            )
        ) {
            unconfirmed.add(message.chatId, message.messageEvent);
        }
    }

    remoteUserReadMessage(message: RemoteUserReadMessage): void {
        unconfirmedReadByThem.add(BigInt(message.messageId));
    }

    notificationReceived(notification: Notification): void {
        switch (notification.kind) {
            case "direct_notification": {
                this.onConfirmedMessage(notification.sender, notification.message);
                return;
            }
            case "group_notification": {
                this.onConfirmedMessage(notification.chatId, notification.message);
                return;
            }
            case "added_to_group_notification":
                return;
        }
    }

    private delegateToChatController(
        msg: WebRtcMessage,
        fn: (selectedChat: ChatController) => void
    ): boolean {
        const chat = this.findChatByChatType(msg);
        if (chat === undefined) return false;
        const selectedChat = get(this.selectedChat);
        if (selectedChat === undefined) return false;
        if (chat.chatId !== selectedChat.chatId) return false;
        fn(selectedChat);
        return true;
    }

    private onConfirmedMessage(chatId: string, message: EventWrapper<Message>): void {
        this.serverChatSummaries.update((summaries) => {
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
}
