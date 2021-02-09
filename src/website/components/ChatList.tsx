import React from "react";
import { useSelector } from "react-redux";
import { Option } from "../model/common";
import { UserId } from "../model/users";
import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import * as stateFunctions from "../utils/stateFunctions";
import ChatListItem from "./ChatListItem";
import { CyclesContent, MediaContent } from "../model/messages";
import { formatCycles } from "../formatters/cycles";

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
        let themTyping: boolean = false;
        let participantsTyping: string[] = [];

        if (chatFunctions.isDirectChat(c)) {
            name = (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
            key = "D-" + c.them.toString();
            isGroup = false;
            userId = c.them;
            themTyping = chatFunctions.isConfirmedChat(c) && c.themTyping;
        } else {
            name = c.subject;
            isGroup = true;
            userId = null;
            if (chatFunctions.isConfirmedChat(c)) {
                key = "G-" + c.chatId.toString();
                participantsTyping = stateFunctions.getUsers(c.participantsTyping, userDictionary).map(u => u.username);
            } else {
                key = "NG-" + c.subject;
            }
        }

        let latestMessageText = "";
        for (let i = c.messages.length - 1; i >= 0; i--) {
            const message = c.messages[i];
            if ("content" in message) {
                const content = message.content;
                if (content.kind === "text") {
                    latestMessageText = content.text;
                } else if (content.kind === "media") {
                    latestMessageText = buildTextForMediaContent(content);
                } else if (content.kind === "file") {
                    latestMessageText = content.name;
                } else if (content.kind === "cycles") {
                    latestMessageText = buildTextForCyclesContent(content);
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
                date={"lastUpdated" in c ? c.lastUpdated : undefined}
                index={index}
                selected={index === selectedChatIndex}
                latestMessage={latestMessageText}
                isGroup={isGroup}
                userId={userId}
                unreadCount={chatFunctions.getUnreadMessageCount(c)}
                themTyping={themTyping}
                participantsTyping={participantsTyping} />
        );
    });

    return (
        <ul className="chats">
            {chats}
        </ul>
    );
}

function buildTextForMediaContent(content: MediaContent) : string {
    if (content.caption)
        return content.caption;

    const mimeType = content.mimeType;

    const mimeTypeLower = mimeType.toLowerCase();
    if (mimeTypeLower.startsWith("video/")) {
        return "video";
    } else if (mimeTypeLower.startsWith("image/")) {
        return "image";
    } else {
        return "file";
    }
}

function buildTextForCyclesContent(content: CyclesContent) : string {
    if (content.caption)
        return content.caption;

    return formatCycles(content.amount);
}
