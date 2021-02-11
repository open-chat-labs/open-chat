import { Message, RemoteMessage } from "./model/messages";
import { Chat } from "./model/chats";
import * as chatFunctions from "./model/chats";

export default class UnreadMessageDetector {
    unreadMessageIds: Set<number>;
    unreadClientMessageIds: Set<string>;
    markAsReadPending: Set<number>;
    markAsReadByClientIdPending: Set<string>;
    unreadByThem: Set<number>;
    markAsReadByThemPending: Set<number>;
    markAsReadByThemByClientIdPending: Set<string>;

    constructor(chat: Chat) {
        if (chatFunctions.isConfirmedChat(chat)) {
            this.unreadMessageIds = new Set(chat.unreadMessageIds);
            this.unreadClientMessageIds = new Set(chat.unreadClientMessageIds);
            this.markAsReadPending = new Set(chat.markAsReadPending);
            this.markAsReadByClientIdPending = new Set(chat.markAsReadByClientIdPending);
            if (chatFunctions.isDirectChat(chat)) {
                this.unreadByThem = new Set( chat.unreadByThemMessageIds)
                this.markAsReadByThemPending = new Set(chat.markAsReadByThemPendingSync);
                this.markAsReadByThemByClientIdPending = new Set(chat.markAsReadByThemByClientIdPendingSync);
            } else {
                this.unreadByThem = new Set(chat.unreadByAnyMessageIds);
                this.markAsReadByThemPending = new Set<number>();
                this.markAsReadByThemByClientIdPending = new Set<string>();
            }
        } else {
            this.unreadMessageIds = new Set<number>();
            this.unreadClientMessageIds = new Set<string>();
            this.markAsReadPending = new Set<number>();
            this.markAsReadByClientIdPending = new Set<string>();
            this.unreadByThem = new Set<number>();
            this.markAsReadByThemPending = new Set<number>();
            this.markAsReadByThemByClientIdPending = new Set<string>();
        }
    }

    public isUnread = (message: Exclude<Message, RemoteMessage>) : boolean => {
        const isUnreadOnServer = this.unreadClientMessageIds.has(message.clientMessageId) ||
            ("id" in message && this.unreadMessageIds.has(message.id));

        if (!isUnreadOnServer) {
            return false;
        }

        const isPendingBeingMarkedAsRead = this.markAsReadByClientIdPending.has(message.clientMessageId) ||
            ("id" in message && this.markAsReadPending.has(message.id));

        return !isPendingBeingMarkedAsRead;
    }

    public isUnreadByThem = (message: Exclude<Message, RemoteMessage>) : boolean => {
        if ("id" in message) {
            const isUnreadOnServer = this.unreadByThem.has(message.id);

            if (!isUnreadOnServer) {
                return false;
            }

            const isPendingBeingMarkedAsRead = this.markAsReadByThemPending.has(message.id) ||
                this.markAsReadByThemByClientIdPending.has(message.clientMessageId);

            return !isPendingBeingMarkedAsRead;
        } else {
            return !this.markAsReadByThemByClientIdPending.has(message.clientMessageId);
        }
    }
}