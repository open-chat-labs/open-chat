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
        if (c.kind === "group") {
            name = c.subject;
            key = "G-" + c.chatId.toString();
        } else {
            name = (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
            key = "D-" + c.them.toString();
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
                date={new Date(c.updatedDate)}
                index={index}
                selected={index === selectedChatIndex}
                latestMessage={latestMessageText}/>
        );
    });

    return (
        <ul className="chats">
            {chats}
        </ul>
    );
}

