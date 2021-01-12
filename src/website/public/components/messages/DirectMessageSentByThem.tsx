import React from "react";
import { toShortTime } from "../../utils/datetimeFunctions";

export default DirectMessageSentByThem;

type Props = {
    message: string,
    date: Date
}

function DirectMessageSentByThem(props : Props) {
    return (
        <p className="message them">
            {props.message}
            <span className="message-time">{toShortTime(props.date)}</span>
        </p>
    );
}
