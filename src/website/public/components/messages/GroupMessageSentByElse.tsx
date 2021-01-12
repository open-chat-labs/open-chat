import React from "react";
import { toShortTime } from "../../utils/datetimeFunctions";

interface Props {
    message: string,
    date: Date,
    senderUsername: string
}

export default GroupMessageSentByElse;

function GroupMessageSentByElse(props : Props) {
    return (
        <p className="message them">
            {props.message}
            <span className="message-time">{toShortTime(props.date)}</span>
        </p>
    );
}
