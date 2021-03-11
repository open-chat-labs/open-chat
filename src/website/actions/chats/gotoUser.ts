import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { ChatId, findDirectChatIndex } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import selectChat from "./selectChat";

export const DIRECT_CHAT_CREATED = "DIRECT_CHAT_CREATED";

export default function(userId: UserId, chatId: ChatId) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {

        const directChatIndex = findDirectChatIndex(getState().chatsState.chats, userId);

        // If I already have a direct chat with this user then select it otherwise setup a new direct chat
        if (directChatIndex >= 0) {
            dispatch(selectChat(directChatIndex));
        } else {
            dispatch({
                type: DIRECT_CHAT_CREATED,
                payload: {
                    userId,
                    chatId
                }
            } as DirectChatCreatedEvent);
        }
    };
}

export type DirectChatCreatedEvent = {
    type: typeof DIRECT_CHAT_CREATED,
    payload: {
        userId: UserId,
        chatId: ChatId
    }
}
