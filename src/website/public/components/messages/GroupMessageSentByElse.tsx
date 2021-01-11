import React from "react";

interface Props {
    message: string,
    date: Date,
    senderUsername: string
}

export default GroupMessageSentByElse;

function GroupMessageSentByElse(props : Props) {
    return (
        <div>{props.message}</div>
    );
}
