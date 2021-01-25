import { Chat } from "../model/chats";
import { Option } from "../model/common";
import { ChatsState } from "../reducers/chatsReducer";

export function getSelectedChat(chatsState: ChatsState) : Option<Chat> {
    return chatsState.selectedChatIndex === null
        ? null
        : chatsState.chats[chatsState.selectedChatIndex];
}