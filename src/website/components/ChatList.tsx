import React from "react";
import { useSelector } from "react-redux";
import { List } from "@material-ui/core";
import { RootState } from "../reducers";
import * as chatListItemBuilder from "./ChatListItemBuilder";

export default React.memo(ChatList);

function ChatList() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const selectedChatIndex = chatsState.selectedChatIndex;

    const chats = chatsState.chats.map((c, index) => {
        return chatListItemBuilder.build(c, userDictionary, index, selectedChatIndex);
    });

    return (
        <List className="chats">
            {chats}
        </List>
    );
}
