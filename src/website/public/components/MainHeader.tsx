import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import DefaultAvatar from "./defaultAvatar";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";
import { toShortTime } from "../utils/datetimeFunctions";

export default MainHeader;

function MainHeader() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    let icon : JSX.Element;
    let chatName : string;

    if ("them" in chat) {
        icon = <DefaultAvatar userId={chat.them} />;
        chatName = userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them].username : "";
    } else {
        icon = <GroupChatIcon className="avatar" />;
        chatName = chat.subject;
    }

    const lastSeen = "updatedDate" in chat
        ? <div className="date">last seen {chat.updatedDate.toDateString()} at {toShortTime(chat.updatedDate)}</div>
        : null;

    return (
        <header>
            <button className="avatar-button">
                {icon}
            </button>
            <div>
            <div className="name">{chatName}</div>
                {lastSeen}
            </div>
        </header>
    );
}
