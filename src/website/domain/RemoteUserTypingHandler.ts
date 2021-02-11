import { ChatId } from "./model/chats";
import { UserId } from "./model/users";
import store from "../store";
import {
    REMOTE_USER_STOPPED_TYPING,
    REMOTE_USER_TYPING,
    RemoteUserStoppedTypingEvent,
    RemoteUserTypingEvent
} from "../actions/chats/userTyping";

const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

class RemoteUserTypingHandler {
    userStoppedTypingTimeoutIds: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

    public markTyping = (chatId: ChatId, userId: UserId) : void => {
        const event: RemoteUserTypingEvent = {
            type: REMOTE_USER_TYPING,
            payload: {
                chatId,
                userId
            }
        };
        store.dispatch(event);

        const key = this.buildTimeoutKey(chatId, userId);
        const existingTimeoutId = this.userStoppedTypingTimeoutIds.get(key);
        if (existingTimeoutId) {
            clearTimeout(existingTimeoutId);
        }
        const newTimeoutId = setTimeout(
            () => this.markTypingStopped(chatId, userId),
            MARK_TYPING_STOPPED_INTERVAL_MS);

        this.userStoppedTypingTimeoutIds.set(key, newTimeoutId);
    }

    public markTypingStopped = (chatId: ChatId, userId: UserId) : void => {
        const key = this.buildTimeoutKey(chatId, userId);
        const timeoutId = this.userStoppedTypingTimeoutIds.get(key);
        if (timeoutId) {
            this.userStoppedTypingTimeoutIds.delete(key);
            clearTimeout(timeoutId);

            const event: RemoteUserStoppedTypingEvent = {
                type: REMOTE_USER_STOPPED_TYPING,
                payload: {
                    chatId,
                    userId
                }
            };
            store.dispatch(event);
        }
    }

    buildTimeoutKey = (chatId: ChatId, userId: UserId) : string => `${chatId}-${userId}`;
}

const handler = new RemoteUserTypingHandler();

export default handler;
