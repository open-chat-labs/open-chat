import React from "react";

import { Timestamp } from "../../model/common";

interface Props {
    message: string,
    timestamp: Timestamp,
    senderUsername: string
}

export default GroupMessageSentByElse;

function GroupMessageSentByElse(props : Props) {
    return (
        <div>{props.message}</div>
    );
}
