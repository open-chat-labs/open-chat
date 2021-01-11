import React from "react";
import { useDispatch } from "react-redux";

import selectChat from "../actions/chats/selectChat";

import DirectChatDefaultAvatar from "../assets/icons/directChatDefaultAvatar.svg";

type Props = {
    name: string,
    date?: Date,
    index: number,
    selected: boolean,
    latestMessage: string
}

export default ChatListItem;

function ChatListItem(props: Props) {
    const dispatch = useDispatch();
    const className = props.selected ? "selected" : "";

    return (
        <li className={className} onClick={() => dispatch(selectChat(props.index))}>
            <DirectChatDefaultAvatar className="avatar" />
            <div className="message-container">
                <div className="date">{props.date ? props.date.toDateString() : null}</div>
                <div className="name">{props.name}</div>
                <div className="message">{props.latestMessage}</div>
            </div>
        </li>
    );
}
