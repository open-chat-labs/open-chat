import { Message, RemoteMessage } from "../model/messages";
import { Chat } from "../model/chats";
import * as chatFunctions from "../model/chats";

export default class UnreadMessageDetector {
    unreadMessageIds: Set<number>;
    unreadClientMessageIds: Set<string>;
    markAsReadPending: Set<number>;
    markAsReadByClientIdPending: Set<string>;

    constructor(chat: Chat) {
        if (chatFunctions.isConfirmedChat(chat)) {
            this.unreadMessageIds = new Set(chat.unreadMessageIds);
            this.unreadClientMessageIds = new Set(chat.unreadClientMessageIds);
            this.markAsReadPending = new Set(chat.markAsReadPending);
            this.markAsReadByClientIdPending = new Set(chat.markAsReadByClientIdPending);
        } else {
            this.unreadMessageIds = new Set<number>();
            this.unreadClientMessageIds = new Set<string>();
            this.markAsReadPending = new Set<number>();
            this.markAsReadByClientIdPending = new Set<string>();
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
}