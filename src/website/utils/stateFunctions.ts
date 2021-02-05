import { Chat } from "../model/chats";
import { Option } from "../model/common";
import { ChatsState } from "../reducers/chatsReducer";
import { UserId, UserSummary } from "../model/users";

export function getSelectedChat(chatsState: ChatsState) : Option<Chat> {
    return chatsState.selectedChatIndex === null
        ? null
        : chatsState.chats[chatsState.selectedChatIndex];
}

export function getUsers(userIds: UserId[], userDictionary: any) : UserSummary[] {
    return userIds
        .filter(u => userDictionary.hasOwnProperty(u))
        .map(u => userDictionary[u]);
}
