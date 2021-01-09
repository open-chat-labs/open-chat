import React from "react";

import { Timestamp } from "../../model/common";

export default DirectMessageSentByThem;

interface Props {
    message: string,
    timestamp: Timestamp
}

function DirectMessageSentByThem(props : Props) {
    return (
        <div>{props.message}</div>
    );
}
