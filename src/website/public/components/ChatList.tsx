import React from "react";
import { useSelector } from "react-redux";
import { Option } from "../model/common";
import { UserId } from "../model/users";
import { RootState } from "../reducers";
import { CONFIRMED_GROUP_CHAT } from "../constants";
import * as chatFunctions from "../model/chats";
import ChatListItem from "./ChatListItem";

export default React.memo(ChatList);

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
            key = c.kind === CONFIRMED_GROUP_CHAT ? "G-" + c.chatId.toString() : key = "NG-" + c.subject;
            isGroup = true;
            userId = null;
        }

        let latestMessageText = "";
        for (let i = c.messages.length - 1; i >= 0; i--) {
            const message = c.messages[i];
            if ("content" in message) {
                const content = message.content;
                if (content.kind === "text") {
                    latestMessageText = content.text;
                } else if (content.kind === "media") {
                    latestMessageText = content.caption ?? getMimeTypeDisplayName(content.mimeType);
                } else if (content.kind === "file") {
                    latestMessageText = content.name;
                } else {
                    throw new Error("Unrecognised content type - " + (content as any).kind);
                }
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
                userId={userId}
                unreadCount={chatFunctions.getUnreadCount(c)} />
        );
    });

    return (
        <ul className="chats">
            {chats}
        </ul>
    );
}

function getMimeTypeDisplayName(mimeType: string) : string {
    const mimeTypeLower = mimeType.toLowerCase();
    if (mimeTypeLower.startsWith("video/")) {
        return "video";
    } else if (mimeTypeLower.startsWith("image/")) {
        return "image";
    } else {
        return "file";
    }
}
