import { Chat, isGroupChat } from "./model/chats";
import { Option } from "./model/common";
import { ChatId } from "./model/chats";
import { UserId, UserSummary } from "./model/users";
import { ChatsState } from "../reducers/chatsReducer";

export function getSelectedChat(chatsState: ChatsState) : Option<Chat> {
    return chatsState.selectedChatIndex === null
        ? null
        : chatsState.chats[chatsState.selectedChatIndex] ?? null;
}

export function getChatSubject(chatsState: ChatsState, chatId: ChatId) : Option<string> {
    const chat = chatsState.chats.find(c => c.chatId === chatId);
    return chat && isGroupChat(chat) ? chat.subject : null;
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
