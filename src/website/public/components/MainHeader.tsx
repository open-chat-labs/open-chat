import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import { Option } from "../model/common";
import DefaultAvatar from "./DefaultAvatar";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";
import { toShortTime } from "../utils/datetimeFunctions";
import { CONFIRMED_GROUP_CHAT } from "../constants";
import * as setFunctions from "../utils/setFunctions";
import { UserSummary } from "../model/users";

export default MainHeader;

function MainHeader() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const me : Option<UserSummary> = useSelector((state: RootState) => state.usersState.me);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    let icon : JSX.Element;
    let chatName : string;
    let subTitle : Option<JSX.Element> = null;

    if ("them" in chat) {
        icon = <DefaultAvatar userId={chat.them} />;
        chatName = userDictionary.hasOwnProperty(chat.them) ? userDictionary[chat.them].username : "";
        subTitle = "updatedDate" in chat
            ? <div className="date">last seen {chat.updatedDate.toDateString()} at {toShortTime(chat.updatedDate)}</div>
            : null;
    } else {
        icon = <GroupChatIcon className="avatar" />;
        chatName = chat.subject;

        if (chat.kind === CONFIRMED_GROUP_CHAT && me) {
            let allButMe = setFunctions.except(chat.participants, [me.userId]);
            let participants = allButMe
                .filter(userId => userDictionary.hasOwnProperty(userId))
                .map(userId => userDictionary[userId].username)
                .concat(["You"])
                .join(", ");

            subTitle = <div className="date">{participants}</div>
        } 
    }

    return (
        <header>
            <button className="avatar-button">
                {icon}
            </button>
            <div>
            <div className="name">{chatName}</div>
                {subTitle}
            </div>
        </header>
    );
}
