import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { findDirectChatIndex } from "../../domain/model/chats";
import { UserId, UserSummary } from "../../domain/model/users";
import selectChat from "./selectChat";

export const DIRECT_CHAT_CREATED = "DIRECT_CHAT_CREATED";

export default function(user: UserSummary) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {

        const directChatIndex = findDirectChatIndex(getState().chatsState.chats, user.userId);

        // If I already have a direct chat with this user then select it otherwise setup a new direct chat
        if (directChatIndex >= 0) {
            dispatch(selectChat(directChatIndex));
        } else {
            dispatch({
                type: DIRECT_CHAT_CREATED,
                payload: user
            } as DirectChatCreatedEvent);
        }
    };
}

// Only use this method if the user's details are already stored in the state
export function gotoKnownUser(userId: UserId) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {

        const directChatIndex = findDirectChatIndex(getState().chatsState.chats, userId);

        // If I already have a direct chat with this user then select it otherwise setup a new direct chat
        if (directChatIndex >= 0) {
            dispatch(selectChat(directChatIndex));
        } else {
            const userDictionary = getState().usersState.userDictionary;
            const user = userDictionary[userId];
            if (!user) {
                throw new Error("User details not found in state - " + userId);
            }

            dispatch({
                type: DIRECT_CHAT_CREATED,
                payload: user
            } as DirectChatCreatedEvent);
        }
    };
}

export type DirectChatCreatedEvent = {
    type: typeof DIRECT_CHAT_CREATED,
    payload: UserSummary
}
