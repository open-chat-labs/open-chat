import React from "react";
import { toShortTime } from "../../utils/datetimeFunctions";

export default MessageSentByMe;

interface Props {
    message: string,
    date: Date
}

function MessageSentByMe(props : Props) {
    return (
        <p className="message me">
            {props.message}
            <span className="message-time">{toShortTime(props.date)}</span>
        </p>
    );
}
