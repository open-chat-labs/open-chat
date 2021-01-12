import React from "react";

type Props = {
    message: string,
    mergeWithPrevious: boolean
}

export default UnconfirmedMessage;

function UnconfirmedMessage(props : Props) {
    const className = "message me" + (props.mergeWithPrevious ? " merge" : "");
    return (
        <p className={className}>
            {props.message}
            <span className="message-time">...</span>
        </p>
    );
}
