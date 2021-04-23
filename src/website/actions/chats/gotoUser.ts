import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { UnconfirmedDirectChat } from "../../domain/model/chats";
import { UserId, UserSummary } from "../../domain/model/users";
import { gotoChatByIndex } from "./gotoChat";
import * as chatFunctions from "../../domain/model/chats";

export const DIRECT_CHAT_CREATED = "DIRECT_CHAT_CREATED";

export default function(user: UserSummary) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        gotoUser(dispatch, getState, user);
    };
}

// Only use this method if the user's details are already stored in the state
export function gotoKnownUser(userId: UserId) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        const userDictionary = getState().usersState.userDictionary;
        const user = userDictionary[userId];
        if (!user) {
            throw new Error("User details not found in state - " + userId);
        }
        gotoUser(dispatch, getState, user);
    };
}

function gotoUser(dispatch: Dispatch<any>, getState: () => RootState, user: UserSummary) {
    const chats = getState().chatsState.chats;
    const directChatIndex = chatFunctions.findDirectChatIndex(chats, user.userId);
    // If I already have a direct chat with this user then select it otherwise setup a new direct chat
    if (directChatIndex >= 0) {        
        dispatch(gotoChatByIndex(directChatIndex));
    } else {
        const newChat = chatFunctions.newUnconfirmedDirectChat(user.userId, user.chatId);
        const directChatCreatedEvent: DirectChatCreatedEvent = {
            type: DIRECT_CHAT_CREATED,
            payload: {
                chat: newChat,
                user
            }
        };
        dispatch(directChatCreatedEvent);
    }
}

export type DirectChatCreatedEvent = {
    type: typeof DIRECT_CHAT_CREATED,
    payload: {
        chat: UnconfirmedDirectChat,
        user: UserSummary
    }
}
