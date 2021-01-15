import React from "react";
import { useDispatch } from "react-redux";
import gotoUser from "../../actions/chats/gotoUser";
import { UserSummary } from "../../model/users";
import { toShortTime } from "../../utils/datetimeFunctions";

type Props = {
    message: string,
    date: Date,
    sender: UserSummary,
    mergeWithPrevious: boolean
}

export default GroupMessageSentByElse;

function GroupMessageSentByElse(props : Props) {
    const dispatch = useDispatch();
    const className = "message them group" + (props.mergeWithPrevious ? " merge" : "");
    return (
        <p className={className}>
            <a className="participant" href="#" onClick={_ => dispatch(gotoUser(props.sender))}>{props.sender.username}</a>
            {props.message}
            <span className="message-time">{toShortTime(props.date)}</span>
        </p>
    );
}
