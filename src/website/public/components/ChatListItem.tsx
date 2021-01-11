import React from "react";
import { useDispatch } from "react-redux";

import selectChat from "../actions/chats/selectChat";

import DefaultAvatar from "../assets/icons/defaultAvatar.svg";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";

type Props = {
    name: string,
    date?: Date,
    index: number,
    selected: boolean,
    latestMessage: string,
    isGroup: boolean
}

export default ChatListItem;

function ChatListItem(props: Props) {
    const dispatch = useDispatch();
    const className = props.selected ? "selected" : "";
    const icon = props.isGroup
        ? <GroupChatIcon className="avatar" />
        : <DefaultAvatar className="avatar" />;

    return (
        <li className={className} onClick={() => dispatch(selectChat(props.index))}>
            {icon}
            <div className="message-container">
                <div className="date">{props.date ? props.date.toDateString() : null}</div>
                <div className="name">{props.name}</div>
                <div className="message">{props.latestMessage}</div>
            </div>
        </li>
    );
}
