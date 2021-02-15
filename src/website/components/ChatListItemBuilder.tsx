import React from "react";
import ChatListItem from "./ChatListItem";
import { Chat } from "../domain/model/chats";
import { Option } from "../domain/model/common";
import { UserId } from "../domain/model/users";
import * as chatFunctions from "../domain/model/chats";
import * as stateFunctions from "../domain/stateFunctions";
import { getContentAsText } from "../utils/messageFunctions";

export function build(chat: Chat, userDictionary: any, index: number, selectedChatIndex: Option<number>) : JSX.Element {
    let name: string;
    let key: string;
    let isGroup: boolean;
    let userId: Option<UserId>;
    let themTyping: boolean = false;
    let userOnline = false;
    let participantsTyping: string[] = [];

    if (chatFunctions.isDirectChat(chat)) {
        name = (userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them].username : "");
        key = "D-" + chat.them.toString();
        isGroup = false;
        userId = chat.them;
        themTyping = chatFunctions.isConfirmedChat(chat) && chat.themTyping;
        userOnline = (userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them].minutesSinceLastOnline < 2 : false);
    } else {
        name = chat.subject;
        isGroup = true;
        userId = null;
        if (chatFunctions.isConfirmedChat(chat)) {
            key = "G-" + chat.chatId.toString();
            participantsTyping = stateFunctions.getUsers(chat.participantsTyping, userDictionary).map(u => u.username);
        } else {
            key = "NG-" + chat.subject;
        }
    }

    let latestMessageText = "";
    for (let i = chat.messages.length - 1; i >= 0; i--) {
        const message = chat.messages[i];
        if ("content" in message) {
            latestMessageText = getContentAsText(message.content);
            break;
        }
    }

    return (
        <ChatListItem
            key={key}
            name={name}
            date={"displayDate" in chat ? chat.displayDate : undefined}
            index={index}
            selected={index === selectedChatIndex}
            latestMessage={latestMessageText}
            isGroup={isGroup}
            userId={userId}
            unreadCount={chatFunctions.getUnreadMessageCount(chat)}
            themTyping={themTyping}
            userOnline={userOnline}
            participantsTyping={participantsTyping} />
    );
}
