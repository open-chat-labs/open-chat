import store from "../store";
import { ChatId } from "./model/chats";
import { Option } from "./model/common";
import { markMessagesAsReadLocally, markMessagesAsReadByClientIdLocally } from "../actions/chats/markMessagesAsRead";
import RecurringTaskRunner from "./RecurringTaskRunner";

const INTERVAL_MS = 200;
const COUNT_REQUIRED = 10;

// This class takes a snapshot of which unread messages are visible every 'INTERVAL_MS', once a message has been visible
// in 'COUNT_REQUIRED' consecutive snapshots, it will be marked as read
export default class UnreadMessagesHandler {
    chatId: ChatId;
    stopped: boolean = false;
    timeout: Option<NodeJS.Timeout> = null;
    messageIdToAppearanceCountMap: Map<string, number> = new Map<string, number>();
    taskRunner: Option<RecurringTaskRunner> = null;

    constructor(chatId: ChatId) {
        this.chatId = chatId;
    }

    public start = () => {
        if (this.taskRunner) {
            return;
        }
        this.taskRunner = RecurringTaskRunner.startNew(this.runSingleIteration, INTERVAL_MS, false);
    }

    public stop = () => {
        if (this.taskRunner) {
            this.taskRunner.stop();
            this.taskRunner = null;
        }
    }

    runSingleIteration = () : Promise<void> => {
        const visibleUnreadMessages = this.getVisibleUnreadMessages();
        const newMessageIdToAppearanceCountMap: Map<string, number> = new Map<string, number>();
        const messagesToMarkAsRead: number[] = [];
        const messagesToMarkAsReadByClientId: string[] = [];
        for (const { clientMessageId, messageId } of visibleUnreadMessages) {
            const prevCount = this.messageIdToAppearanceCountMap.get(clientMessageId);
            if (prevCount) {
                const count = prevCount + 1;
                if (count >= COUNT_REQUIRED) {
                    if (messageId) {
                        messagesToMarkAsRead.push(messageId);
                    } else {
                        messagesToMarkAsReadByClientId.push(clientMessageId);
                    }
                } else {
                    newMessageIdToAppearanceCountMap.set(clientMessageId, count);
                }
            } else {
                newMessageIdToAppearanceCountMap.set(clientMessageId, 1);
            }
        }
        if (messagesToMarkAsRead.length) {
            store.dispatch(markMessagesAsReadLocally(this.chatId, messagesToMarkAsRead));
        }
        if (messagesToMarkAsReadByClientId.length) {
            store.dispatch(markMessagesAsReadByClientIdLocally(this.chatId, messagesToMarkAsReadByClientId));
        }

        this.messageIdToAppearanceCountMap = newMessageIdToAppearanceCountMap;

        return Promise.resolve();
    }

    getVisibleUnreadMessages = () : UnreadMessage[] => {
        const messagesDiv = document.getElementById("messages");
        const visibleUnreadMessageIds: UnreadMessage[] = [];

        if (!messagesDiv) {
            return visibleUnreadMessageIds;
        }

        const unreadMessageElements = messagesDiv.getElementsByClassName("unread");
        if (!unreadMessageElements.length) {
            return visibleUnreadMessageIds;
        }

        const outerBox = messagesDiv.getBoundingClientRect();
        const min = outerBox.top - 10;
        const max = outerBox.bottom - 30;
        for (let i = 0; i < unreadMessageElements.length; i++) {
            const element = unreadMessageElements[i];
            const box = element.getBoundingClientRect();
            if (box.top < min || box.top > max) {
                continue;
            }
            const clientMessageId = element.id;
            const messageIdAttr = element.getAttribute("data-message-id");
            const messageId: Option<number> = messageIdAttr ? parseInt(messageIdAttr) : null;

            visibleUnreadMessageIds.push({
                clientMessageId,
                messageId
            });
        }
        return visibleUnreadMessageIds;
    }
}

type UnreadMessage = {
    clientMessageId: string,
    messageId: Option<number>
}