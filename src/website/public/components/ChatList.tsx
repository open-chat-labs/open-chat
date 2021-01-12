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
            key = c instanceof GroupChat ? "G-" + c.chatId.toString() : key = "NG-" + c.subject;
            isGroup = true;
            userId = null;
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
