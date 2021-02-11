import React from "react";
import { useDispatch } from "react-redux";
import gotoUser from "../actions/chats/gotoUser";
import Tick from "../assets/icons/tick.svg";
import DoubleTick from "../assets/icons/doubleTick.svg";
import { Option } from "../domain/model/common";
import { UserSummary } from "../domain/model/users";
import { MessageContent } from "../domain/model/messages";
import CyclesContent from "./CyclesContent";
import FileContent from "./FileContent";
import MediaContent from "./MediaContent";
import TextContent from "./TextContent";
import { toShortTimeString } from "../formatters/date";

export type Props = {
    messageId: Option<number>,
    clientMessageId: string,
    content: MessageContent,
    date: Date,
    sentByMe: boolean,
    sender: Option<UserSummary>,
    theirUsername: Option<string>,
    groupPosition: MessageGroupPosition,
    confirmed: boolean,
    readByMe: boolean,
    readByThem: boolean
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

    if (!props.readByMe) {
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
        contentElement = <FileContent content={props.content} />;
        className += " file";
    } else if (props.content.kind === "cycles") {
        className += " cycles";
        contentElement = <CyclesContent content={props.content} sentByMe={props.sentByMe} theirUsername={props.theirUsername} />;
    } else {
        contentElement = <TextContent text={props.content.text} />
    }

    let tick: Option<JSX.Element> = null;
    if (props.sentByMe && props.confirmed) {
        if (props.readByThem) {
            tick = <DoubleTick className="message-tick" />;
        } else {
            tick = <Tick className="message-tick" />;
        }
    }

    return (
        <div id={props.clientMessageId} data-message-id={props.messageId} className={className}>
            {senderLink}
            {contentElement}
            <span className="message-time">{toShortTimeString(props.date)}</span>
            {tick}
        </div>
    );
}

export enum MessageGroupPosition {
    None,
    Top,
    Middle,
    Bottom
}