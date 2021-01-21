import { RootState } from "../reducers";
import { Chat } from "../model/chats";
import { Option } from "../model/common";

export function getSelectedChat(state: RootState) : Option<Chat> {
    const chatsState = state.chatsState;
    return chatsState.selectedChatIndex === null
        ? null
        : chatsState.chats[chatsState.selectedChatIndex];
}