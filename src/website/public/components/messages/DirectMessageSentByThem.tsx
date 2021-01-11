import React from "react";

export default DirectMessageSentByThem;

type Props = {
    message: string,
    date: Date
}

function DirectMessageSentByThem(props : Props) {
    return (
        <div>{props.message}</div>
    );
}
