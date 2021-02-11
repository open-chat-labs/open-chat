import React from "react";
import { useDispatch } from "react-redux";
import DefaultAvatar from "./DefaultAvatar";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";
import selectChat from "../actions/chats/selectChat";
import { Option } from "../domain/model/common";
import { UserId } from "../domain/model/users";
import { toDateString, toDayOfWeekString, toShortTimeString } from "../formatters/date";
import * as dateFunctions from "../utils/dateFunctions";
import ParticipantsTyping from "./ParticipantsTyping";
import TextContent from "./TextContent";
import ThemTyping from "./ThemTyping";
import UserOnlineMarker from "./UserOnlineMarker";

type Props = {
    name: string,
    date?: Date,
    index: number,
    selected: boolean,
    latestMessage: string,
    isGroup: boolean,
    userId: Option<UserId>,
    unreadCount: number,
    themTyping: boolean,
    userOnline: boolean,
    participantsTyping: string[]
}

export default React.memo(ChatListItem);

function ChatListItem(props: Props) {
    const dispatch = useDispatch();
    const className = props.selected ? "selected" : "";
    const icon = props.isGroup
        ? <GroupChatIcon className="avatar" />
        : <DefaultAvatar userId={props.userId} />;

    const userOnlineMarker: Option<JSX.Element> = props.userOnline
        ? <UserOnlineMarker />
        : null;

    let snippet: JSX.Element;
    if (props.themTyping) {
        snippet = <ThemTyping />;
    } else if (props.participantsTyping.length) {
        snippet = <ParticipantsTyping usernames={props.participantsTyping} />
    } else {
        snippet = <TextContent text={props.latestMessage} insertLineBreaks={false} />;
    }

    return (
        <li className={className} onClick={() => dispatch(selectChat(props.index))}>
            {icon}
            {userOnlineMarker}
            <div className="message-container">
                <div>
                    <div className="date">{props.date ? formatDateTime(props.date) : null}</div>
                    <div className="name">{props.name}</div>
                </div>
                <div>
                    {props.unreadCount > 0 ? <div className="unread-count">{props.unreadCount.toString()}</div> : null} 
                    <div className="chats-message">
                        {snippet}
                    </div>
                </div>
            </div>
        </li>
    );

    function formatDateTime(date: Date) : string {
        const startOfToday = dateFunctions.getStartOfToday();
        if (date >= startOfToday) {
            return toShortTimeString(date);
        }
        const startOfYesterday = dateFunctions.addDays(startOfToday, -1);
        if (date >= startOfYesterday) {
            return "Yesterday";
        }
        const useDayNameOnly = date >= dateFunctions.addDays(startOfToday, -6);
        return useDayNameOnly
            ? toDayOfWeekString(date)
            : toDateString(date);
    }
}
