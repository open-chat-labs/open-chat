import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { UserSummary } from "../../domain/model/users";
import { findDirectChatIndex } from "../../domain/model/chats";
import selectChat from "./selectChat";
import { SetupNewDirectChatSucceededEvent, SETUP_NEW_DIRECT_CHAT_SUCCEEDED } from "./setupNewDirectChat";

export default function(user: UserSummary) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {

        const directChatIndex = findDirectChatIndex(getState().chatsState.chats, user.userId);

        // If I already have a direct chat with this user then select it otherwise setup a new direct chat
        if (directChatIndex >= 0) {
            dispatch(selectChat(directChatIndex));
        } else {
            dispatch({
                type: SETUP_NEW_DIRECT_CHAT_SUCCEEDED,
                payload: {
                    userId: user.userId,
                    username: user.username,
                    version: 0
                }
            } as SetupNewDirectChatSucceededEvent);
        }
    };
}
