import React from "react";
import { useDispatch } from "react-redux";
import DefaultAvatar from "./DefaultAvatar";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";
import selectChat from "../actions/chats/selectChat";
import { Option } from "../model/common";
import { UserId } from "../model/users";

type Props = {
    name: string,
    date?: Date,
    index: number,
    selected: boolean,
    latestMessage: string,
    isGroup: boolean,
    userId: Option<UserId>
}

export default React.memo(ChatListItem);

function ChatListItem(props: Props) {
    const dispatch = useDispatch();
    const className = props.selected ? "selected" : "";
    const icon = props.isGroup
        ? <GroupChatIcon className="avatar" />
        : <DefaultAvatar userId={props.userId} />;

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
