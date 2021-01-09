import React from "react";

import { Timestamp } from "../../model/common";

export default MessageSentByMe;

interface Props {
    message: string,
    timestamp: Timestamp,
    confirmed: boolean
}

function MessageSentByMe(props : Props) {
    const style = props.confirmed ? {} : {fontStyle: "italic"};
    return (
        <div style={style}>{props.message}</div>
    );
}