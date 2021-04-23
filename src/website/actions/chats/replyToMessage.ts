import { Dispatch } from "react";
import { UserSummary } from "../../domain/model/users";
import { ChatId, DirectChat } from "../../domain/model/chats";
import { ReplyContext } from "../../domain/model/messages";
import gotoUser from "./gotoUser";

export const REPLY_TO_MESSAGE_SELECTED = "REPLY_TO_MESSAGE_SELECTED";
export const REPLY_TO_MESSAGE_CANCELLED = "REPLY_TO_MESSAGE_CANCELLED";

export function selectReplyPrivatelyToMessage(replyContext: ReplyContext, user: UserSummary) {
    return (dispatch: Dispatch<any> ) : ReplyToMessageSelectedEvent => {
        dispatch(gotoUser(user)) as unknown as DirectChat;
        const event: ReplyToMessageSelectedEvent = {
            type: REPLY_TO_MESSAGE_SELECTED,
            payload: { replyContext, privateChatId: user.chatId }
        };
        dispatch(event)
        return event;    
    }
}

export function selectReplyToMessage(replyContext: ReplyContext) : ReplyToMessageSelectedEvent {
    return {
        type: REPLY_TO_MESSAGE_SELECTED,
        payload: { replyContext }
    };
}

export function cancelReplyToMessage(chatId: ChatId) : ReplyToMessageCancelledEvent {
    return {
        type: REPLY_TO_MESSAGE_CANCELLED,
        payload: { chatId }
    };
}

export type ReplyToMessageSelectedEvent = {
    type: typeof REPLY_TO_MESSAGE_SELECTED,
    payload: {
        replyContext: ReplyContext,
        privateChatId?: ChatId
    }
}

export type ReplyToMessageCancelledEvent = {
    type: typeof REPLY_TO_MESSAGE_CANCELLED,
    payload: {
        chatId: ChatId
    }
}
