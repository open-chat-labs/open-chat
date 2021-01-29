import store from "../store";
import { ChatId } from "../model/chats";
import { Option } from "../model/common";
import markMessagesAsRead from "../actions/chats/markMessagesAsRead";
import RecurringTaskRunner from "../utils/RecurringTaskRunner";

const INTERVAL_MS = 200;
const COUNT_REQUIRED = 10;

// This class takes a snapshot of which unread messages are visible every 'INTERVAL_MS', once a message has been visible
// in 'COUNT_REQUIRED' consecutive snapshots, it will be marked as read
export default class UnreadMessagesHandler {
    chatId: ChatId;
    stopped: boolean = false;
    timeout: Option<NodeJS.Timeout> = null;
    messageIdToAppearanceCountMap: Map<number, number> = new Map<number, number>();
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
        const newMessageIdToAppearanceCountMap: Map<number, number> = new Map<number, number>();
        const messagesToMarkAsRead: number[] = [];
        for (const messageId of visibleUnreadMessages) {
            const prevCount = this.messageIdToAppearanceCountMap.get(messageId);
            if (prevCount) {
                const count = prevCount + 1;
                if (count >= COUNT_REQUIRED) {
                    messagesToMarkAsRead.push(messageId);
                } else {
                    newMessageIdToAppearanceCountMap.set(messageId, count);
                }
            } else {
                newMessageIdToAppearanceCountMap.set(messageId, 1);
            }
        }
        if (messagesToMarkAsRead.length) {
            store.dispatch(markMessagesAsRead(this.chatId, messagesToMarkAsRead));
        }

        this.messageIdToAppearanceCountMap = newMessageIdToAppearanceCountMap;

        return Promise.resolve();
    }

    getVisibleUnreadMessages = () : number[] => {
        const messagesDiv = document.getElementById("messages");
        const visibleUnreadMessageIds: number[] = [];

        if (!messagesDiv) {
            return visibleUnreadMessageIds;
        }

        const unreadMessageElements = messagesDiv.getElementsByClassName("unread");
        if (!unreadMessageElements.length) {
            return visibleUnreadMessageIds;
        }

        const substringStart = "message-".length;
        const outerBox = messagesDiv.getBoundingClientRect();
        const min = outerBox.top - 10;
        const max = outerBox.bottom - 30;
        for (let i = 0; i < unreadMessageElements.length; i++) {
            const element = unreadMessageElements[i];
            const box = element.getBoundingClientRect();
            if (box.top < min || box.top > max) {
                continue;
            }
            visibleUnreadMessageIds.push(parseInt(element.id.substring(substringStart)));
        }
        return visibleUnreadMessageIds;
    }
}