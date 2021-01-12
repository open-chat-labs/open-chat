import React from "react";
import { toShortTime } from "../../utils/datetimeFunctions";

type Props = {
    message: string,
    date: Date,
    mergeWithPrevious: boolean
}

export default MessageSentByMe;

function MessageSentByMe(props : Props) {
    const className = "message me" + (props.mergeWithPrevious ? " merge" : "");
    return (
        <p className={className}>
            {props.message}
            <span className="message-time">{toShortTime(props.date)}</span>
        </p>
    );
}
