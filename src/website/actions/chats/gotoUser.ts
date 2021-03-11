import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { ChatId, findDirectChatIndex } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import selectChat from "./selectChat";

export const SETUP_NEW_DIRECT_CHAT_SUCCEEDED = "SETUP_NEW_DIRECT_CHAT_SUCCEEDED";

export default function(userId: UserId, chatId: ChatId) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {

        const directChatIndex = findDirectChatIndex(getState().chatsState.chats, userId);

        // If I already have a direct chat with this user then select it otherwise setup a new direct chat
        if (directChatIndex >= 0) {
            dispatch(selectChat(directChatIndex));
        } else {
            dispatch({
                type: SETUP_NEW_DIRECT_CHAT_SUCCEEDED,
                payload: {
                    userId,
                    chatId
                }
            } as SetupNewDirectChatSucceededEvent);
        }
    };
}

export type SetupNewDirectChatSucceededEvent = {
    type: typeof SETUP_NEW_DIRECT_CHAT_SUCCEEDED,
    payload: {
        userId: UserId,
        chatId: ChatId
    }
}
