import { push } from "svelte-spa-router";
import { derived, get, Writable, writable } from "svelte/store";
import DRange from "drange";
import type { ChatSummary, DirectChatSummary, EnhancedReplyContext } from "../domain/chat/chat";
import { compareChats, updateArgsFromChats } from "../domain/chat/chat.utils";
import type { DataContent } from "../domain/data/data";
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
import { rollbar } from "../utils/logging";
import { closeNotificationsForChat } from "../utils/notifications";
import { ChatController } from "./chat.controller";
import { Poller } from "./poller";

const ONE_MINUTE = 60 * 1000;
const USER_UPDATE_INTERVAL = ONE_MINUTE;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;

export class HomeController {
    public messagesRead: IMessageReadTracker;
    private chatUpdatesSince?: bigint;
    private usersLastUpdate = BigInt(0);
    public chatSummaries: Writable<Record<string, ChatSummary>> = writable({});
    public chatSummariesList = derived([this.chatSummaries], ([$chatSummaries]) => {
        return Object.values($chatSummaries).sort(compareChats);
    });
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
        let usersResp: UsersResponse;
        try {
            usersResp = await this.api.getUsers(Object.keys(get(userStore)), this.usersLastUpdate);
            console.log("sending updated users");
            userStore.addMany(usersResp.users);
            this.usersLastUpdate = usersResp.timestamp;
        } catch (err) {
            rollbar.error("Error updating users", err as Error);
        }
    }

    private async loadChats() {
        try {
            this.loading.set(!this.initialised);
            const chats = get(this.chatSummariesList);
            const chatsResponse =
                this.chatUpdatesSince === undefined
                    ? await this.api.getInitialState(this.messagesRead)
                    : await this.api.getUpdates(
                          chats,
                          updateArgsFromChats(this.chatUpdatesSince, chats),
                          this.messagesRead
                      );

            const userIds = this.userIdsFromDirectChatSummaries(chatsResponse.chatSummaries);
            userIds.add(this.user.userId);
            const usersResponse = await this.api.getUsers(
                missingUserIds(get(userStore), userIds),
                BigInt(0)
            );

            userStore.addMany(usersResponse.users);
            blockedUsers.set(chatsResponse.blockedUsers);
            this.chatUpdatesSince = chatsResponse.timestamp;
            this.usersLastUpdate = usersResponse.timestamp;

            const selectedChat = get(this.selectedChat);

            this.chatSummaries.set(
                chatsResponse.chatSummaries.reduce<Record<string, ChatSummary>>((rec, chat) => {
                    rec[chat.chatId] = chat;
                    if (selectedChat !== undefined && selectedChat.chatId === chat.chatId) {
                        selectedChat.chatUpdated();
                    }
                    return rec;
                }, {})
            );
            this.initialised = true;
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

    private userIdsFromDirectChatSummaries(chats: ChatSummary[]): Set<string> {
        const userIds = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them);
            }
        });
        return userIds;
    }

    public destroy(): void {
        this.messagesRead.stop();
        this.chatPoller?.stop();
        this.usersPoller?.stop();
        this.selectedChat.update((selectedChat) => {
            if (selectedChat !== undefined) {
                selectedChat.destroy();
            }
            return undefined;
        });
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

        const chat = get(this.chatSummaries)[chatId];
        if (chat !== undefined) {
            const user = {
                userId: this.user.userId,
                username: this.user.username,
                lastOnline: Date.now(),
            };

            this.selectedChat.update((selectedChat) => {
                if (selectedChat !== undefined) {
                    selectedChat.destroy();
                }

                return new ChatController(
                    this.api,
                    user,
                    derived(this.chatSummaries, (summaries) => summaries[chatId]),
                    this.messagesRead,
                    messageIndex,
                    (updateChatFn) => this.updateChat(chatId, updateChatFn)
                );
            });
        } else {
            this.selectedChat.set(undefined);
        }
    }

    clearSelectedChat(): void {
        this.selectedChat.set(undefined);
    }

    leaveGroup(chatId: string): void {
        this.clearSelectedChat();
        this.chatSummaries.update((chatSummaries) => {
            delete chatSummaries[chatId];
            return chatSummaries;
        });
        this.api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("leftGroup");
                } else {
                    if (resp === "owner_cannot_leave") {
                        toastStore.showFailureToast("ownerCantLeave");
                    } else {
                        toastStore.showFailureToast("failedToLeaveGroup");
                    }
                }
            })
            .catch((_err) => toastStore.showFailureToast("failedToLeaveGroup"));
    }

    goToMessageIndex(messageIndex: number): void {
        get(this.selectedChat)?.externalGoToMessage(messageIndex);
    }

    createDirectChat(chatId: string): void {
        this.chatSummaries.update((chatSummaries) => {
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
                messageId: BigInt(parsedMsg.messageId),
            });
        }
        if (parsedMsg.kind === "remote_user_deleted_message") {
            this.remoteUserDeletedMessage({
                ...parsedMsg,
                messageId: BigInt(parsedMsg.messageId),
            });
        }
        if (parsedMsg.kind === "remote_user_removed_message") {
            this.remoteUserRemovedMessage({
                ...parsedMsg,
                messageId: BigInt(parsedMsg.messageId),
            });
        }
        if (parsedMsg.kind === "remote_user_undeleted_message") {
            this.remoteUserUndeletedMessage(parsedMsg);
        }
        if (parsedMsg.kind === "remote_user_sent_message") {
            this.remoteUserSentMessage({
                ...parsedMsg,
                messageEvent: {
                    ...parsedMsg.messageEvent,
                    event: {
                        ...parsedMsg.messageEvent.event,
                        messageId: BigInt(parsedMsg.messageEvent.event.messageId),
                    },
                    timestamp: BigInt(parsedMsg.messageEvent.timestamp),
                },
            });
        }
        if (parsedMsg.kind === "remote_user_read_message") {
            this.remoteUserReadMessage({
                ...parsedMsg,
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
        unconfirmed.add(BigInt(message.messageEvent.event.messageId));
        this.delegateToChatController(message, (chat) =>
            chat.sendMessage(message.messageEvent, message.userId)
        );
    }

    remoteUserReadMessage(message: RemoteUserReadMessage): void {
        unconfirmedReadByThem.add(BigInt(message.messageId));
    }

    private delegateToChatController(
        msg: WebRtcMessage,
        fn: (selectedChat: ChatController) => void
    ): void {
        const chat = this.findChatByChatType(msg);
        if (chat === undefined) return;
        const selectedChat = get(this.selectedChat);
        if (selectedChat === undefined) return;
        if (chat.chatId !== selectedChat.chatId) return;
        fn(selectedChat);
    }

    private updateChat(chatId: string, updateFn: (chat: ChatSummary) => ChatSummary) {
        this.chatSummaries.update((updates) => {
            return {
                ...updates,
                [chatId]: updateFn(updates[chatId]),
            };
        });
    }
}
