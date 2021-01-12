import React from "react";

export default UnconfirmedMessage;

interface Props {
    message: string
}

function UnconfirmedMessage(props : Props) {
    return (
        <p className="message me">
            {props.message}
            <span className="message-time">...</span>
        </p>
    );
}
