import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";

import ChatListItem from "./ChatListItem";

export default ChatList;

function ChatList() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);

    const chats = chatsState.chats.map((c, index) => {
        let name: string;
        let key: string;
        if (c.kind === "group") {
            name = "Group: " + c.subject;
            key = "G-" + c.chatId.toString();
        } else {
            name = "Direct: " + (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
            key = "D-" + c.them.toString();
        }

        return (
            <ChatListItem key={key} name={name} index={index} />
        );
    });

    return (
        <ul>
            {chats}
        </ul>
    );
}

