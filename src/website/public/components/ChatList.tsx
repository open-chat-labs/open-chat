import React from "react";
import { useSelector } from "react-redux";
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

        if ("them" in c) {
            name = (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
            key = "D-" + c.them.toString();
            isGroup = false;
        } else {
            name = c.subject;
            key = c.kind === "group" ? "G-" + c.chatId.toString() : key = "NG-" + c.subject;
            isGroup = true;
        }

        let latestMessageText = "";
        if (c.unconfirmedMessages.length) {
            latestMessageText = c.unconfirmedMessages[c.unconfirmedMessages.length - 1].text;
        } else if ("confirmedMessages" in c && c.confirmedMessages.length) {
            const latestMessage = c.confirmedMessages[c.confirmedMessages.length - 1];
            if ("text" in latestMessage) {
                latestMessageText = latestMessage.text;
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
                isGroup={isGroup} />
        );
    });

    return (
        <ul className="chats">
            {chats}
        </ul>
    );
}
