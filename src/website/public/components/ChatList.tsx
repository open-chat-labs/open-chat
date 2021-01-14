import React from "react";
import { useSelector } from "react-redux";

import { GroupChat } from "../model/chats";
import { Option } from "../model/common";
import { UserId } from "../model/users";
import { RootState } from "../reducers";

import ChatListItem from "./ChatListItem";

export default ChatList;

function ChatList() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const selectedChatIndex = chatsState.selectedChatIndex;

    const chats = chatsState.chats.map((c, index) => {
        let name: string;
        let key: string;
        let isGroup: boolean;
        let userId: Option<UserId>;

        if ("them" in c) {
            name = (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
            key = "D-" + c.them.toString();
            isGroup = false;
            userId = c.them;
        } else {
            name = c.subject;
            key = c.kind === "group" ? "G-" + c.chatId.toString() : key = "NG-" + c.subject;
            isGroup = true;
            userId = null;
        }

        let latestMessageText = "";
        for (let i = c.messages.length - 1; i >= 0; i--) {
            const message = c.messages[i];
            if ("text" in message) {
                latestMessageText = message.text;
                break;
            }
        }

        return (
            <ChatListItem
                key={key}
                name={name}
                date={"updatedDate" in c ? c.updatedDate : undefined}
                index={index}
                selected={index === selectedChatIndex}
                latestMessage={latestMessageText}
                isGroup={isGroup}
                userId={userId} />
        );
    });

    return (
        <ul className="chats">
            {chats}
        </ul>
    );
}
