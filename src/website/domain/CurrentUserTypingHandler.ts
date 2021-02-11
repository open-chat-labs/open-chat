import { ChatId } from "./model/chats";
import { Option } from "./model/common";
import store from "../store";
import {
    CURRENT_USER_STOPPED_TYPING,
    CURRENT_USER_TYPING,
    CurrentUserStoppedTypingEvent,
    CurrentUserTypingEvent
} from "../actions/chats/userTyping";

const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

class CurrentUserTypingHandler {
    chatId: Option<ChatId> = null;
    lastUpdated: Option<Date> = null;
    currentUserStoppedTypingTimeoutId: Option<NodeJS.Timeout> = null;

    public markTyping = (chatId: ChatId) : void => {
        const now = new Date();
        if (this.chatId) {
            if (chatId !== this.chatId) {
                this.markTypingStopped(this.chatId);
            } else if (this.lastUpdated && now.getTime() - this.lastUpdated.getTime() < USER_TYPING_EVENT_MIN_INTERVAL_MS) {
                return;
            }
        }

        this.chatId = chatId;
        this.lastUpdated = now;
        const event: CurrentUserTypingEvent = {
            type: CURRENT_USER_TYPING,
            payload: chatId
        };
        store.dispatch(event);

        if (this.currentUserStoppedTypingTimeoutId) {
            clearTimeout(this.currentUserStoppedTypingTimeoutId);
        }
        this.currentUserStoppedTypingTimeoutId = setTimeout(
            () => this.markTypingStopped(chatId),
            MARK_TYPING_STOPPED_INTERVAL_MS);
    }

    public markTypingStopped = (chatId: ChatId) : void => {
        if (this.chatId !== chatId) {
            return;
        }

        const event: CurrentUserStoppedTypingEvent = {
            type: CURRENT_USER_STOPPED_TYPING,
            payload: chatId
        };
        store.dispatch(event);

        this.chatId = null;
        this.lastUpdated = null;

        if (this.currentUserStoppedTypingTimeoutId) {
            clearTimeout(this.currentUserStoppedTypingTimeoutId);
            this.currentUserStoppedTypingTimeoutId = null;
        }
    }
}

const handler = new CurrentUserTypingHandler();

export default handler;
