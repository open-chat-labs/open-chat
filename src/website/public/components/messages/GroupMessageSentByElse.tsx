import React from "react";
import { toShortTime } from "../../utils/datetimeFunctions";

type Props = {
    message: string,
    date: Date,
    senderUsername: string,
    mergeWithPrevious: boolean
}

export default GroupMessageSentByElse;

function GroupMessageSentByElse(props : Props) {
    const className = "message them" + (props.mergeWithPrevious ? " merge" : "");
    return (
        <p className={className}>
            {props.message}
            <span className="message-time">{toShortTime(props.date)}</span>
        </p>
    );
}
