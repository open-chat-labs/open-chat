import React from "react";
import { toShortTime } from "../utils/datetimeFunctions";
import {useDispatch} from "react-redux";
import gotoUser from "../actions/chats/gotoUser";
import { UserSummary } from "../model/users";

export interface Props {
    message: string,
    date?: Date,
    sentByMe: boolean,
    sender?: UserSummary,
    mergeWithPrevious: boolean
}

export default Message;

function Message(props : Props) {
    let className = "message " + (props.sentByMe ? "me" : "them");
    let senderUsernameFragment = null;
    if (props.sender) {
        const sender = props.sender;
        const dispatch = useDispatch();
        className += " group";
        senderUsernameFragment = <a className="participant" href="#" onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>;
    }
    if (props.mergeWithPrevious) {
        className += " merge";
    }
    return (
        <p className={className}>
            {senderUsernameFragment}
            {props.message}
            <span className="message-time">{props.date ? toShortTime(props.date) : "..."}</span>
        </p>
    );
}
