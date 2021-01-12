import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import DefaultAvatar from "../assets/icons/defaultAvatar.svg";
import { toShortTime } from "../utils/datetimeFunctions";

export default MainHeader;

function MainHeader() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    const chatName = "them" in chat
        ? (userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them].username : "")
        : chat.subject;

    const lastSeen = "updatedDate" in chat
        ? <div className="date">last seen {chat.updatedDate.toDateString()} at {toShortTime(chat.updatedDate)}</div>
        : null;

    return (
        <header>
            <button className="avatar-button">
                <DefaultAvatar className="avatar" />
            </button>
            <div>
            <div className="name">{chatName}</div>
                {lastSeen}
            </div>
        </header>
    );
}
