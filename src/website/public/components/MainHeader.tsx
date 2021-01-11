import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";

import DirectChatDefaultAvatar from "../assets/icons/directChatDefaultAvatar.svg";

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

    return (
        <header>
            <button className="avatar-button">
                <DirectChatDefaultAvatar className="avatar" />
            </button>
            <div>
            <div className="name">{chatName}</div>
                <div className="date">last seen {chat.updatedDate.toDateString()}</div>
            </div>
        </header>
    );
}
