import { Chat } from "./model/chats";
import { Option } from "./model/common";
import { UserId, UserSummary } from "./model/users";
import { ChatsState } from "../reducers/chatsReducer";

export function getSelectedChat(chatsState: ChatsState) : Option<Chat> {
    return chatsState.selectedChatIndex === null
        ? null
        : chatsState.chats[chatsState.selectedChatIndex];
}

export function getUserSummary(them: UserId, userDictionary: any) : Option<UserSummary> {
    return them && userDictionary.hasOwnProperty(them)
        ? userDictionary[them]
        : null;
}

export function getUsers(userIds: UserId[], userDictionary: any) : UserSummary[] {
    return userIds
        .filter(u => userDictionary.hasOwnProperty(u))
        .map(u => userDictionary[u]);
}
