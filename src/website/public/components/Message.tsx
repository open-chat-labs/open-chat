import React from "react";
import { useDispatch } from "react-redux";
import { toShortTime } from "../utils/datetimeFunctions";
import gotoUser from "../actions/chats/gotoUser";
import { UserSummary } from "../model/users";
import { MessageContent } from "../model/messages";
import MediaContent from "./MediaContent";

export interface Props {
    content: MessageContent,
    date?: Date,
    sentByMe: boolean,
    sender?: UserSummary,
    mergeWithPrevious: boolean
}

export default React.memo(Message);

function Message(props : Props) {
    const dispatch = useDispatch();

    let className = "message " + (props.sentByMe ? "me" : "them");
    let senderLink = null;

    if (props.mergeWithPrevious) {
        className += " merge";
    } else if (props.sender) {
        const sender = props.sender;
        senderLink = <a className="participant" href="#" onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>;
    }

    let contentElement;
    if (props.content.kind === "media") {
        className += " media";
        contentElement = <MediaContent key={props.content.blobId} content={props.content} />;
    } else {
        contentElement = props.content.text;
    }

    return (
        <p className={className}>
            {senderLink}
            {contentElement}
            <span className="message-time">{props.date ? toShortTime(props.date) : "..."}</span>
        </p>
    );
}
