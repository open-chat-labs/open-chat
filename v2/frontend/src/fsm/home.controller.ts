import { push } from "svelte-spa-router";
import { derived, get, Unsubscriber, Writable, writable } from "svelte/store";
import type { ChatSummary, EnhancedReplyContext } from "../domain/chat/chat";
import { updateArgsFromChats } from "../domain/chat/chat.utils";
import type { DataContent } from "../domain/data/data";
import type { User } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { background } from "../stores/background";
import { blockedUsers } from "../stores/blockedUsers";
import { IMessageReadTracker, MessageReadTracker } from "../stores/markRead";
import { toastStore } from "../stores/toast";
import { userStore } from "../stores/user";
import { rollbar } from "../utils/logging";
import { closeNotificationsForChat } from "../utils/notifications";
import { ChatController } from "./chat.controller";

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;

export class HomeController {
    public messagesRead: IMessageReadTracker;
    private chatUpdatesSince?: bigint;
    private usersLastUpdate?: bigint;
    private replyingTo?: EnhancedReplyContext;
    public chatSummaries: Writable<Record<string, ChatSummary>> = writable({});
    public chatSummariesList = derived([this.chatSummaries], ([$chatSummaries]) => {
        return Object.values($chatSummaries);
    });
    public initialised = false;
    public selectedChat: Writable<ChatController | undefined> = writable(undefined);
    public loading = writable(false);
    private chatUpdateIntervalId: number | undefined;
    private unsubscribeBackground: Unsubscriber | undefined;

    constructor(public api: ServiceContainer, public user: User) {
        if (process.env.NODE_ENV !== "test") {
            // some initialisation
        }
        this.messagesRead = new MessageReadTracker(api);
        this.loadChats().then(() => {
            this.unsubscribeBackground = background.subscribe((hidden) => {
                this.startPolling(hidden);
            });
        });
    }

    private startChatUpdatesPoller(hidden: boolean) {
        if (this.chatUpdateIntervalId !== undefined) {
            window.clearInterval(this.chatUpdateIntervalId);
        }
        this.chatUpdateIntervalId = window.setInterval(
            () => this.loadChats(),
            hidden ? CHAT_UPDATE_IDLE_INTERVAL : CHAT_UPDATE_INTERVAL
        );
    }

    private stopChatUpdatesPoller() {
        if (this.chatUpdateIntervalId !== undefined) {
            window.clearInterval(this.chatUpdateIntervalId);
        }
    }

    private startPolling(hidden: boolean) {
        this.startChatUpdatesPoller(hidden);
    }

    private stopPolling() {
        this.stopChatUpdatesPoller();
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
                        selectedChat.chatUpdated(chat);
                    }
                    return rec;
                }, {})
            );
            this.initialised = true;
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
        this.stopPolling();
        if (this.unsubscribeBackground !== undefined) {
            this.unsubscribeBackground();
        }
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
                    chat,
                    this.messagesRead,
                    this.replyingTo,
                    messageIndex ? Number(messageIndex) : undefined
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
                readByMe: [],
                readByThem: [],
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
        this.replyingTo = context;
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.createDirectChat(context.sender!.userId);
        }
    }
}
