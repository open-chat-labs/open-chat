import React from "react";
import ChatListItem from "./ChatListItem";
import { Chat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { UserId } from "../../domain/model/users";
import * as chatFunctions from "../../domain/model/chats";
import * as stateFunctions from "../../domain/stateFunctions";
import { sentByMe } from "../../domain/model/messages";
import { getContentAsText } from "../../domain/messageFunctions";
import { formatCyclesText } from "../mainPanel/CyclesContent";

export function build(chat: Chat, userDictionary: any, index: number, selectedChatIndex: Option<number>, me: UserId) : JSX.Element {
    let name: string;
    let key: string;
    let isGroup: boolean;
    let userId: Option<UserId> = null;
    let userImageId: Option<string> = null;
    let themTyping: boolean = false;
    let userOnline = false;
    let participantsTyping: string[] = [];

    if (chatFunctions.isDirectChat(chat)) {
        const user = userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them] : null;
        name = user?.username ?? "";
        key = "D-" + chat.them.toString();
        isGroup = false;
        themTyping = chatFunctions.isConfirmedChat(chat) && chat.themTyping;
        userOnline = (userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them].minutesSinceLastOnline < 2 : false);
        userId = chat.them;
        userImageId = user?.imageId ?? null;
    } else {
        name = chat.subject;
        isGroup = true;
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
            if (message.content.kind === "cycles") {
                latestMessageText = formatCyclesText(message.content.amount, sentByMe(message, me), name);
            } else {
                latestMessageText = getContentAsText(message.content);
            }
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
            userImageId={userImageId}
            unreadCount={chatFunctions.getUnreadMessageCount(chat)}
            themTyping={themTyping}
            userOnline={userOnline}
            participantsTyping={participantsTyping} />
    );
}
