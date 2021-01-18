import React from "react";
import { useDispatch } from "react-redux";

import { toShortTime } from "../utils/datetimeFunctions";
import gotoUser from "../actions/chats/gotoUser";
import { UserSummary } from "../model/users";
import { MessageContent } from "../model/messages";

export interface Props {
    content: MessageContent,
    date?: Date,
    sentByMe: boolean,
    sender?: UserSummary,
    mergeWithPrevious: boolean
}

export default Message;

function Message(props : Props) {
    let className = "message " + (props.sentByMe ? "me" : "them");
    let senderLink = null;
    if (props.sender) {
        const sender = props.sender;
        const dispatch = useDispatch();
        className += " group";
        senderLink = <a className="participant" href="#" onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>;
    }
    if (props.mergeWithPrevious) {
        className += " merge";
    }
    const messageContent =  props.content.kind === "text"
        ? props.content.text
        : <img src="pug1.jpeg" />;

    return (
        <p className={className}>
            {senderLink}
            {messageContent}
            <span className="message-time">{props.date ? toShortTime(props.date) : "..."}</span>
        </p>
    );
}
