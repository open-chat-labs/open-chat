import React from "react";

export default MessageSentByMe;

interface Props {
    message: string,
    date: Date,
    confirmed: boolean
}

function MessageSentByMe(props : Props) {
    const style = props.confirmed ? {} : {fontStyle: "italic"};
    return (
        <div style={style}>{props.message}</div>
    );
}