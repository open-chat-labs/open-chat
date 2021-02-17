import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import { Option } from "../domain/model/common";
import DefaultAvatar from "./DefaultAvatar";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";
import * as chatFunctions from "../domain/model/chats";
import * as setFunctions from "../utils/setFunctions";
import * as stateFunctions from "../domain/stateFunctions";
import { getSelectedChat } from "../domain/stateFunctions";
import { MyProfile, UserSummary } from "../domain/model/users";
import ParticipantsTyping from "./ParticipantsTyping";
import ThemTyping from "./ThemTyping";
import UserOnlineMarker from "./UserOnlineMarker";
import DirectChatMenu from "./DirectChatMenu";
import GroupChatMenu from "./GroupChatMenu";

export default React.memo(MainHeader);

function MainHeader() {
    const me: Option<MyProfile> = useSelector((state: RootState) => state.usersState.me);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    if (chat === null) {
        return <div></div>;
    }

    let icon: JSX.Element;
    let chatName: string = "";
    let subTitle: Option<JSX.Element> = null;
    let userOnlineMarker: Option<JSX.Element> = null;
    let chatMenu;

    if (chatFunctions.isDirectChat(chat)) {
        icon = <DefaultAvatar userId={chat.them} />;
        chatMenu = <DirectChatMenu />;
        if (userDictionary.hasOwnProperty(chat.them)) {
            const userSummary = userDictionary[chat.them] as UserSummary;
            chatName = userSummary.username;
            subTitle = chatFunctions.isConfirmedChat(chat) && chat.themTyping
                ? <ThemTyping />
                : <div className="date">{formatLastOnlineDate(userSummary.minutesSinceLastOnline)}</div>;

            if (userSummary.minutesSinceLastOnline < 2) {
                userOnlineMarker = <UserOnlineMarker />;
            }
        }
    } else {
        icon = <GroupChatIcon className="avatar" />;
        chatMenu = <GroupChatMenu />;
        chatName = chat.subject;

        if (chatFunctions.isConfirmedChat(chat) && me) {
            if (chat.participantsTyping.length) {
                const usernames = stateFunctions
                    .getUsers(chat.participantsTyping, userDictionary)
                    .map(u => u.username);

                subTitle = <ParticipantsTyping usernames={usernames} />;
            } else {
                let allButMe = setFunctions.except(chat.participants, [me.userId]);
                let participants = stateFunctions
                    .getUsers(allButMe, userDictionary)
                    .map(u => u.username)
                    .concat(["You"])
                    .join(", ");

                subTitle = <div className="participants">{participants}</div>
            }
        } 
    }

    return (
        <header>
            <div className="chat-header-container">
                <button className="avatar-button">
                    {icon}
                </button>
                {userOnlineMarker}
                <div className="chat-summary">
                    <div className="name">{chatName}</div>
                    {subTitle}
                </div>
            </div>
            <div className="chat-menu-container">{chatMenu}</div>            
        </header>
    );
}

function formatLastOnlineDate(minutesSinceLastOnline: number) : string {
    if (isNaN(minutesSinceLastOnline)) {
        return "";
    }
    if (minutesSinceLastOnline < 2) {
        return "Online now";
    }
    let durationText: string;
    if (minutesSinceLastOnline < 60) {
        durationText = `${minutesSinceLastOnline} minutes`;
    } else {
        const hoursSinceLastOnline = Math.floor(minutesSinceLastOnline / 60);
        if (hoursSinceLastOnline === 1) {
            durationText = "1 hour";
        } else if (hoursSinceLastOnline < 24) {
            durationText = `${hoursSinceLastOnline} hours`;
        } else {
            const daysSinceLastOnline = Math.floor(hoursSinceLastOnline / 24);
            durationText = daysSinceLastOnline === 1
                ? "1 day"
                : `${daysSinceLastOnline} days`;
        }
    }
    return `Last online ${durationText} ago`;
}
