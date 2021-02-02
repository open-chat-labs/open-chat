import React from "react";
import { useDispatch } from "react-redux";
import gotoUser from "../actions/chats/gotoUser";
import { Option } from "../model/common";
import { UserSummary } from "../model/users";
import { MessageContent } from "../model/messages";
import MediaContent from "./MediaContent";
import FileContent from "./FileContent";
import TextContent from "./TextContent";
import { toShortTimeString } from "../formatters/date";

export type Props = {
    messageId: Option<number>,
    clientMessageId: string,
    content: MessageContent,
    dateConfirmed: Option<Date>,
    sentByMe: boolean,
    sender: Option<UserSummary>,
    groupPosition: MessageGroupPosition
    unread: boolean,
}

export default React.memo(Message);

function Message(props : Props) {
    const dispatch = useDispatch();

    let className = "message " + (props.sentByMe ? "me" : "them");
    let senderLink = null;

    if (props.sender && (props.groupPosition == MessageGroupPosition.None || props.groupPosition == MessageGroupPosition.Top)) {
        const sender = props.sender;
        senderLink = <a 
            className="participant" 
            href="#" 
            role="button" 
            title={'Select chat with "' + sender.username + '"'} 
            onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>;
    }

    if (props.unread) {
        className += " unread";
    }

    switch (props.groupPosition) {
        case MessageGroupPosition.Top:
            className += " top";
            break;
        case MessageGroupPosition.Middle:
            className += " merge middle";
            break;
        case MessageGroupPosition.Bottom:
            className += " merge bottom";
            break;
    }

    let contentElement;
    if (props.content.kind === "media") {
        className += " media";
        contentElement = <MediaContent content={props.content} />;
    } else if (props.content.kind === "file") {
        className += " file";
        contentElement = <FileContent content={props.content} />;
    } else {
        contentElement = <TextContent text={props.content.text} />
    }

    return (
        <div id={props.clientMessageId} data-message-id={props.messageId} className={className}>
            {senderLink}
            {contentElement}
            <span className="message-time">{props.dateConfirmed ? toShortTimeString(props.dateConfirmed) : "..."}</span>
        </div>
    );
}

export enum MessageGroupPosition {
    None,
    Top,
    Middle,
    Bottom
}